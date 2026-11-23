export type UserRole =
  | 'Citizen'
  | 'Community Leader'
  | 'Security Officer'
  | 'County Administrator'
  | 'Super Administrator';

export interface AuthUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  emailOrPhone: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  preferredLanguage?: string;
}
