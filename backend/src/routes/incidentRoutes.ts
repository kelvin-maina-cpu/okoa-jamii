import { Router } from 'express';
import {
  createIncidentController,
  createSosController,
  incidentDetailsController,
  myIncidentsController,
} from '../controllers/incidentController.js';
import { requireAuth } from '../middleware/auth.js';
import { incidentRateLimiter } from '../middleware/rateLimiters.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createIncidentSchema,
  createSosSchema,
  myIncidentsQuerySchema,
} from '../validators/incidentValidators.js';

const router = Router();

router.use(requireAuth);

router.post('/', incidentRateLimiter, validateBody(createIncidentSchema), createIncidentController);
router.post('/sos', incidentRateLimiter, validateBody(createSosSchema), createSosController);
router.get('/my-incidents', validateQuery(myIncidentsQuerySchema), myIncidentsController);
router.get('/:id', incidentDetailsController);

export { router as incidentRoutes };
