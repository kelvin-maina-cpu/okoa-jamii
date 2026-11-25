import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from './app.js';
import { CommunityAlert } from './models/CommunityAlert.js';
import { AuditLog } from './models/AuditLog.js';
import { signAccessToken } from './utils/jwt.js';

const adminHeader = () => ({ authorization: `Bearer ${signAccessToken(new Types.ObjectId().toString(), 'County Administrator')}` });
describe('community alerts API', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'alert-test-secret'; vi.restoreAllMocks(); });
  it('requires authentication to read alerts', async () => {
    expect((await request(createApp()).get('/api/alerts')).status).toBe(401);
  });
  it('creates an audited draft and does not publish it automatically', async () => {
    vi.spyOn(CommunityAlert, 'create').mockResolvedValue({ _id: new Types.ObjectId(), title: 'Road safety', message: 'Avoid the flooded crossing.', targetArea: 'Kisumu', publishedAt: undefined } as never);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    const response = await request(createApp()).post('/api/alerts').set(adminHeader()).send({ title: 'Road safety', message: 'Avoid the flooded crossing.', targetArea: 'Kisumu' });
    expect(response.status).toBe(201);
    expect(response.body.alert.publishedAt).toBeUndefined();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'community_alert.created' }));
  });
  it('rejects an invalid alert payload', async () => {
    const response = await request(createApp()).post('/api/alerts').set(adminHeader()).send({ title: 'x', message: '', targetArea: '' });
    expect(response.status).toBe(400);
  });
});
