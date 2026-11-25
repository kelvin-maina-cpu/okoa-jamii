import { Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createIncidentReport,
  createSosReport,
  getIncidentForUser,
  listMyIncidents,
} from '../services/incidentService.js';
import { MyIncidentsQuery } from '../validators/incidentValidators.js';

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
