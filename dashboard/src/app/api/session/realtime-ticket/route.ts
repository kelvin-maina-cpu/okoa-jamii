import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backendAuth';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/sessionCookies';

type TicketResponse = { ticket: string; expiresInSeconds: number };
type RefreshResponse = { accessToken: string; refreshToken: string };
export async function POST() {
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;
  if (!access) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const ticketRequest = (token: string) => backendRequest<TicketResponse>('/auth/realtime-ticket', { method: 'POST', accessToken: token });
  let result = await ticketRequest(access);
  let refreshed: RefreshResponse | null = null;
  if (result.status === 401) {
    const refreshToken = jar.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const response = await backendRequest<RefreshResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      if (response.status === 200 && response.data) {
        refreshed = response.data; access = refreshed.accessToken; result = await ticketRequest(access);
      }
    }
  }
  const response = NextResponse.json(result.data ?? { error: 'Unable to create real-time ticket' }, { status: result.status });
  if (refreshed && result.status === 200) {
    response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, { ...cookieOptions(), maxAge: 900 });
    response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, { ...cookieOptions(), maxAge: 604800 });
  }
  return response;
}
