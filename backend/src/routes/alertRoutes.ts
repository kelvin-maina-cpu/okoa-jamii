import { Router } from 'express';
import { Types } from 'mongoose';
import { CommunityAlert } from '../models/CommunityAlert.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorize.js';
import { validateBody } from '../middleware/validate.js';
import { alertSchema } from '../validators/incidentValidators.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

export const alertRoutes = Router();
alertRoutes.use(requireAuth);
alertRoutes.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const admin = ['Community Leader', 'County Administrator', 'Super Administrator'].includes(req.auth!.role);
  const alerts = await CommunityAlert.find(admin ? { archivedAt: { $exists: false } } : { publishedAt: { $exists: true }, archivedAt: { $exists: false } }).sort({ publishedAt: -1, createdAt: -1 }).lean();
  res.json({ alerts });
}));
alertRoutes.post('/', requirePermission('publishCommunityAlerts'), validateBody(alertSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const alert = await CommunityAlert.create({ ...req.body, createdBy: new Types.ObjectId(req.auth!.userId) });
  await AuditLog.create({ actorId: new Types.ObjectId(req.auth!.userId), action: 'community_alert.created', resourceType: 'CommunityAlert', resourceId: alert._id, metadata: { targetArea: alert.targetArea } });
  res.status(201).json({ alert });
}));
alertRoutes.patch('/:id', requirePermission('publishCommunityAlerts'), validateBody(alertSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!Types.ObjectId.isValid(String(req.params.id))) throw new AppError('Alert not found', 404);
  const alert = await CommunityAlert.findOneAndUpdate({ _id: req.params.id, publishedAt: { $exists: false }, archivedAt: { $exists: false } }, req.body, { new: true, runValidators: true });
  if (!alert) throw new AppError('Draft alert not found', 404);
  await AuditLog.create({ actorId: new Types.ObjectId(req.auth!.userId), action: 'community_alert.updated', resourceType: 'CommunityAlert', resourceId: alert._id, metadata: {} });
  res.json({ alert });
}));
alertRoutes.post('/:id/publish', requirePermission('publishCommunityAlerts'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!Types.ObjectId.isValid(String(req.params.id))) throw new AppError('Alert not found', 404);
  const alert = await CommunityAlert.findOneAndUpdate({ _id: req.params.id, archivedAt: { $exists: false } }, { $set: { publishedAt: new Date() } }, { new: true });
  if (!alert) throw new AppError('Alert not found', 404);
  await AuditLog.create({ actorId: new Types.ObjectId(req.auth!.userId), action: 'community_alert.published', resourceType: 'CommunityAlert', resourceId: alert._id, metadata: { targetArea: alert.targetArea } });
  res.json({ alert });
}));
alertRoutes.post('/:id/archive', requirePermission('publishCommunityAlerts'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!Types.ObjectId.isValid(String(req.params.id))) throw new AppError('Alert not found', 404);
  const alert = await CommunityAlert.findByIdAndUpdate(req.params.id, { $set: { archivedAt: new Date() } }, { new: true });
  if (!alert) throw new AppError('Alert not found', 404);
  await AuditLog.create({ actorId: new Types.ObjectId(req.auth!.userId), action: 'community_alert.archived', resourceType: 'CommunityAlert', resourceId: alert._id, metadata: {} });
  res.json({ alert });
}));
