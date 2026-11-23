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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const backend = await backendRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (backend.status !== 200 || !backend.data) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (!isAdminRole(backend.data.user.role)) {
    return NextResponse.json({ error: 'Administrative access is required' }, { status: 403 });
  }

  const store = await cookies();
  store.set(ACCESS_COOKIE, backend.data.accessToken, { ...cookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, backend.data.refreshToken, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });

  return NextResponse.json({ user: backend.data.user });
}
