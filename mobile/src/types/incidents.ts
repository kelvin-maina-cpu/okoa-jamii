export const INCIDENT_TYPES = [
  'armed attack',
  'livestock theft',
  'suspicious activity',
  'missing person',
  'medical emergency',
  'community threat',
  'other',
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export type IncidentStatus = 'pending' | 'acknowledged' | 'assigned' | 'escalated' | 'resolved';
export type IncidentPriority = 'low' | 'normal' | 'high' | 'critical';
export type EvidenceKind = 'photo' | 'audio' | 'video' | 'document' | 'other';

export interface IncidentLocation {
  latitude: number;
  longitude: number;
}

export interface IncidentEvidence {
  kind: EvidenceKind;
  uri?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  capturedAt?: string;
}

export interface CreateIncidentInput {
  incidentType: IncidentType;
  description: string;
  location?: IncidentLocation;
  addressOrArea?: string;
  occurredAt: string;
  clientGeneratedId: string;
  evidence?: IncidentEvidence[];
}

export interface StatusHistoryEntry {
  status: IncidentStatus;
  at: string;
  note?: string;
}

export interface IncidentRecord {
  id: string;
  reference: string;
  incidentType: IncidentType;
  description: string;
  reporterId: string;
  location: IncidentLocation | null;
  coordinates: [number, number] | null;
  addressOrArea?: string;
  evidence: IncidentEvidence[];
  status: IncidentStatus;
  priority: IncidentPriority;
  statusHistory: StatusHistoryEntry[];
  source: string;
  clientGeneratedId: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentListResponse {
  incidents: IncidentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface IncidentMutationResponse {
  incident: IncidentRecord;
  duplicate: boolean;
  message: string;
}

export type SubmissionOutcome = 'delivered' | 'queued' | 'failed';

export interface SubmissionResultParams {
  outcome: SubmissionOutcome;
  incidentType: IncidentType;
  reference?: string;
  incidentId?: string;
  localId?: string;
  message: string;
  detail?: string;
}

export type QueueEndpoint = 'incident' | 'sos';

export interface QueuedIncident {
  localId: string;
  reporterId?: string;
  endpoint: QueueEndpoint;
  payload: CreateIncidentInput;
  createdAt: string;
  syncStatus: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastAttemptAt?: string;
  serverIncidentId?: string;
  errorMessage?: string;
}
