import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditLog } from './models/AuditLog.js';
import { listAuditEvents } from './services/auditService.js';

describe('audit event reader', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('paginates events and filters sensitive metadata fields', async () => {
    const query = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ action: 'incident.resolved', metadata: { status: 'resolved', note: 'private response text', location: 'precise GPS', token: 'secret' }, createdAt: new Date() }]) };
    vi.spyOn(AuditLog, 'find').mockReturnValue(query as never);
    vi.spyOn(AuditLog, 'countDocuments').mockResolvedValue(51);
    const result = await listAuditEvents({ page: 2, limit: 50 });
    expect(result.pagination).toMatchObject({ page: 2, limit: 50, total: 51, totalPages: 2 });
    expect(result.events[0].metadata).toEqual({ status: 'resolved' });
    expect(query.skip).toHaveBeenCalledWith(50);
  });
});
