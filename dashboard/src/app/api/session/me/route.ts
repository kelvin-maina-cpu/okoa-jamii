import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backendAuth';
import { isAdminRole } from '@/lib/permissions';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/sessionCookies';
import { AuthUser } from '@/types/auth';

interface MeResponse {
  user: AuthUser;
  permissions: string[];
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function GET() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (accessToken) {
    const profile = await backendRequest<MeResponse>('/auth/me', {
      method: 'GET',
      accessToken,
    });

    if (profile.status === 200 && profile.data && isAdminRole(profile.data.user.role)) {
      return NextResponse.json(profile.data);
    }
  }

  if (!refreshToken) {
    store.delete(ACCESS_COOKIE);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const refreshed = await backendRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (refreshed.status !== 200 || !refreshed.data || !isAdminRole(refreshed.data.user.role)) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  store.set(ACCESS_COOKIE, refreshed.data.accessToken, { ...cookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, refreshed.data.refreshToken, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });

  const profile = await backendRequest<MeResponse>('/auth/me', {
    method: 'GET',
    accessToken: refreshed.data.accessToken,
  });

  if (profile.status !== 200 || !profile.data) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(profile.data);
}
