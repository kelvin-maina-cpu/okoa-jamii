import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { InAppEventType, InAppNotification } from '../models/InAppNotification.js';

function eventMessage(eventType: InAppEventType, audience: 'reporter' | 'officer'): string {
  if (audience === 'officer') {
    if (eventType === 'assigned') return 'You have been assigned to an incident report.';
    if (eventType === 'escalated') return 'An assigned incident has been escalated.';
    if (eventType === 'resolved') return 'An assigned incident has been marked resolved.';
    return 'An incident report has been acknowledged.';
  }
  if (eventType === 'acknowledged') return 'Your incident report has been acknowledged.';
  if (eventType === 'assigned') return 'A response officer has been assigned to your incident report.';
  if (eventType === 'escalated') return 'Your incident report has been escalated for further attention.';
  return 'Your incident report has been marked resolved.';
}

export async function createIncidentInAppNotifications(input: {
  incidentId: Types.ObjectId; reporterId: Types.ObjectId; assignedOfficerId?: Types.ObjectId;
  eventType: InAppEventType; eventKey: string; actorId?: string;
}): Promise<void> {
  const targets = new Map<string, { id: Types.ObjectId; audience: 'reporter'|'officer' }>();
  targets.set(input.reporterId.toString(), { id: input.reporterId, audience: 'reporter' });
  if (input.assignedOfficerId) targets.set(input.assignedOfficerId.toString(), { id: input.assignedOfficerId, audience: 'officer' });
  if (input.actorId) targets.delete(input.actorId);
  const reference = `OKJ-${input.incidentId.toString().slice(-8).toUpperCase()}`;
  for (const target of targets.values()) {
    const userId = target.id;
    try {
      await InAppNotification.updateOne(
        { userId, dedupeKey: input.eventKey },
        { $setOnInsert: { userId, incidentId: input.incidentId, eventType: input.eventType, reference, message: eventMessage(input.eventType, target.audience), dedupeKey: input.eventKey } },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
  }
}

export async function listMyNotifications(userId: string, page: number, limit: number) {
  const filter = { userId: new Types.ObjectId(userId) };
  const [notifications, total, unread] = await Promise.all([
    InAppNotification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('incidentId eventType reference message readAt createdAt').lean(),
    InAppNotification.countDocuments(filter), InAppNotification.countDocuments({ ...filter, readAt: { $exists: false } }),
  ]);
  return { notifications, unreadCount: unread, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function markMyNotificationRead(userId: string, notificationId: string) {
  if (!Types.ObjectId.isValid(notificationId)) throw new AppError('Notification not found', 404);
  const notification = await InAppNotification.findOneAndUpdate({ _id: notificationId, userId: new Types.ObjectId(userId) }, { $set: { readAt: new Date() } }, { returnDocument: 'after' }).select('incidentId eventType reference message readAt createdAt').lean();
  if (!notification) throw new AppError('Notification not found', 404);
  return notification;
}
