import { Schema, model, models, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  actorId?: Types.ObjectId;
  actorType: 'user' | 'system';
  action: string;
  resourceType: string;
  resourceId: Types.ObjectId | string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actorType: { type: String, enum: ['user', 'system'], default: 'user', required: true, index: true },
  action: { type: String, required: true, trim: true, maxlength: 100 },
  resourceType: { type: String, required: true, trim: true, maxlength: 100 },
  resourceId: { type: Schema.Types.Mixed, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });
export const AuditLog = models.AuditLog || model<IAuditLog>('AuditLog', auditLogSchema);
