import type { Response } from 'express';

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env) {
  return (
    String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production' ||
    String(env.APP_ENV ?? '').trim().toLowerCase() === 'production'
  );
}

export function refreshCookieName(env: NodeJS.ProcessEnv = process.env) {
  return isProductionRuntime(env)
    ? String(env.AUTH_REFRESH_COOKIE_NAME || '__Secure-projtrack_refresh')
    : String(env.AUTH_REFRESH_COOKIE_NAME || 'projtrack_refresh');
}

function sameSite(env: NodeJS.ProcessEnv = process.env) {
  const configured = String(env.AUTH_REFRESH_COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
  if (configured === 'strict' || configured === 'none') return configured;
  return 'lax';
}

export function setRefreshCookie(res: Response, refreshToken: string, env: NodeJS.ProcessEnv = process.env) {
  const production = isProductionRuntime(env);
  const maxAgeMs = Number(env.JWT_REFRESH_TTL_MS || 7 * 24 * 60 * 60 * 1000);
  res.cookie(refreshCookieName(env), refreshToken, {
    httpOnly: true,
    secure: production || sameSite(env) === 'none',
    sameSite: sameSite(env) as 'lax' | 'strict' | 'none',
    path: '/auth',
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response, env: NodeJS.ProcessEnv = process.env) {
  const production = isProductionRuntime(env);
  res.cookie(refreshCookieName(env), '', {
    httpOnly: true,
    secure: production || sameSite(env) === 'none',
    sameSite: sameSite(env) as 'lax' | 'strict' | 'none',
    path: '/auth',
    maxAge: 0,
  });
}

export function refreshTokenFromCookie(req: any, env: NodeJS.ProcessEnv = process.env) {
  const cookieHeader = String(req?.headers?.cookie ?? '');
  if (!cookieHeader) return '';
  const name = refreshCookieName(env);
  for (const item of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = item.split('=');
    if (decodeURIComponent(rawKey.trim()) !== name) continue;
    return decodeURIComponent(rawValue.join('=').trim());
  }
  return '';
}

export function stripRefreshTokenInProduction<T extends Record<string, any>>(
  response: T,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!isProductionRuntime(env)) return response;
  const { refreshToken: _refreshToken, ...safeResponse } = response;
  return safeResponse;
}

