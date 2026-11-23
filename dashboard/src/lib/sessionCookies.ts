export const ACCESS_COOKIE = 'okoa_access_token';
export const REFRESH_COOKIE = 'okoa_refresh_token';

export function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}
