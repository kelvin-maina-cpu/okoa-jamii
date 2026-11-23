import { Schema, model, models, Document, Types } from 'mongoose';

export const INCIDENT_TYPES = ['armed attack', 'livestock theft', 'suspicious activity', 'missing person', 'medical emergency', 'community threat', 'other'] as const;
export const INCIDENT_STATUSES = ['pending', 'acknowledged', 'assigned', 'escalated', 'resolved'] as const;
export const INCIDENT_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const INCIDENT_SOURCES = ['mobile', 'dashboard', 'sms', 'provider'] as const;

export interface GeoJsonPoint { type: 'Point'; coordinates: [number, number] }
export interface EvidenceMetadata { kind: string; uri?: string; providerKey?: string; checksum?: string; capturedAt?: Date }

export interface IIncident extends Document {
  incidentType: (typeof INCIDENT_TYPES)[number];
  description: string;
  reporterId: Types.ObjectId;
  location: GeoJsonPoint;
  addressOrArea?: string;
  evidence: EvidenceMetadata[];
  status: (typeof INCIDENT_STATUSES)[number];
  priority: (typeof INCIDENT_PRIORITIES)[number];
  assignedOfficerId?: Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  source: (typeof INCIDENT_SOURCES)[number];
  clientGeneratedId: string;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<EvidenceMetadata>({
  kind: { type: String, required: true, trim: true },
  uri: { type: String, trim: true },
  providerKey: { type: String, trim: true },
  checksum: { type: String, trim: true },
  capturedAt: { type: Date },
}, { _id: false });

const incidentSchema = new Schema<IIncident>({
  incidentType: { type: String, enum: INCIDENT_TYPES, required: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true, validate: [(value: number[]) => value.length === 2, 'Coordinates must be [longitude, latitude]'] },
  },
  addressOrArea: { type: String, trim: true, maxlength: 500 },
  evidence: { type: [evidenceSchema], default: [] },
  status: { type: String, enum: INCIDENT_STATUSES, default: 'pending', required: true, index: true },
  priority: { type: String, enum: INCIDENT_PRIORITIES, default: 'normal', required: true, index: true },
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  acknowledgedAt: { type: Date }, resolvedAt: { type: Date },
  source: { type: String, enum: INCIDENT_SOURCES, default: 'mobile', required: true },
  clientGeneratedId: { type: String, required: true, trim: true },
}, { timestamps: true });

incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ clientGeneratedId: 1, reporterId: 1 }, { unique: true });

export const Incident = models.Incident || model<IIncident>('Incident', incidentSchema);
