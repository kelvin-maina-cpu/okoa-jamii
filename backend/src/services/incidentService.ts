import { isValidObjectId, Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  IIncident,
  Incident,
  IncidentStatus,
} from '../models/Incident.js';
import { hasPermission } from '../types/permissions.js';
import { UserRole } from '../types/roles.js';
import { CreateIncidentPayload, CreateSosPayload } from '../validators/incidentValidators.js';

const DUPLICATE_KEY_CODE = 11000;
const SOS_DEFAULT_DESCRIPTION = 'Emergency SOS activated. Immediate assistance requested.';

export interface IncidentLocationResponse {
  latitude: number;
  longitude: number;
}

export interface IncidentResponse {
  id: string;
  reference: string;
  incidentType: string;
  description: string;
  reporterId: string;
  location: IncidentLocationResponse | null;
  coordinates: [number, number] | null;
  addressOrArea?: string;
  evidence: Array<{
    kind: string;
    uri?: string;
    providerKey?: string;
    checksum?: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    capturedAt?: string;
  }>;
  status: IncidentStatus;
  priority: string;
  statusHistory: Array<{ status: IncidentStatus; at: string; note?: string }>;
  source: string;
  clientGeneratedId: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface IncidentMutationResult {
  incident: IncidentResponse;
  duplicate: boolean;
}

type StoredIncident = IIncident & { _id: Types.ObjectId };

function iso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function lastEight(id: string): string {
  return id.slice(-8).toUpperCase();
}

export function serializeIncident(incident: StoredIncident): IncidentResponse {
  const id = incident._id.toString();
  const point = incident.location;

  return {
    id,
    reference: `OKJ-${lastEight(id)}`,
    incidentType: incident.incidentType,
    description: incident.description,
    reporterId: incident.reporterId?.toString(),
    location: point?.coordinates?.length === 2
      ? { latitude: point.coordinates[1], longitude: point.coordinates[0] }
      : null,
    coordinates: point?.coordinates?.length === 2
      ? [point.coordinates[0], point.coordinates[1]]
      : null,
    addressOrArea: incident.addressOrArea,
    evidence: (incident.evidence ?? []).map((item) => ({
      kind: item.kind,
      uri: item.uri,
      providerKey: item.providerKey,
      checksum: item.checksum,
      name: item.name,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      capturedAt: iso(item.capturedAt),
    })),
    status: incident.status,
    priority: incident.priority,
    statusHistory: (incident.statusHistory ?? []).map((entry) => ({
      status: entry.status,
      at: iso(entry.at) ?? new Date().toISOString(),
      note: entry.note,
    })),
    source: incident.source,
    clientGeneratedId: incident.clientGeneratedId,
    occurredAt: iso(incident.occurredAt) ?? iso(incident.createdAt) ?? new Date().toISOString(),
    createdAt: iso(incident.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(incident.updatedAt) ?? iso(incident.createdAt) ?? new Date().toISOString(),
  };
}

function buildLocation(input: { latitude: number; longitude: number } | undefined) {
  if (!input) return undefined;
  return {
    type: 'Point' as const,
    coordinates: [input.longitude, input.latitude] as [number, number],
  };
}

function buildEvidence(input: CreateIncidentPayload['evidence']) {
  return (input ?? []).map((item) => ({
    kind: item.kind,
    uri: item.uri,
    providerKey: item.providerKey,
    checksum: item.checksum,
    name: item.name,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    capturedAt: item.capturedAt,
  }));
}

async function writeAudit(incident: StoredIncident, action: string): Promise<void> {
  try {
    await AuditLog.create({
      actorId: incident.reporterId,
      action,
      resourceType: 'Incident',
      resourceId: incident._id,
      metadata: {
        incidentType: incident.incidentType,
        priority: incident.priority,
        status: incident.status,
        hasLocation: Boolean(incident.location),
        evidenceCount: incident.evidence?.length ?? 0,
      },
    });
  } catch (error) {
    // Never lose an emergency report because the audit write failed.
    console.error('Unable to write incident audit record:', error instanceof Error ? error.message : error);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === DUPLICATE_KEY_CODE;
}

async function findExistingReport(reporterId: string, clientGeneratedId: string): Promise<StoredIncident | null> {
  return (await Incident.findOne({
    reporterId: new Types.ObjectId(reporterId),
    clientGeneratedId,
  })) as StoredIncident | null;
}

async function persistIncident(
  reporterId: string,
  create: () => Promise<StoredIncident>,
  options: { clientGeneratedId: string; action: string },
): Promise<IncidentMutationResult> {
  const existing = await findExistingReport(reporterId, options.clientGeneratedId);
  if (existing) {
    return { incident: serializeIncident(existing), duplicate: true };
  }

  let incident: StoredIncident;
  try {
    incident = await create();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const raced = await findExistingReport(reporterId, options.clientGeneratedId);
      if (raced) return { incident: serializeIncident(raced), duplicate: true };
    }
    throw error;
  }

  await writeAudit(incident, options.action);
  return { incident: serializeIncident(incident), duplicate: false };
}

export async function createIncidentReport(
  reporterId: string,
  input: CreateIncidentPayload,
): Promise<IncidentMutationResult> {
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  return persistIncident(
    reporterId,
    async () => (await Incident.create({
      incidentType: input.incidentType,
      description: input.description,
      reporterId: new Types.ObjectId(reporterId),
      location: buildLocation(input.location),
      addressOrArea: input.addressOrArea,
      evidence: buildEvidence(input.evidence),
      status: 'pending',
      priority: 'normal',
      statusHistory: [{ status: 'pending', at: now, by: new Types.ObjectId(reporterId), note: 'Report created by citizen' }],
      source: 'mobile',
      clientGeneratedId: input.clientGeneratedId,
      occurredAt,
    })) as StoredIncident,
    { clientGeneratedId: input.clientGeneratedId, action: 'incident.created' },
  );
}

export async function createSosReport(
  reporterId: string,
  input: CreateSosPayload,
): Promise<IncidentMutationResult> {
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  return persistIncident(
    reporterId,
    async () => (await Incident.create({
      incidentType: input.incidentType ?? 'other',
      description: input.description ?? SOS_DEFAULT_DESCRIPTION,
      reporterId: new Types.ObjectId(reporterId),
      location: buildLocation(input.location),
      addressOrArea: input.addressOrArea,
      evidence: buildEvidence(input.evidence),
      status: 'pending',
      priority: 'critical',
      statusHistory: [{ status: 'pending', at: now, by: new Types.ObjectId(reporterId), note: 'Emergency SOS activated' }],
      source: 'mobile',
      clientGeneratedId: input.clientGeneratedId,
      occurredAt,
    })) as StoredIncident,
    { clientGeneratedId: input.clientGeneratedId, action: 'incident.sos.created' },
  );
}

export async function listMyIncidents(
  reporterId: string,
  page: number,
  limit: number,
): Promise<{ incidents: IncidentResponse[]; pagination: PaginationInfo }> {
  const filter = { reporterId: new Types.ObjectId(reporterId) };
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    Incident.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Incident.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    incidents: (rows as StoredIncident[]).map(serializeIncident),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getIncidentForUser(
  userId: string,
  role: UserRole,
  incidentId: string,
): Promise<IncidentResponse> {
  if (!isValidObjectId(incidentId)) {
    throw new AppError('Incident not found', 404);
  }

  const incident = (await Incident.findById(incidentId)) as StoredIncident | null;
  if (!incident) {
    throw new AppError('Incident not found', 404);
  }

  const isOwner = incident.reporterId?.toString() === userId;
  if (!isOwner && !hasPermission(role, 'viewIncidents')) {
    throw new AppError('You do not have access to this incident', 403);
  }

  return serializeIncident(incident);
}
