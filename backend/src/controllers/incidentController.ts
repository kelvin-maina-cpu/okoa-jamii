import { Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createIncidentReport,
  createSosReport,
  getIncidentForUser,
  listMyIncidents,
  listOperationsIncidents,
  listEligibleOfficers,
  respondToIncident,
} from '../services/incidentService.js';
import { MyIncidentsQuery } from '../validators/incidentValidators.js';
import { createEmergencySmsNotifications } from '../services/smsNotificationService.js';

function requireAuthContext(req: AuthenticatedRequest) {
  if (!req.auth) throw new AppError('Authentication required', 401);
  return req.auth;
}

export const createIncidentController = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  const result = await createIncidentReport(auth.userId, req.body);

  res.status(result.duplicate ? 200 : 201).json({
    incident: result.incident,
    duplicate: result.duplicate,
    message: result.duplicate
      ? 'This report was already received. The original report is shown.'
      : 'Incident report received.',
  });
});

export const createSosController = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  const result = await createSosReport(auth.userId, req.body);
  if (!result.duplicate) {
    // Delivery tracking is separate and best-effort; notification failure never rejects the saved SOS.
    await createEmergencySmsNotifications(result.incident.id, auth.userId).catch((error) => {
      console.error('Unable to create SMS notification record for SOS:', error instanceof Error ? error.message : error);
    });
  }

  res.status(result.duplicate ? 200 : 201).json({
    incident: result.incident,
    duplicate: result.duplicate,
    message: result.duplicate
      ? 'This SOS was already received. The original alert is shown.'
      : 'Emergency SOS received by the server.',
  });
});

export const myIncidentsController = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  const query = res.locals.query as MyIncidentsQuery;
  const result = await listMyIncidents(auth.userId, query.page, query.limit);

  res.status(200).json(result);
});

export const incidentDetailsController = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  const incident = await getIncidentForUser(auth.userId, auth.role, String(req.params.id));

  res.status(200).json({ incident });
});

export const operationsListController = asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  res.status(200).json(await listOperationsIncidents(res.locals.query, auth.userId, auth.role));
});
export const officersController = asyncHandler<AuthenticatedRequest>(async (_req, res: Response) => {
  res.status(200).json({ officers: await listEligibleOfficers() });
});
export const responseActionController = (action: 'acknowledge'|'assign'|'escalate'|'resolve'|'note') => asyncHandler<AuthenticatedRequest>(async (req, res: Response) => {
  const auth = requireAuthContext(req);
  const incident = await respondToIncident(String(req.params.id), auth.userId, action, req.body);
  res.status(200).json({ incident, message: `Incident ${action} recorded.` });
});
