import { apiRequest } from './apiClient';
import { AuthResponse, LoginPayload, RegisterPayload, AuthUser } from '../types/auth';

interface MeResponse {
  user: AuthUser;
  permissions: string[];
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function refresh(refreshToken: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(refreshToken?: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function me(accessToken: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', {
    method: 'GET',
    authToken: accessToken,
  });
}
