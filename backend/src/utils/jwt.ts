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

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('Server auth configuration is missing', 500);
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

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    if (payload.tokenType !== 'access') throw new AppError('Invalid access token', 401);
    return payload;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as RefreshTokenPayload;
    if (payload.tokenType !== 'refresh') throw new AppError('Invalid refresh token', 401);
    return payload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
}
