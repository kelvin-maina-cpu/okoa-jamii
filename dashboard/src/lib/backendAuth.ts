import { API_BASE_URL } from '../config/api';

interface BackendRequestOptions extends RequestInit {
  accessToken?: string;
}

export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<{ status: number; data: T | null }> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-auth-mode', 'token');

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, data };
}
