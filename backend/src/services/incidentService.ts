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
import { User } from '../models/User.js';
import { createEscalationSmsNotifications } from './smsNotificationService.js';
import { broadcastIncidentEvent } from './realtimeService.js';
import { createIncidentInAppNotifications } from './inAppNotificationService.js';
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
  assignedOfficerId?: string;
  assignmentHistory?: Array<{ officerId: string; assignedBy: string; at: string; note?: string }>;
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
    assignedOfficerId: incident.assignedOfficerId?.toString(),
    assignmentHistory: (incident.assignmentHistory ?? []).map((a) => ({ officerId: a.officerId.toString(), assignedBy: a.assignedBy.toString(), at: iso(a.at) ?? '', note: a.note })),
  };
}

function redactIncidentForReporter(response: IncidentResponse): IncidentResponse {
  return {
    ...response,
    statusHistory: response.statusHistory.map(({ status, at }) => ({ status, at })),
    assignmentHistory: [],
    assignedOfficerId: undefined,
    evidence: response.evidence.map(({ kind, name, mimeType, sizeBytes, capturedAt }) => ({ kind, name, mimeType, sizeBytes, capturedAt })),
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
  broadcastIncidentEvent('created', incident._id.toString());
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
    incidents: (rows as StoredIncident[]).map((row) => redactIncidentForReporter(serializeIncident(row))),
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

  const response = serializeIncident(incident);
  return hasPermission(role, 'viewIncidents') ? response : redactIncidentForReporter(response);
}

export async function listOperationsIncidents(query: Record<string, any>, userId: string, role: UserRole) {
  const filter: Record<string, any> = {};
  if (query.status) filter.status = query.status;
  if (query.incidentType) filter.incidentType = query.incidentType;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedToMe) filter.assignedOfficerId = new Types.ObjectId(userId);
  if (query.search) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
    { description: { $regex: escapedSearch, $options: 'i' } },
    { addressOrArea: { $regex: escapedSearch, $options: 'i' } },
    { incidentType: { $regex: escapedSearch, $options: 'i' } },
  ];
  }
  const page = query.page ?? 1; const limit = query.limit ?? 20;
  const [incidents, total, statusCounts, priorityCounts, recent] = await Promise.all([
    Incident.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('reporterId', 'fullName').populate('assignedOfficerId', 'fullName role').lean(),
    Incident.countDocuments(filter),
    Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Incident.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Incident.find().sort({ updatedAt: -1 }).limit(8).select('incidentType status updatedAt priority').lean(),
  ]);
  const rows = incidents.map((i: any) => ({ ...i, id: String(i._id), reporter: i.reporterId, reporterId: i.reporterId?._id ?? i.reporterId, assignedOfficer: i.assignedOfficerId, assignedOfficerId: i.assignedOfficerId?._id ?? i.assignedOfficerId, coordinates: i.location?.coordinates ?? null, location: i.location?.coordinates?.length === 2 ? { latitude: i.location.coordinates[1], longitude: i.location.coordinates[0] } : null }));
  return { incidents: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total }, summary: { total: await Incident.countDocuments(), byStatus: Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count])), byPriority: Object.fromEntries(priorityCounts.map((s: any) => [s._id, s.count])), recent } };
}

export async function listEligibleOfficers() {
  return User.find({ role: 'Security Officer', isActive: true }).select('_id fullName').sort({ fullName: 1 }).lean();
}

async function responseAudit(userId: string, incident: any, action: string, metadata: Record<string, unknown> = {}) {
  await AuditLog.create({ actorId: new Types.ObjectId(userId), action, resourceType: 'Incident', resourceId: incident._id, metadata });
}

