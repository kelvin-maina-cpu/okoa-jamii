import { Router } from 'express';
import {
  loginController,
  logoutController,
  meController,
  provisionAdminController,
  refreshController,
  registerController,
  realtimeTicketController,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRoles } from '../middleware/authorize.js';
import { authRateLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginSchema,
  logoutSchema,
  provisionAdminSchema,
  refreshSchema,
  registerSchema,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), registerController);
router.post('/login', authRateLimiter, validateBody(loginSchema), loginController);
router.post('/refresh', authRateLimiter, validateBody(refreshSchema), refreshController);
router.post('/logout', validateBody(logoutSchema), logoutController);
router.get('/me', requireAuth, meController);
router.post('/realtime-ticket', requireAuth, requirePermission('viewIncidents'), authRateLimiter, realtimeTicketController);

router.post(
  '/provision-admin',
  requireAuth,
  requireRoles(['Super Administrator']),
  requirePermission('manageUsers'),
  validateBody(provisionAdminSchema),
  provisionAdminController,
);

export { router as authRoutes };
