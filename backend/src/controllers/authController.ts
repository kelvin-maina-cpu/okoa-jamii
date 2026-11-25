import { Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { signRealtimeToken } from '../utils/jwt.js';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../utils/cookies.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getCurrentUser,
  getRolePermissions,
  login,
  logout,
  provisionAdminUser,
  refreshSession,
  registerCitizen,
} from '../services/authService.js';

function isTokenMode(req: Request): boolean {
  return req.header('x-auth-mode') === 'token';
}

function getRefreshTokenFromRequest(req: Request): string | undefined {
  if (typeof req.body?.refreshToken === 'string') return req.body.refreshToken;
  const cookieValue = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME];
  return cookieValue;
}

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerCitizen(req.body);

  if (isTokenMode(req)) {
    res.status(201).json(result);
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await login(req.body);

  if (isTokenMode(req)) {
    res.status(200).json(result);
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  const result = await refreshSession(refreshToken);

  if (isTokenMode(req)) {
    res.status(200).json(result);
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  await logout(refreshToken);
  clearRefreshCookie(res);
  res.status(200).json({ success: true });
});

export const meController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Authentication required', 401);
  const user = await getCurrentUser(req.auth.userId);
  const permissions = getRolePermissions(user.role);

  res.status(200).json({ user, permissions });
});

export const provisionAdminController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Authentication required', 401);
  const user = await provisionAdminUser(req.body, req.auth.userId);
  res.status(201).json({ user });
});

export const realtimeTicketController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth) throw new AppError('Authentication required', 401);
  res.status(200).json({ ticket: signRealtimeToken(req.auth.userId), expiresInSeconds: 300 });
});
