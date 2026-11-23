import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backendAuth';
import { isAdminRole } from '@/lib/permissions';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/sessionCookies';
import { AuthUser } from '@/types/auth';

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const backend = await backendRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (backend.status !== 200 || !backend.data || !isAdminRole(backend.data.user.role)) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  store.set(ACCESS_COOKIE, backend.data.accessToken, { ...cookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, backend.data.refreshToken, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });

  return NextResponse.json({ user: backend.data.user });
}
