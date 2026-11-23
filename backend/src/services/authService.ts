import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User, IUser } from '../models/User.js';
import { Permission, ROLE_PERMISSIONS } from '../types/permissions.js';
import { UserRole } from '../types/roles.js';
import { randomId, sha256 } from '../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

export interface PublicUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

interface SessionBundle extends AuthResult {
  refreshTokenId: string;
}

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';
const LOGIN_ERROR = 'Invalid credentials';

function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function buildSession(user: IUser): Promise<SessionBundle> {
  const tokenId = randomId(16);
  const refreshToken = signRefreshToken(user._id.toString(), tokenId, REFRESH_TOKEN_TTL);
  const refreshTokenHash = sha256(refreshToken);
  const decoded = verifyRefreshToken(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    tokenId,
    expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user._id.toString(), user.role, ACCESS_TOKEN_TTL),
    refreshToken,
    refreshTokenId: tokenId,
  };
}

export async function registerCitizen(input: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  preferredLanguage?: string;
}): Promise<AuthResult> {
  const normalizedEmail = input.email?.toLowerCase().trim();
  const normalizedPhone = input.phone?.trim();

  const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }].filter((item) => Object.values(item)[0]) });
  if (existing) {
    throw new AppError('A user with this identifier already exists', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    fullName: input.fullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    passwordHash,
    role: 'Citizen',
    preferredLanguage: input.preferredLanguage || 'en',
  });

  const session = await buildSession(user);
  return { user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken };
}

export async function provisionAdminUser(input: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  role: Exclude<UserRole, 'Citizen'>;
}): Promise<PublicUser> {
  const normalizedEmail = input.email?.toLowerCase().trim();
  const normalizedPhone = input.phone?.trim();
  const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }].filter((item) => Object.values(item)[0]) });
  if (existing) {
    throw new AppError('A user with this identifier already exists', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    fullName: input.fullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    passwordHash,
    role: input.role,
  });

  return toPublicUser(user);
}

export async function login(input: { emailOrPhone: string; password: string }): Promise<AuthResult> {
  const identifier = input.emailOrPhone.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: input.emailOrPhone.trim() }],
  }).select('+passwordHash');

  if (!user || !user.passwordHash || !user.isActive) {
    throw new AppError(LOGIN_ERROR, 401);
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError(LOGIN_ERROR, 401);
  }

  const session = await buildSession(user);
  return { user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken };
}

export async function refreshSession(rawRefreshToken: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(rawRefreshToken);
  const tokenHash = sha256(rawRefreshToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash });

  if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt.getTime() <= Date.now()) {
    if (payload.sub) {
      await RefreshToken.updateMany({ userId: new Types.ObjectId(payload.sub), revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user || !user.isActive) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const nextSession = await buildSession(user);

  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedByTokenId = nextSession.refreshTokenId;
  await tokenRecord.save();

  return {
    user: nextSession.user,
    accessToken: nextSession.accessToken,
    refreshToken: nextSession.refreshToken,
  };
}

export async function logout(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) return;

  const tokenHash = sha256(rawRefreshToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash });
  if (!tokenRecord || tokenRecord.revokedAt) return;

  tokenRecord.revokedAt = new Date();
  await tokenRecord.save();
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  return toPublicUser(user);
}

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
