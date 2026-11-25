import { Document, model, models, Schema, Types } from 'mongoose';

export const NOTIFICATION_STATUSES = ['not_configured', 'queued', 'simulated', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface IIncidentNotification extends Document {
  incidentId: Types.ObjectId;
  eventType: 'sos' | 'escalation';
  channel: 'sms';
  recipient?: string;
  message: string;
  status: NotificationStatus;
  provider?: string;
  providerMessageId?: string;
  errorMessage?: string;
  attemptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const incidentNotificationSchema = new Schema<IIncidentNotification>({
  incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
  eventType: { type: String, enum: ['sos', 'escalation'], required: true, default: 'sos', index: true },
  channel: { type: String, enum: ['sms'], required: true, default: 'sms' },
  recipient: { type: String, trim: true, maxlength: 20 },
  message: { type: String, required: true, maxlength: 160 },
  status: { type: String, enum: NOTIFICATION_STATUSES, required: true, index: true },
  provider: { type: String, trim: true, maxlength: 50 },
  providerMessageId: { type: String, trim: true, maxlength: 200 },
  errorMessage: { type: String, trim: true, maxlength: 500 },
  attemptedAt: { type: Date },
}, { timestamps: true });

incidentNotificationSchema.index({ incidentId: 1, eventType: 1, recipient: 1, channel: 1 }, { unique: true });

export const IncidentNotification = models.IncidentNotification
  || model<IIncidentNotification>('IncidentNotification', incidentNotificationSchema);
