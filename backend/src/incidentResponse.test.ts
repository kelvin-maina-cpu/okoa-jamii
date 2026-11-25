import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import { signAccessToken } from './utils/jwt.js';

vi.mock('./services/incidentService.js', () => ({
  createIncidentReport: vi.fn(), createSosReport: vi.fn(), getIncidentForUser: vi.fn(), listMyIncidents: vi.fn(),
  listOperationsIncidents: vi.fn().mockResolvedValue({ incidents: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false }, summary: { byStatus: {} } }),
  listEligibleOfficers: vi.fn().mockResolvedValue([]), respondToIncident: vi.fn().mockResolvedValue({ status: 'acknowledged' }),
  autoEscalateStaleIncidents: vi.fn(),
}));

const token = (role: 'Citizen'|'Security Officer'|'County Administrator' = 'Security Officer') => ({ authorization: `Bearer ${signAccessToken('64b000000000000000000001', role)}` });
describe('incident response API authorization and filtering', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'response-test-secret'; });
  it('rejects unauthenticated operations queue access', async () => {
    expect((await request(createApp()).get('/api/incidents/operations')).status).toBe(401);
  });
  it('blocks citizen access to operations queue', async () => {
    const response = await request(createApp()).get('/api/incidents/operations').set(token('Citizen'));
    expect(response.status).toBe(403);
  });
  it('accepts valid queue filters and returns pagination', async () => {
    const response = await request(createApp()).get('/api/incidents/operations?page=2&limit=10&status=pending&incidentType=armed%20attack').set(token());
    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1); // service mock response
  });
  it('rejects unsupported response status filters', async () => {
    const response = await request(createApp()).get('/api/incidents/operations?status=closed').set(token());
    expect(response.status).toBe(400);
  });
  it('allows an officer with response permission to acknowledge', async () => {
    const response = await request(createApp()).post('/api/incidents/64b000000000000000000001/acknowledge').set(token()).send({ note: 'Team notified' });
    expect(response.status).toBe(200);
    expect(response.body.incident.status).toBe('acknowledged');
  });
  it('blocks a community leader from acknowledging', async () => {
    const response = await request(createApp()).post('/api/incidents/64b000000000000000000001/acknowledge').set({ authorization: `Bearer ${signAccessToken('64b000000000000000000001', 'Community Leader')}` }).send({});
    expect(response.status).toBe(403);
  });
});
