import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { UserRole } from '../types/roles.js';
import { AppError } from '../errors/AppError.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  tokenType: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  tokenType: 'refresh';
}

export interface RealtimeTokenPayload extends JwtPayload {
  sub: string;
  tokenType: 'realtime';
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('Server auth configuration is missing', 500);
  if (process.env.NODE_ENV === 'production' && secret.length < 32) throw new AppError('Server auth configuration is invalid', 500);
  return secret;
}

export function signAccessToken(userId: string, role: UserRole, expiresIn = '15m'): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId, role, tokenType: 'access' }, getJwtSecret(), options);
}

export function signRefreshToken(userId: string, jti: string, expiresIn = '7d'): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId, jti, tokenType: 'refresh' }, getJwtSecret(), options);
}

export function signRealtimeToken(userId: string, expiresIn = '5m'): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'], audience: 'okoa-jamii-dashboard-realtime' };
  return jwt.sign({ sub: userId, tokenType: 'realtime' }, getJwtSecret(), options);
}

export function verifyRealtimeToken(token: string): RealtimeTokenPayload {
  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret, { audience: 'okoa-jamii-dashboard-realtime' }) as RealtimeTokenPayload;
    if (payload.tokenType !== 'realtime' || typeof payload.sub !== 'string') throw new AppError('Invalid real-time ticket', 401);
    return payload;
  } catch {
    throw new AppError('Invalid or expired real-time ticket', 401);
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret) as AccessTokenPayload;
    if (payload.tokenType !== 'access') throw new AppError('Invalid access token', 401);
    return payload;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret) as RefreshTokenPayload;
    if (payload.tokenType !== 'refresh') throw new AppError('Invalid refresh token', 401);
    return payload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
}
