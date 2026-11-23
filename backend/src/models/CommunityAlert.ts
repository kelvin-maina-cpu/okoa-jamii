import { Schema, model, models, Document, Types } from 'mongoose';

export interface ICommunityAlert extends Document {
  title: string;
  message: string;
  targetArea: string;
  createdBy: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const communityAlertSchema = new Schema<ICommunityAlert>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  targetArea: { type: String, required: true, trim: true, maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  publishedAt: { type: Date, index: true },
}, { timestamps: true });

communityAlertSchema.index({ publishedAt: -1 });
export const CommunityAlert = models.CommunityAlert || model<ICommunityAlert>('CommunityAlert', communityAlertSchema);
