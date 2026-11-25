import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { listMyNotifications, markMyNotificationRead } from '../services/inAppNotificationService.js';

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);
notificationRoutes.get('/', validateQuery(querySchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.status(200).json(await listMyNotifications(req.auth!.userId, res.locals.query.page, res.locals.query.limit));
}));
notificationRoutes.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.status(200).json({ notification: await markMyNotificationRead(req.auth!.userId, String(req.params.id)) });
}));
