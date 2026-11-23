import { Request } from 'express';
import { UserRole } from './roles.js';

export interface AuthContext {
  userId: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
