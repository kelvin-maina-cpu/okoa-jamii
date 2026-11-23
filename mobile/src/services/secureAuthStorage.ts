import * as SecureStore from 'expo-secure-store';
import { AuthTokens } from '../types/auth';

const AUTH_STORAGE_KEY = 'okoa_jamii_auth_tokens';

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as AuthTokens;
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
}
