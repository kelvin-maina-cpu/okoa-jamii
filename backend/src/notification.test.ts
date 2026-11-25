import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from './app.js';
import { InAppNotification } from './models/InAppNotification.js';
import { createIncidentInAppNotifications } from './services/inAppNotificationService.js';
import { signAccessToken } from './utils/jwt.js';

describe('in-app incident notifications', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'notifications-test-secret'; vi.restoreAllMocks(); });
  it('notifies the reporter and assigned officer with generic, idempotent records', async () => {
    const update = vi.spyOn(InAppNotification, 'updateOne').mockResolvedValue({} as never);
    const reporterId = new Types.ObjectId(); const officerId = new Types.ObjectId(); const incidentId = new Types.ObjectId();
    await createIncidentInAppNotifications({ incidentId, reporterId, assignedOfficerId: officerId, eventType: 'assigned', eventKey: `${incidentId}:assigned:1`, actorId: new Types.ObjectId().toString() });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ userId: reporterId, dedupeKey: `${incidentId}:assigned:1` }), expect.objectContaining({ $setOnInsert: expect.objectContaining({ message: expect.stringContaining('officer has been assigned') }) }), { upsert: true });
    expect(update.mock.calls[0][1]).not.toHaveProperty('$setOnInsert.description');
  });
  it('requires authentication and enforces notification ownership for reads', async () => {
    const unauthenticated = await request(createApp()).get('/api/notifications');
    expect(unauthenticated.status).toBe(401);
    const query = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(null) };
    const update = vi.spyOn(InAppNotification, 'findOneAndUpdate').mockReturnValue(query as never);
    const id = new Types.ObjectId().toString();
    const response = await request(createApp()).patch(`/api/notifications/${id}/read`).set({ authorization: `Bearer ${signAccessToken(new Types.ObjectId().toString(), 'Citizen')}` });
    expect(response.status).toBe(404);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ userId: expect.any(Types.ObjectId), _id: id }), expect.any(Object), expect.any(Object));
  });
});
