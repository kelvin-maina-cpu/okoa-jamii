import { Document, model, models, Schema, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  tokenId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    tokenId: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    replacedByTokenId: { type: String },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export const RefreshToken = models.RefreshToken || model<IRefreshToken>('RefreshToken', refreshTokenSchema);
