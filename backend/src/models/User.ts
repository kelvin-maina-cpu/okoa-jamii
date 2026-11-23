import { Schema, model, models, Document, Types } from 'mongoose';
import { USER_ROLES, UserRole } from '../types/roles.js';

export interface EmergencyContact { name: string; phone: string; relationship?: string }

export interface IUser extends Document {
  fullName: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  emergencyContacts: EmergencyContact[];
  preferredLanguage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emergencyContactSchema = new Schema<EmergencyContact>({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  relationship: { type: String, trim: true },
}, { _id: false });

const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  phone: { type: String, trim: true, sparse: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, required: true, default: 'Citizen' },
  emergencyContacts: { type: [emergencyContactSchema], default: [] },
  preferredLanguage: { type: String, trim: true, default: 'en' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (!this.email && !this.phone) {
    throw new Error('User requires an email or phone');
  }
});

export const User = models.User || model<IUser>('User', userSchema);
