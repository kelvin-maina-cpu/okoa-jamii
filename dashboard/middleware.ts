import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './src/lib/sessionCookies';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const hasAccessToken = request.cookies.has(ACCESS_COOKIE);
  const hasRefreshToken = request.cookies.has(REFRESH_COOKIE);

  if (!hasAccessToken && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'auth-required');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
