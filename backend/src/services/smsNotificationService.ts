import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { Incident } from '../models/Incident.js';
import { IncidentNotification, NotificationStatus } from '../models/IncidentNotification.js';
import { readSmsConfiguration, MockSmsProvider, normalizeSmsMessage, SmsProvider } from './smsProviders.js';

function buildAlertMessage(reference: string, incidentType: string): string {
  return normalizeSmsMessage(`Okoa Jamii emergency report received by server: ${reference} (${incidentType}). Responder dispatch is not confirmed.`);
}

async function writeNotificationAudit(actorId: Types.ObjectId, notificationId: Types.ObjectId, status: NotificationStatus): Promise<void> {
  try {
    await AuditLog.create({
      actorId,
      action: 'incident.sms.notification',
      resourceType: 'IncidentNotification',
      resourceId: notificationId,
      metadata: { channel: 'sms', status },
    });
  } catch (error) {
    console.error('Unable to audit SMS notification status:', error instanceof Error ? error.message : error);
  }
}

/** Notification persistence and provider delivery happen after incident creation and cannot undo an SOS. */
export async function createEmergencySmsNotifications(incidentId: string, actorId: string): Promise<void> {
  const incident = await Incident.findById(incidentId).select('incidentType reporterId');
  if (!incident) return;
  const config = readSmsConfiguration();
  const message = buildAlertMessage(`OKJ-${incidentId.slice(-8).toUpperCase()}`, incident.incidentType);
  const provider: SmsProvider | null = config.provider === 'mock' && process.env.NODE_ENV !== 'production'
    ? new MockSmsProvider()
    : null;
  const recipients = config.recipients;

  if (!recipients.length || !provider) {
    const status: NotificationStatus = config.invalidRecipientCount > 0 ? 'failed' : 'not_configured';
    const update = config.invalidRecipientCount > 0
      ? { $set: { status, errorMessage: 'SMS recipient configuration contains invalid Kenyan mobile numbers.' } }
      : { $set: { status }, $unset: { errorMessage: 1 } };
    const notification = await IncidentNotification.findOneAndUpdate(
      { incidentId: incident._id, channel: 'sms', recipient: { $exists: false } },
      { ...update,
        $setOnInsert: { incidentId: incident._id, channel: 'sms', message, provider: config.provider } },
      { upsert: true, new: true },
    );
    await writeNotificationAudit(new Types.ObjectId(actorId), notification._id, status);
    return;
  }

  for (const recipient of recipients) {
    const notification = await IncidentNotification.findOneAndUpdate(
      { incidentId: incident._id, channel: 'sms', recipient },
      { $setOnInsert: { incidentId: incident._id, channel: 'sms', recipient, message, status: 'queued', provider: provider.name } },
      { upsert: true, new: true },
    );
    if (notification.status === 'queued') await writeNotificationAudit(new Types.ObjectId(actorId), notification._id, 'queued');
    if (notification.status === 'simulated' || notification.status === 'sent') continue;
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
    await writeNotificationAudit(new Types.ObjectId(actorId), notification._id, status);
  }
}
