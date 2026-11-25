import request from 'supertest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createApp } from './app.js';
import { Incident } from './models/Incident.js';
import { signAccessToken, verifyRealtimeToken } from './utils/jwt.js';
import { User } from './models/User.js';
import { signRealtimeToken } from './utils/jwt.js';
import { authenticateRealtimeTicket } from './services/realtimeService.js';

const auth = (role: 'County Administrator'|'Community Leader'|'Citizen' = 'County Administrator') => ({ authorization: `Bearer ${signAccessToken('64b000000000000000000001', role)}` });
describe('analytics, audit, and real-time authorization', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'phase-six-test-secret'; vi.restoreAllMocks(); });
  it('requires a privileged analytics permission', async () => {
    expect((await request(createApp()).get('/api/analytics/incidents').set(auth('Community Leader'))).status).toBe(403);
    expect((await request(createApp()).get('/api/analytics/incidents')).status).toBe(401);
  });
  it('rejects invalid analytics date ranges', async () => {
    const response = await request(createApp()).get('/api/analytics/incidents?from=2026-02-01&to=2026-01-01').set(auth());
    expect(response.status).toBe(400);
  });
  it('returns empty analytics with unavailable performance metrics', async () => {
    vi.spyOn(Incident, 'aggregate').mockResolvedValue([{
      summary: [], byCategory: [], byStatus: [], trend: [], acknowledgement: [], resolution: [], locations: [],
    }] as never);
    const response = await request(createApp()).get('/api/analytics/incidents?from=2026-01-01&to=2026-01-31').set(auth());
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ total: 0, active: 0, resolved: 0, pending: 0, escalated: 0 });
    expect(response.body.responsePerformance.acknowledgement).toEqual({ averageMinutes: null, sampleSize: 0 });
    expect(response.body.locationDistribution).toEqual([]);
  });
  it('restricts audit records to the audit permission', async () => {
    expect((await request(createApp()).get('/api/audit').set(auth('Community Leader'))).status).toBe(403);
    expect((await request(createApp()).get('/api/audit?page=0').set(auth())).status).toBe(400);
  });
  it('issues scoped, expiring tickets only to incident viewers', async () => {
    const denied = await request(createApp()).post('/api/auth/realtime-ticket').set(auth('Citizen'));
    expect(denied.status).toBe(403);
    const response = await request(createApp()).post('/api/auth/realtime-ticket').set(auth());
    expect(response.status).toBe(200);
    expect(verifyRealtimeToken(response.body.ticket).sub).toBe('64b000000000000000000001');
    expect(response.body.expiresInSeconds).toBe(300);
  });
  it('rechecks current active user role when a socket ticket is presented', async () => {
    const userId = '64b000000000000000000001';
    const select = vi.fn().mockResolvedValue({ _id: { toString: () => userId }, role: 'Security Officer', isActive: true });
    vi.spyOn(User, 'findById').mockReturnValue({ select } as never);
    const identity = await authenticateRealtimeTicket(signRealtimeToken(userId));
    expect(identity).toMatchObject({ userId, role: 'Security Officer' });
    select.mockResolvedValue({ _id: { toString: () => userId }, role: 'Citizen', isActive: true });
    await expect(authenticateRealtimeTicket(signRealtimeToken(userId))).rejects.toThrow('Real-time incident access is not permitted');
  });
});
