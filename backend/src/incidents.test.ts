import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from './app.js';
import { AuditLog } from './models/AuditLog.js';
import { Incident } from './models/Incident.js';
import { signAccessToken } from './utils/jwt.js';

const reporterId = new Types.ObjectId();
const otherCitizenId = new Types.ObjectId();

function makeIncident(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    _id: new Types.ObjectId(),
    incidentType: 'medical emergency',
    description: 'Person collapsed near the market',
    reporterId,
    location: { type: 'Point', coordinates: [36.8219, -1.2921] },
    evidence: [],
    status: 'pending',
    priority: 'normal',
    statusHistory: [{ status: 'pending', at: now, note: 'Report created by citizen' }],
    source: 'mobile',
    clientGeneratedId: 'client-generated-0001',
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    incidentType: 'medical emergency',
    description: 'Person collapsed near the market',
    location: { latitude: -1.2921, longitude: 36.8219 },
    occurredAt: new Date().toISOString(),
    clientGeneratedId: 'client-generated-0001',
    ...overrides,
  };
}

function tokenFor(userId = reporterId.toString(), role: 'Citizen' | 'Security Officer' = 'Citizen') {
  return signAccessToken(userId, role);
}

function authHeader(token = tokenFor()) {
  return { authorization: `Bearer ${token}` };
}

