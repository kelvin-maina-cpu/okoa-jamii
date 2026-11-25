import { Router } from 'express';
import {
  createIncidentController,
  createSosController,
  incidentDetailsController,
  myIncidentsController,
  operationsListController,
  officersController,
  responseActionController,
} from '../controllers/incidentController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRoles } from '../middleware/authorize.js';
import { UserRole } from '../types/roles.js';
import { incidentRateLimiter } from '../middleware/rateLimiters.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createIncidentSchema,
  createSosSchema,
  myIncidentsQuerySchema,
  operationsQuerySchema,
  responseActionSchema,
} from '../validators/incidentValidators.js';

const router = Router();

router.use(requireAuth);

const responseRoles: UserRole[] = ['Security Officer', 'County Administrator', 'Super Administrator'];

router.get('/operations', requirePermission('viewIncidents'), validateQuery(operationsQuerySchema), operationsListController);
router.get('/officers', requirePermission('assignIncidents'), officersController);
router.post('/:id/acknowledge', requirePermission('acknowledgeIncidents'), validateBody(responseActionSchema), responseActionController('acknowledge'));
router.post('/:id/assign', requirePermission('assignIncidents'), validateBody(responseActionSchema), responseActionController('assign'));
router.post('/:id/escalate', requirePermission('escalateIncidents'), validateBody(responseActionSchema), responseActionController('escalate'));
router.post('/:id/resolve', requirePermission('resolveIncidents'), validateBody(responseActionSchema), responseActionController('resolve'));
router.post('/:id/notes', requireRoles(responseRoles), validateBody(responseActionSchema), responseActionController('note'));

router.post('/', incidentRateLimiter, validateBody(createIncidentSchema), createIncidentController);
router.post('/sos', incidentRateLimiter, validateBody(createSosSchema), createSosController);
router.get('/my-incidents', validateQuery(myIncidentsQuerySchema), myIncidentsController);
router.get('/:id', incidentDetailsController);

export { router as incidentRoutes };
