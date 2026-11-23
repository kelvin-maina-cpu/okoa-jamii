import { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { verifyAccessToken } from '../utils/jwt.js';

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    next(new AppError('Authentication required', 401));
    return;
  }

  const payload = verifyAccessToken(token);
  req.auth = { userId: payload.sub, role: payload.role };
  next();
}
