import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { Incident } from '../models/Incident.js';
import { IncidentNotification, NotificationStatus } from '../models/IncidentNotification.js';
import { readSmsConfiguration, MockSmsProvider, normalizeSmsMessage, SmsProvider } from './smsProviders.js';

function buildMessage(incidentId: string, incidentType: string, eventType: 'sos' | 'escalation'): string {
  const reference = `OKJ-${incidentId.slice(-8).toUpperCase()}`;
  if (eventType === 'escalation') {
    return normalizeSmsMessage(`Okoa Jamii incident ${reference} (${incidentType}) was auto-escalated. Review the secure dashboard. Dispatch is not confirmed.`);
  }
  return normalizeSmsMessage(`Okoa Jamii emergency report received by server: ${reference} (${incidentType}). Responder dispatch is not confirmed.`);
}

async function writeNotificationAudit(actorId: string | undefined, notificationId: Types.ObjectId, status: NotificationStatus): Promise<void> {
  try {
    await AuditLog.create({
      ...(actorId ? { actorId: new Types.ObjectId(actorId), actorType: 'user' } : { actorType: 'system' }),
      action: 'incident.sms.notification',
      resourceType: 'IncidentNotification',
      resourceId: notificationId,
      metadata: { channel: 'sms', status },
    });
  } catch (error) {
    console.error('Unable to audit SMS notification status:', error instanceof Error ? error.message : error);
  }
}

/** Persist notification state and deliver only through an explicitly configured provider. */
async function createIncidentSmsNotifications(
  incidentId: string,
  eventType: 'sos' | 'escalation',
  actorId?: string,
): Promise<void> {
  const incident = await Incident.findById(incidentId).select('incidentType');
  if (!incident) return;
  const config = readSmsConfiguration();
  const message = buildMessage(incidentId, incident.incidentType, eventType);
  const provider: SmsProvider | null = config.provider === 'mock' && process.env.NODE_ENV !== 'production'
    ? new MockSmsProvider()
    : null;
  const baseQuery = { incidentId: incident._id, eventType, channel: 'sms' as const };

  if (!config.recipients.length || !provider) {
    const status: NotificationStatus = config.invalidRecipientCount > 0 ? 'failed' : 'not_configured';
    const update = config.invalidRecipientCount > 0
      ? { $set: { status, errorMessage: 'SMS recipient configuration contains invalid Kenyan mobile numbers.' } }
      : { $set: { status }, $unset: { errorMessage: 1 } };
    const notification = await IncidentNotification.findOneAndUpdate(
      { ...baseQuery, recipient: { $exists: false } },
      { ...update, $setOnInsert: { ...baseQuery, message, provider: config.provider } },
      { upsert: true, new: true },
    );
    await writeNotificationAudit(actorId, notification._id, status);
    return;
  }

  for (const recipient of config.recipients) {
    const notification = await IncidentNotification.findOneAndUpdate(
      { ...baseQuery, recipient },
      { $setOnInsert: { ...baseQuery, recipient, message, status: 'queued', provider: provider.name } },
      { upsert: true, new: true },
    );
    if (notification.status === 'simulated' || notification.status === 'sent') continue;
    if (notification.status === 'queued') await writeNotificationAudit(actorId, notification._id, 'queued');
    let status: NotificationStatus = 'failed';
    let errorMessage: string | undefined;
    try {
      const result = await provider.send(recipient, message);
      status = result.status;
      errorMessage = result.errorMessage;
      await IncidentNotification.updateOne({ _id: notification._id }, {
        $set: { status, providerMessageId: result.providerMessageId, errorMessage, attemptedAt: new Date() },
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'SMS provider failed.';
      await IncidentNotification.updateOne({ _id: notification._id }, {
        $set: { status, errorMessage: errorMessage.slice(0, 500), attemptedAt: new Date() },
      });
    }
    await writeNotificationAudit(actorId, notification._id, status);
  }
}

export function createEmergencySmsNotifications(incidentId: string, actorId: string): Promise<void> {
  return createIncidentSmsNotifications(incidentId, 'sos', actorId);
}

export function createEscalationSmsNotifications(incidentId: string, actorId?: string): Promise<void> {
  return createIncidentSmsNotifications(incidentId, 'escalation', actorId);
}
