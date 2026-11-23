import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { createApp } from './app.js';
import { User } from './models/User.js';
import { RefreshToken } from './models/RefreshToken.js';
import { signAccessToken, signRefreshToken } from './utils/jwt.js';
import { sha256 } from './utils/crypto.js';

describe('Authentication module', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-for-auth';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers a citizen and ignores privileged role in request', async () => {
    const createdUserId = new Types.ObjectId();
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'create').mockResolvedValue({
      _id: createdUserId,
      fullName: 'Test Citizen',
      email: 'citizen@test.dev',
      phone: undefined,
      role: 'Citizen',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as never);

    const response = await request(createApp())
      .post('/api/auth/register')
      .set('x-auth-mode', 'token')
      .send({
        fullName: 'Test Citizen',
        email: 'citizen@test.dev',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        role: 'Super Administrator',
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('Citizen');
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
  });

  it('rejects duplicate registration', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const response = await request(createApp()).post('/api/auth/register').send({
      fullName: 'Existing Citizen',
      email: 'existing@test.dev',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('already exists');
  });

  it('logs in with valid credentials', async () => {
    const userId = new Types.ObjectId();
    const passwordHash = await bcrypt.hash('SecurePass123!', 12);
    const user = {
      _id: userId,
      fullName: 'Officer',
      email: 'officer@test.dev',
      phone: '+254700000001',
      role: 'Security Officer',
      preferredLanguage: 'en',
      isActive: true,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    } as never);
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as never);

    const response = await request(createApp())
      .post('/api/auth/login')
      .set('x-auth-mode', 'token')
      .send({ emailOrPhone: 'officer@test.dev', password: 'SecurePass123!' });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('Security Officer');
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
  });

  it('returns generic login error for invalid credentials', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);

    const response = await request(createApp())
      .post('/api/auth/login')
      .send({ emailOrPhone: 'unknown@test.dev', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
  });

  it('rejects expired refresh tokens', async () => {
    const userId = new Types.ObjectId();
    const expiredToken = signRefreshToken(userId.toString(), 'expired-token-id', '1ms');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await request(createApp())
      .post('/api/auth/refresh')
      .set('x-auth-mode', 'token')
      .send({ refreshToken: expiredToken });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid or expired refresh token');
  });

  it('rotates refresh token on refresh', async () => {
    const userId = new Types.ObjectId();
    const oldRefreshToken = signRefreshToken(userId.toString(), 'old-token-id', '7d');

    const storedToken = {
      userId,
      tokenHash: sha256(oldRefreshToken),
      tokenId: 'old-token-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: undefined as Date | undefined,
      replacedByTokenId: undefined as string | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue(storedToken as never);
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: userId,
      fullName: 'County Admin',
      email: 'county@test.dev',
      role: 'County Administrator',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as never);

    const response = await request(createApp())
      .post('/api/auth/refresh')
      .set('x-auth-mode', 'token')
      .send({ refreshToken: oldRefreshToken });

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).toBeTruthy();
    expect(response.body.refreshToken).not.toBe(oldRefreshToken);
    expect(storedToken.save).toHaveBeenCalled();
    expect(storedToken.revokedAt).toBeDefined();
    expect(storedToken.replacedByTokenId).toBeDefined();
  });

  it('revokes refresh token on logout', async () => {
    const userId = new Types.ObjectId();
    const refreshToken = signRefreshToken(userId.toString(), 'logout-token-id', '7d');

    const storedToken = {
      revokedAt: undefined as Date | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue(storedToken as never);

    const response = await request(createApp()).post('/api/auth/logout').send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(storedToken.save).toHaveBeenCalled();
    expect(storedToken.revokedAt).toBeDefined();
  });

  it('requires authentication for /me', async () => {
    const response = await request(createApp()).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('rejects expired access token on /me', async () => {
    const userId = new Types.ObjectId();
    const expiredAccessToken = signAccessToken(userId.toString(), 'Citizen', '1ms');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await request(createApp())
      .get('/api/auth/me')
      .set('authorization', `Bearer ${expiredAccessToken}`);

    expect(response.status).toBe(401);
  });
});
