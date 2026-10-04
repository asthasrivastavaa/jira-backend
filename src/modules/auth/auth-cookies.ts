import type { Response } from 'express';
import { ACCESS_COOKIE, ACCESS_TTL_SEC, REFRESH_COOKIE, REFRESH_TTL_SEC } from './auth.constants.js';

const base = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base(), maxAge: ACCESS_TTL_SEC * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base(), maxAge: REFRESH_TTL_SEC * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, base());
  res.clearCookie(REFRESH_COOKIE, base());
}
