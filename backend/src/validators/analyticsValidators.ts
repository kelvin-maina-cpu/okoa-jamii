import { z } from 'zod';

const dateParam = z.coerce.date();
export const analyticsQuerySchema = z.object({
  from: dateParam.optional(),
  to: dateParam.optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'from must be before to' });
  if (value.to && value.to.getTime() > Date.now() + 60_000) ctx.addIssue({ code: 'custom', path: ['to'], message: 'to cannot be in the future' });
  if (value.from && value.from.getTime() > Date.now()) ctx.addIssue({ code: 'custom', path: ['from'], message: 'from cannot be in the future' });
  if (value.from && value.to && value.to.getTime() - value.from.getTime() > 366 * 24 * 60 * 60 * 1000) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Date range cannot exceed 366 days' });
});
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().min(3).max(100).optional(),
  from: dateParam.optional(),
  to: dateParam.optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'from must be before to' });
});
