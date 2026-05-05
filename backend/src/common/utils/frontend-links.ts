import { AUTH_QUERY_KEYS, AUTH_ROUTE_FRAGMENTS } from '../constants/auth.constants';

const LOCAL_HOST_MARKERS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

function isProductionRuntime() {
  return (
    String(process.env.NODE_ENV ?? '').toLowerCase() === 'production' ||
    String(process.env.APP_ENV ?? '').toLowerCase() === 'production'
  );
}

function assertProductionFrontendUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `FRONTEND_URL is not a valid absolute URL. ` +
        `Set FRONTEND_URL=https://www.projtrack.codes in your production environment.`,
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `FRONTEND_URL must use https:// in production (got "${parsed.protocol}"). ` +
        `Set FRONTEND_URL=https://www.projtrack.codes.`,
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (LOCAL_HOST_MARKERS.some((marker) => hostname.includes(marker))) {
    throw new Error(
      `FRONTEND_URL cannot point to localhost or 127.0.0.1 in production (got "${value}"). ` +
        `Set FRONTEND_URL=https://www.projtrack.codes in your production environment.`,
    );
  }
}

export function frontendBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = String(env.FRONTEND_URL || env.APP_URL || '').trim().replace(/\/+$/, '');

  if (!raw) {
    if (isProductionRuntime()) {
      throw new Error(
        'FRONTEND_URL is required in production but is not set. ' +
          'Set FRONTEND_URL=https://www.projtrack.codes in your production environment.',
      );
    }
    return 'http://localhost:5173';
  }

  if (isProductionRuntime()) {
    assertProductionFrontendUrl(raw);
  }

  return raw;
}

function buildFrontendUrl(path: string, params?: Record<string, string | undefined | null>) {
  const base = frontendBaseUrl();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
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

export function buildStudentSubjectLink(subjectId: string): string {
  return `${frontendBaseUrl()}/student/subjects/${encodeURIComponent(subjectId)}`;
}
