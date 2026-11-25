import { z } from 'zod';
import { INCIDENT_TYPES } from '../models/Incident.js';

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000;

const evidenceSchema = z.object({
  kind: z.enum(['photo', 'audio', 'video', 'document', 'other']),
  uri: z.string().trim().max(2000).optional(),
  providerKey: z.string().trim().max(500).optional(),
  checksum: z.string().trim().max(200).optional(),
  name: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  capturedAt: z.coerce.date().optional(),
});

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const occurredAtSchema = z.coerce
  .date()
  .optional()
  .refine(
    (value) => !value || value.getTime() <= Date.now() + MAX_FUTURE_SKEW_MS,
    { message: 'Occurrence time cannot be in the future' },
  )
  .refine(
    (value) => !value || value.getTime() >= Date.now() - MAX_PAST_MS,
    { message: 'Occurrence time cannot be more than 30 days in the past' },
  );

const clientGeneratedIdSchema = z.string().trim().min(8).max(128);
const addressOrAreaSchema = z.string().trim().min(3).max(500);
const evidenceListSchema = z.array(evidenceSchema).max(10).optional();

export const createIncidentSchema = z
  .object({
    incidentType: z.enum(INCIDENT_TYPES),
    description: z.string().trim().min(5).max(5000),
    location: locationSchema.optional(),
    addressOrArea: addressOrAreaSchema.optional(),
    occurredAt: occurredAtSchema,
    clientGeneratedId: clientGeneratedIdSchema,
    evidence: evidenceListSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.location && !value.addressOrArea) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['location'],
        message: 'GPS coordinates or a manual location description is required',
      });
    }
  });

export const createSosSchema = z.object({
  incidentType: z.enum(INCIDENT_TYPES).optional(),
  description: z.string().trim().min(5).max(5000).optional(),
  location: locationSchema,
  addressOrArea: addressOrAreaSchema.optional(),
  occurredAt: occurredAtSchema,
  clientGeneratedId: clientGeneratedIdSchema,
  evidence: evidenceListSchema,
});

export const myIncidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateIncidentPayload = z.infer<typeof createIncidentSchema>;
export type CreateSosPayload = z.infer<typeof createSosSchema>;
export type MyIncidentsQuery = z.infer<typeof myIncidentsQuerySchema>;

export const operationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'acknowledged', 'assigned', 'escalated', 'resolved']).optional(),
  incidentType: z.enum(INCIDENT_TYPES).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  search: z.string().trim().max(100).optional(),
  assignedToMe: z.coerce.boolean().default(false),
});
export const responseActionSchema = z.object({ note: z.string().trim().max(500).optional(), officerId: z.string().regex(/^[a-f\d]{24}$/i).optional() });
export const alertSchema = z.object({ title: z.string().trim().min(3).max(200), message: z.string().trim().min(5).max(5000), targetArea: z.string().trim().min(2).max(500) });
