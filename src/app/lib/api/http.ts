import { apiRuntime, buildApiUrl } from './runtime';
import { clearAuthSession, getAccessToken, getRefreshToken, updateAuthTokens } from '../mockAuth';

let refreshPromise: Promise<string | null> | null = null;

function toQueryString(query?: Record<string, string | number | boolean | undefined | null>) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

function shouldExposeRequestId(path: string, status: number, message: string) {
  if (path === '/auth/login' && status === 401) return false;
  if (/\binvalid\b/i.test(message)) return false;
  return true;
}

function backendUnavailableError(error: unknown) {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  if (import.meta.env.DEV) {
    return new Error(
      `Unable to reach the backend at ${apiRuntime.baseUrl}. Start the backend and try again.${detail}`,
    );
  }
  return new Error('Service is temporarily unavailable. Please try again.');
}

async function executeFetch(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>, token?: string | null) {
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const url = `${buildApiUrl(path)}${toQueryString(query)}`;

  try {
    return await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw backendUnavailableError(error);
  }
}

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  let response: Response;
  try {
    response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    throw backendUnavailableError(error);
  }

  if (!response.ok) {
    clearAuthSession();
    return null;
  }

  const data = await response.json() as { accessToken?: string; refreshToken?: string };
  updateAuthTokens(data);
  return data.accessToken ?? null;
}

async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await executeFetch('POST', '/auth/logout', { refreshToken }, undefined, getAccessToken());
    }
  } finally {
    clearAuthSession();
  }
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  let token = getAccessToken();
  let response = await executeFetch(method, path, body, query, token);

  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const nextToken = await tryRefreshToken();
    if (nextToken) {
      response = await executeFetch(method, path, body, query, nextToken);
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let requestId = response.headers.get('x-request-id');
    try {
      const data = await response.json();
      message = data.message ?? data.error ?? message;
      requestId = data.requestId ?? requestId;
    } catch {
      // ignore body parsing issue
    }
    if (requestId && shouldExposeRequestId(path, response.status, message)) {
      message = `${message} [request ${requestId}]`;
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function parseFileNameFromDisposition(header: string | null) {
  if (!header) return undefined;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1];
}

async function requestBlob(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  let token = getAccessToken();
  let response = await executeFetch('GET', path, undefined, query, token);

  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const nextToken = await tryRefreshToken();
    if (nextToken) {
      response = await executeFetch('GET', path, undefined, query, nextToken);
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.message ?? data.error ?? message;
    } catch {
      // ignore body parsing issue
    }
    throw new Error(message);
  }

  return {
    blob: await response.blob(),
    fileName: parseFileNameFromDisposition(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type') ?? undefined,
  };
}

export const http = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined | null>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>) => request<T>('POST', path, body, query),
  patch: <T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>) => request<T>('PATCH', path, body, query),
  delete: <T>(path: string, query?: Record<string, string | number | boolean | undefined | null>) => request<T>('DELETE', path, undefined, query),
  getBlob: (path: string, query?: Record<string, string | number | boolean | undefined | null>) => requestBlob(path, query),
  logout,
};
