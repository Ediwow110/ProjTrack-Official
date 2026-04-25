import { AUTH_QUERY_KEYS, AUTH_ROUTE_FRAGMENTS } from '../constants/auth.constants';

function frontendBaseUrl() {
  return String(process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function buildFrontendUrl(path: string, params?: Record<string, string | undefined | null>) {
  const url = new URL(`${frontendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function buildActivationLink(input: {
  token: string;
  ref: string;
  role: string;
}) {
  return buildFrontendUrl(AUTH_ROUTE_FRAGMENTS.ACTIVATE, {
    [AUTH_QUERY_KEYS.TOKEN]: input.token,
    [AUTH_QUERY_KEYS.REF]: input.ref,
    [AUTH_QUERY_KEYS.ROLE]: input.role.toLowerCase(),
  });
}

export function buildResetPasswordLink(input: {
  token: string;
  ref: string;
  role: string;
  mode?: string;
}) {
  return buildFrontendUrl(AUTH_ROUTE_FRAGMENTS.RESET_PASSWORD, {
    [AUTH_QUERY_KEYS.TOKEN]: input.token,
    [AUTH_QUERY_KEYS.REF]: input.ref,
    [AUTH_QUERY_KEYS.ROLE]: input.role.toLowerCase(),
    mode: input.mode,
  });
}

export function buildUnsubscribeLink(token: string) {
  return buildFrontendUrl(AUTH_ROUTE_FRAGMENTS.UNSUBSCRIBE, {
    token,
  });
}