describe('Incident reporting module', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-for-incidents';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending incident report for the authenticated reporter', async () => {
    vi.spyOn(Incident, 'findOne').mockResolvedValue(null);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    const createSpy = vi.spyOn(Incident, 'create').mockResolvedValue(makeIncident() as never);

    const response = await request(createApp())
      .post('/api/incidents')
      .set(authHeader())
      .send(basePayload());

    expect(response.status).toBe(201);
    expect(response.body.duplicate).toBe(false);
    expect(response.body.incident.status).toBe('pending');
    expect(response.body.incident.priority).toBe('normal');
    expect(response.body.incident.location).toEqual({ latitude: -1.2921, longitude: 36.8219 });
    expect(response.body.incident.reference).toMatch(/^OKJ-[A-Z0-9]{8}$/);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      incidentType: 'medical emergency',
      status: 'pending',
      priority: 'normal',
      reporterId: expect.any(Types.ObjectId),
      location: { type: 'Point', coordinates: [36.8219, -1.2921] },
      clientGeneratedId: 'client-generated-0001',
    }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'incident.created',
      resourceType: 'Incident',
      metadata: expect.objectContaining({ incidentType: 'medical emergency' }),
    }));
  });

  it('accepts a manual location description when GPS is unavailable', async () => {
    vi.spyOn(Incident, 'findOne').mockResolvedValue(null);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    vi.spyOn(Incident, 'create').mockResolvedValue(makeIncident({
      location: undefined,
      addressOrArea: 'Near the chief’s camp, Kaptembwa',
    }) as never);

    const response = await request(createApp())
      .post('/api/incidents')
      .set(authHeader())
      .send(basePayload({ location: undefined, addressOrArea: 'Near the chief’s camp, Kaptembwa' }));

    expect(response.status).toBe(201);
    expect(response.body.incident.location).toBeNull();
    expect(response.body.incident.addressOrArea).toBe('Near the chief’s camp, Kaptembwa');
  });

  it('creates a critical priority SOS alert', async () => {
    vi.spyOn(Incident, 'findOne').mockResolvedValue(null);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    const createSpy = vi.spyOn(Incident, 'create').mockResolvedValue(makeIncident({
      priority: 'critical',
      incidentType: 'other',
      description: 'Emergency SOS activated. Immediate assistance requested.',
    }) as never);

    const response = await request(createApp())
      .post('/api/incidents/sos')
      .set(authHeader())
      .send({
        location: { latitude: -1.2921, longitude: 36.8219 },
        clientGeneratedId: 'sos-client-generated-01',
        occurredAt: new Date().toISOString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toContain('SOS');
    expect(response.body.incident.priority).toBe('critical');
    expect(response.body.incident.status).toBe('pending');
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'critical',
      status: 'pending',
      incidentType: 'other',
    }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'incident.sos.created' }));
  });

  it('rejects coordinates outside valid ranges', async () => {
    const createSpy = vi.spyOn(Incident, 'create');

    const response = await request(createApp())
      .post('/api/incidents')
      .set(authHeader())
      .send(basePayload({ location: { latitude: 91, longitude: -181 } }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects reports without a description and without a location', async () => {
    const response = await request(createApp())
      .post('/api/incidents')
      .set(authHeader())
      .send(basePayload({ description: '   ', location: undefined }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
  });

  it('requires authentication to submit reports', async () => {
    const response = await request(createApp()).post('/api/incidents').send(basePayload());

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('returns the original report for duplicate clientGeneratedId submissions', async () => {
    const existing = makeIncident({ priority: 'critical' });
    vi.spyOn(Incident, 'findOne').mockResolvedValue(existing as never);
    const createSpy = vi.spyOn(Incident, 'create');

    const response = await request(createApp())
      .post('/api/incidents/sos')
      .set(authHeader())
      .send({
        location: { latitude: -1.2921, longitude: 36.8219 },
        clientGeneratedId: 'duplicate-sos-id-0001',
      });

    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(response.body.incident.id).toBe(existing._id.toString());
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('returns the original report when a duplicate key race occurs', async () => {
    const existing = makeIncident();
    vi.spyOn(Incident, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing as never);
    vi.spyOn(Incident, 'create').mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 11000 }));
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);

    const response = await request(createApp())
      .post('/api/incidents')
      .set(authHeader())
      .send(basePayload());

    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(response.body.incident.id).toBe(existing._id.toString());
  });

  it('paginates the citizen report history', async () => {
    const rows = [makeIncident(), makeIncident()];
    const limit = vi.fn().mockResolvedValue(rows);
    const chain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit,
    };
    const findSpy = vi.spyOn(Incident, 'find').mockReturnValue(chain as never);
    vi.spyOn(Incident, 'countDocuments').mockResolvedValue(25);

    const response = await request(createApp())
      .get('/api/incidents/my-incidents?page=2&limit=10')
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.incidents).toHaveLength(2);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasMore: true,
    });
    expect(findSpy).toHaveBeenCalledWith({ reporterId: new Types.ObjectId(reporterId.toString()) });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await request(createApp())
      .get('/api/incidents/my-incidents?page=0&limit=500')
      .set(authHeader());

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid query parameters');
  });

  it('lets a reporter view their own incident details', async () => {
    const incident = makeIncident();
    vi.spyOn(Incident, 'findById').mockResolvedValue(incident as never);

    const response = await request(createApp())
      .get(`/api/incidents/${incident._id.toString()}`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.incident.id).toBe(incident._id.toString());
    expect(response.body.incident.statusHistory).toHaveLength(1);
  });

  it('blocks other citizens from viewing an incident they did not report', async () => {
    const incident = makeIncident();
    vi.spyOn(Incident, 'findById').mockResolvedValue(incident as never);

    const response = await request(createApp())
      .get(`/api/incidents/${incident._id.toString()}`)
      .set(authHeader(tokenFor(otherCitizenId.toString(), 'Citizen')));

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('do not have access');
  });

  it('allows security officers with incident permissions to view details', async () => {
    const incident = makeIncident();
    vi.spyOn(Incident, 'findById').mockResolvedValue(incident as never);

    const response = await request(createApp())
      .get(`/api/incidents/${incident._id.toString()}`)
      .set(authHeader(tokenFor(new Types.ObjectId().toString(), 'Security Officer')));

    expect(response.status).toBe(200);
    expect(response.body.incident.id).toBe(incident._id.toString());
  });

  it('returns 404 for an unknown incident id', async () => {
    const response = await request(createApp())
      .get('/api/incidents/not-a-valid-id')
      .set(authHeader());

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Incident not found');
  });
});
