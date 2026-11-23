import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backendAuth';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/sessionCookies';

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  await backendRequest('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);

  return NextResponse.json({ success: true });
}
