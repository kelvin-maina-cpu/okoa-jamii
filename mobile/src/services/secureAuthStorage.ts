import * as SecureStore from 'expo-secure-store';
import { AuthTokens, AuthUser } from '../types/auth';

const AUTH_STORAGE_KEY = 'okoa_jamii_auth_tokens';
const AUTH_USER_KEY = 'okoa_jamii_cached_user';

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as AuthTokens;
}

export async function saveCachedUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
}

export async function loadCachedUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(AUTH_USER_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as AuthUser;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_STORAGE_KEY),
    SecureStore.deleteItemAsync(AUTH_USER_KEY),
  ]);
}
