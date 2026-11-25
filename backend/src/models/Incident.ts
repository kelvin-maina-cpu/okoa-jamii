import { Schema, model, models, Document, Types } from 'mongoose';

export const INCIDENT_TYPES = ['armed attack', 'livestock theft', 'suspicious activity', 'missing person', 'medical emergency', 'community threat', 'other'] as const;
export const INCIDENT_STATUSES = ['pending', 'acknowledged', 'assigned', 'escalated', 'resolved'] as const;
export const INCIDENT_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const INCIDENT_SOURCES = ['mobile', 'dashboard', 'sms', 'provider'] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export interface GeoJsonPoint { type: 'Point'; coordinates: [number, number] }

export interface EvidenceMetadata {
  kind: string;
  uri?: string;
  providerKey?: string;
  checksum?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  capturedAt?: Date;
}

export interface StatusHistoryEntry {
  status: IncidentStatus;
  at: Date;
  by?: Types.ObjectId;
  note?: string;
}

export interface AssignmentHistoryEntry {
  officerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  at: Date;
  note?: string;
}

export interface IIncident extends Document {
  incidentType: IncidentType;
  description: string;
  reporterId: Types.ObjectId;
  location?: GeoJsonPoint;
  addressOrArea?: string;
  evidence: EvidenceMetadata[];
  status: IncidentStatus;
  priority: IncidentPriority;
  statusHistory: StatusHistoryEntry[];
  assignmentHistory: AssignmentHistoryEntry[];
  assignedOfficerId?: Types.ObjectId;
  assignedAt?: Date;
  autoEscalatedAt?: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  source: IncidentSource;
  clientGeneratedId: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<EvidenceMetadata>({
  kind: { type: String, required: true, trim: true },
  uri: { type: String, trim: true },
  providerKey: { type: String, trim: true },
  checksum: { type: String, trim: true },
  name: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String, trim: true, maxlength: 120 },
  sizeBytes: { type: Number, min: 0 },
  capturedAt: { type: Date },
}, { _id: false });

const statusHistorySchema = new Schema<StatusHistoryEntry>({
  status: { type: String, enum: INCIDENT_STATUSES, required: true },
  at: { type: Date, required: true },
  by: { type: Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const assignmentHistorySchema = new Schema<AssignmentHistoryEntry>({
  officerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const incidentSchema = new Schema<IIncident>({
  incidentType: { type: String, enum: INCIDENT_TYPES, required: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: undefined,
    },
    coordinates: {
      type: [Number],
      required: true,
      default: undefined,
      validate: [(value: number[]) => value.length === 2, 'Coordinates must be [longitude, latitude]'],
    },
  },
  addressOrArea: { type: String, trim: true, maxlength: 500 },
  evidence: { type: [evidenceSchema], default: [] },
  status: { type: String, enum: INCIDENT_STATUSES, default: 'pending', required: true, index: true },
  priority: { type: String, enum: INCIDENT_PRIORITIES, default: 'normal', required: true, index: true },
  statusHistory: { type: [statusHistorySchema], default: [] },
  assignmentHistory: { type: [assignmentHistorySchema], default: [] },
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date },
  autoEscalatedAt: { type: Date, index: true },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  source: { type: String, enum: INCIDENT_SOURCES, default: 'mobile', required: true },
  clientGeneratedId: { type: String, required: true, trim: true, maxlength: 128 },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ clientGeneratedId: 1, reporterId: 1 }, { unique: true });
incidentSchema.index({ reporterId: 1, createdAt: -1 });

export const Incident = models.Incident || model<IIncident>('Incident', incidentSchema);
