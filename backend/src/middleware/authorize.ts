import { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { hasPermission, Permission } from '../types/permissions.js';
import { UserRole } from '../types/roles.js';

export function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new AppError('Forbidden', 403));
      return;
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!hasPermission(req.auth.role, permission)) {
      next(new AppError('Forbidden', 403));
      return;
    }

    next();
  };
}
