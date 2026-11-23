import { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'okoa_refresh_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(res: Response, refreshToken: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/api/auth',
  });
}
