import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backendAuth';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/sessionCookies';
import { AuthUser } from '@/types/auth';

interface AuthResponse { accessToken: string; refreshToken: string; user: AuthUser }
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  const jar = await cookies(); let access = jar.get(ACCESS_COOKIE)?.value;
  if (!access) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { path } = await context.params;
  const suffix = path.map(encodeURIComponent).join('/');
  const query = request.nextUrl.search;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const collection = path[0];
  const backendBase = collection === 'alerts' || collection === 'analytics' || collection === 'audit' ? `/${collection}` : `/incidents/${suffix}`;
  const backendPath = ['analytics', 'audit', 'alerts'].includes(collection) && path.length > 1
    ? `${backendBase}/${path.slice(1).map(encodeURIComponent).join('/')}`
    : backendBase;
  const call = (token: string) => backendRequest(`${backendPath}${query}`, { method: request.method, body, headers: { 'Content-Type': 'application/json' }, accessToken: token });
  let result = await call(access);
  if (result.status === 401) {
    const refreshToken = jar.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const refreshed = await backendRequest<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      if (refreshed.status === 200 && refreshed.data?.accessToken) {
        access = refreshed.data.accessToken;
        result = await call(access);
        const response = NextResponse.json(result.data, { status: result.status });
        response.cookies.set(ACCESS_COOKIE, refreshed.data.accessToken, { ...cookieOptions(), maxAge: 900 });
        response.cookies.set(REFRESH_COOKIE, refreshed.data.refreshToken, { ...cookieOptions(), maxAge: 604800 });
        return response;
      }
    }
  }
  return NextResponse.json(result.data ?? { error: 'Backend request failed' }, { status: result.status });
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
