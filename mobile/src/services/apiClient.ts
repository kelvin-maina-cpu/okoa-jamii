import { API_BASE_URL } from '../config/api';

interface RequestOptions extends RequestInit {
  authToken?: string;
}

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-auth-mode', 'token');

  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const json = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new ApiError(json.error || 'Request failed', response.status);
  }

  return json as T;
}
