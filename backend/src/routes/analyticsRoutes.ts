import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorize.js';
import { validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getIncidentAnalytics } from '../services/analyticsService.js';
import { analyticsQuerySchema } from '../validators/analyticsValidators.js';

export const analyticsRoutes = Router();
analyticsRoutes.use(requireAuth, requirePermission('viewAnalytics'));
analyticsRoutes.get('/incidents', validateQuery(analyticsQuerySchema), asyncHandler(async (_req, res) => {
  res.status(200).json(await getIncidentAnalytics(res.locals.query));
}));