export async function respondToIncident(id: string, userId: string, action: 'acknowledge'|'assign'|'escalate'|'resolve'|'note', input: { note?: string; officerId?: string }) {
  if (!isValidObjectId(id)) throw new AppError('Incident not found', 404);
  const incident = await Incident.findById(id);
  if (!incident) throw new AppError('Incident not found', 404);
  const now = new Date(); const note = input.note?.trim();
  if (action === 'acknowledge') {
    if (incident.status !== 'pending') throw new AppError('Only pending incidents can be acknowledged', 409);
    incident.status = 'acknowledged'; incident.acknowledgedAt = now;
  } else if (action === 'assign') {
    if (!input.officerId || !isValidObjectId(input.officerId)) throw new AppError('A valid officerId is required', 400);
    const officer = await User.findOne({ _id: input.officerId, role: 'Security Officer', isActive: true });
    if (!officer) throw new AppError('Officer is not active or eligible for assignment', 422);
    incident.assignedOfficerId = officer._id; incident.assignedAt = now;
    incident.assignmentHistory.push({ officerId: officer._id, assignedBy: new Types.ObjectId(userId), at: now, note });
    if (incident.status === 'pending' || incident.status === 'acknowledged') incident.status = 'assigned';
  } else if (action === 'escalate') {
    if (incident.status === 'resolved') throw new AppError('Resolved incidents cannot be escalated', 409);
    if (incident.status === 'escalated') throw new AppError('Incident is already escalated', 409);
    incident.status = 'escalated';
  } else if (action === 'resolve') {
    if (incident.status === 'resolved') throw new AppError('Incident is already resolved', 409);
    incident.status = 'resolved'; incident.resolvedAt = now;
  }
  if (action === 'note') {
    if (!note) throw new AppError('A note is required', 400);
    incident.statusHistory.push({ status: incident.status, at: now, by: new Types.ObjectId(userId), note });
  } else {
    incident.statusHistory.push({ status: incident.status, at: now, by: new Types.ObjectId(userId), note: note ?? `Incident ${action}d` });
  }
  await incident.save();
  await responseAudit(userId, incident, `incident.${action}`, { status: incident.status, hasNote: Boolean(note), officerId: input.officerId });
  if (action !== 'note') {
    const notificationEvent = action === 'acknowledge' ? 'acknowledged' : action === 'assign' ? 'assigned' : action === 'escalate' ? 'escalated' : 'resolved';
    await createIncidentInAppNotifications({ incidentId: incident._id, reporterId: incident.reporterId,
      assignedOfficerId: incident.assignedOfficerId, eventType: notificationEvent, eventKey: `${incident._id}:${action}:${now.getTime()}`, actorId: userId,
    }).catch((error) => console.error('Unable to create in-app incident notification:', error instanceof Error ? error.message : error));
  }
  const realtimeType = action === 'assign' ? 'assigned' : action === 'escalate' ? 'escalated' : action === 'resolve' ? 'resolved' : 'status_changed';
  broadcastIncidentEvent(realtimeType, incident._id.toString());
  if (action === 'escalate') await createEscalationSmsNotifications(id, userId).catch((e) => console.error('Escalation notifications failed:', e));
  return incident;
}

export async function autoEscalateStaleIncidents() {
  const minutes = Math.max(1, Number(process.env.INCIDENT_ESCALATION_AFTER_MINUTES || 30));
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await Incident.find({ status: { $in: ['pending', 'acknowledged'] }, createdAt: { $lte: cutoff }, autoEscalatedAt: { $exists: false } }).select('_id').lean();
  for (const row of stale) {
    const now = new Date();
    const updated = await Incident.findOneAndUpdate({ _id: row._id, status: { $in: ['pending', 'acknowledged'] }, autoEscalatedAt: { $exists: false } }, { $set: { status: 'escalated', autoEscalatedAt: now }, $push: { statusHistory: { status: 'escalated', at: now, note: `Automatically escalated after ${minutes} minutes without resolution` } } }, { new: true });
    if (!updated) continue;
    await AuditLog.create({ actorType: 'system', action: 'incident.auto_escalated', resourceType: 'Incident', resourceId: updated._id, metadata: { minutes } });
    await createIncidentInAppNotifications({ incidentId: updated._id, reporterId: updated.reporterId,
      assignedOfficerId: updated.assignedOfficerId, eventType: 'escalated', eventKey: `${updated._id}:auto_escalated:${updated.autoEscalatedAt?.getTime() ?? now.getTime()}`,
    }).catch((error) => console.error('Unable to notify reporter about escalation:', error instanceof Error ? error.message : error));
    broadcastIncidentEvent('escalated', String(updated._id));
    await createEscalationSmsNotifications(String(updated._id), undefined).catch((e) => console.error('Auto escalation notification failed:', e));
  }
  return stale.length;
}
