import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Incident } from './models/Incident.js';
import { User } from './models/User.js';
import { AuditLog } from './models/AuditLog.js';
import { respondToIncident } from './services/incidentService.js';

function makeResponseIncident(status: string = 'pending') {
  return {
    _id: new Types.ObjectId(), status, statusHistory: [], assignmentHistory: [], priority: 'normal',
    save: vi.fn().mockResolvedValue(undefined),
  } as never;
}
describe('incident response workflow', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it('records an acknowledgement and audit event', async () => {
    const incident = makeResponseIncident(); vi.spyOn(Incident, 'findById').mockResolvedValue(incident);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    await respondToIncident((incident as any)._id.toString(), new Types.ObjectId().toString(), 'acknowledge', {});
    expect((incident as any).status).toBe('acknowledged');
    expect((incident as any).statusHistory.at(-1).status).toBe('acknowledged');
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'incident.acknowledge' }));
  });
  it('assigns only an active Security Officer and stores assignment history', async () => {
    const incident = makeResponseIncident(); const officerId = new Types.ObjectId();
    vi.spyOn(Incident, 'findById').mockResolvedValue(incident);
    vi.spyOn(User, 'findOne').mockResolvedValue({ _id: officerId, role: 'Security Officer', isActive: true } as never);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    await respondToIncident((incident as any)._id.toString(), new Types.ObjectId().toString(), 'assign', { officerId: officerId.toString(), note: 'North district' });
    expect((incident as any).assignedOfficerId).toEqual(officerId);
    expect((incident as any).status).toBe('assigned');
    expect((incident as any).assignmentHistory).toHaveLength(1);
  });
  it('rejects escalation after resolution', async () => {
    const incident = makeResponseIncident('resolved'); vi.spyOn(Incident, 'findById').mockResolvedValue(incident);
    await expect(respondToIncident((incident as any)._id.toString(), new Types.ObjectId().toString(), 'escalate', {})).rejects.toMatchObject({ statusCode: 409 });
  });
});
