import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

export function recordAuditEvent(input: {
  actorId?: string;
  actorType?: 'user' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string | Types.ObjectId;
  metadata?: Record<string, unknown>;
}): void {
  if (AuditLog.db.readyState !== 1) {
    console.error('Audit event skipped because the database is not connected.');
    return;
  }
  void AuditLog.create({
    ...(input.actorId ? { actorId: new Types.ObjectId(input.actorId) } : {}),
    actorType: input.actorType ?? 'user', action: input.action, resourceType: input.resourceType,
    resourceId: input.resourceId ?? input.actorId ?? 'system', metadata: input.metadata ?? {},
  }).catch((error) => console.error('Unable to record audit event:', error instanceof Error ? error.message : error));
}

const SENSITIVE_KEY = /(password|token|secret|credential|email|phone|note|description|coordinate|location|uri)/i;
function safeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(Object.entries(metadata as Record<string, unknown>).filter(([key]) => !SENSITIVE_KEY.test(key)));
}

export async function listAuditEvents(input: { page: number; limit: number; action?: string; from?: Date; to?: Date }) {
  const filter: Record<string, unknown> = {};
  if (input.action) filter.action = input.action;
  if (input.from || input.to) filter.createdAt = { ...(input.from ? { $gte: input.from } : {}), ...(input.to ? { $lte: input.to } : {}) };
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).select('actorId actorType action resourceType resourceId metadata createdAt').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { events: rows.map((row: any) => ({ ...row, metadata: safeMetadata(row.metadata) })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
}
