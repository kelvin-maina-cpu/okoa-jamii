import { Document, model, models, Schema, Types } from 'mongoose';

export type InAppEventType = 'acknowledged' | 'assigned' | 'escalated' | 'resolved';
export interface IUserNotification extends Document {
  userId: Types.ObjectId;
  incidentId: Types.ObjectId;
  eventType: InAppEventType;
  reference: string;
  message: string;
  dedupeKey: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<IUserNotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
  eventType: { type: String, enum: ['acknowledged', 'assigned', 'escalated', 'resolved'], required: true },
  reference: { type: String, required: true, maxlength: 20 },
  message: { type: String, required: true, maxlength: 200 },
  dedupeKey: { type: String, required: true, maxlength: 200 },
  readAt: { type: Date },
}, { timestamps: true });
schema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
export const InAppNotification = models.InAppNotification || model<IUserNotification>('InAppNotification', schema);
