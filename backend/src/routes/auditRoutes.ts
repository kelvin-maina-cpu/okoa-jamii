import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorize.js';
import { validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAuditEvents } from '../services/auditService.js';
import { auditQuerySchema } from '../validators/analyticsValidators.js';

export const auditRoutes = Router();
auditRoutes.use(requireAuth, requirePermission('viewAuditLogs'));
auditRoutes.get('/', validateQuery(auditQuerySchema), asyncHandler(async (_req, res) => {
  res.status(200).json(await listAuditEvents(res.locals.query));
}));
