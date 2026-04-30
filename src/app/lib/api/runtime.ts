function parseBooleanEnv(value: unknown, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const rawConfiguredBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
const useBackend = parseBooleanEnv(import.meta.env.VITE_USE_BACKEND, true);
const publicAppUrl = String(import.meta.env.VITE_PUBLIC_APP_URL ?? import.meta.env.VITE_APP_URL ?? "").trim();

function normalizeBaseUrl(value: unknown) {
  const fallback = "http://127.0.0.1:3001";
  const candidate = String(value ?? "").trim() || fallback;
  const sanitized = candidate.replace(/\/+$/, "");

  try {
    const normalized = new URL(`${sanitized}/`).toString().replace(/\/+$/, "");

    if (import.meta.env.PROD && useBackend && !rawConfiguredBaseUrl) {
      throw new Error("VITE_API_BASE_URL is required for production builds when VITE_USE_BACKEND=true.");
    }

    if (import.meta.env.PROD && useBackend && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(normalized)) {
      throw new Error("VITE_API_BASE_URL cannot point to localhost in production builds.");
    }

    if (import.meta.env.PROD && useBackend && /^http:\/\//i.test(normalized)) {
      throw new Error("VITE_API_BASE_URL must use https:// in production builds.");
    }

    return normalized;
  } catch (error) {
    if (import.meta.env.PROD && useBackend) {
      if (error instanceof Error) throw error;
      throw new Error("VITE_API_BASE_URL must be a valid absolute URL for production builds.");
    }

    return fallback;
  }
}

function normalizeApiPath(path: string) {
  const candidate = String(path ?? "").trim();
  if (!candidate) return "/";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

if (import.meta.env.PROD && !useBackend) {
  throw new Error("VITE_USE_BACKEND=false is not allowed in production builds.");
}

if (import.meta.env.PROD && !publicAppUrl) {
  throw new Error("VITE_PUBLIC_APP_URL is required for production builds.");
}

if (import.meta.env.PROD && /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(publicAppUrl)) {
  throw new Error("VITE_PUBLIC_APP_URL cannot point to localhost in production builds.");
}

if (import.meta.env.PROD && /^http:\/\//i.test(publicAppUrl)) {
  throw new Error("VITE_PUBLIC_APP_URL must use https:// in production builds.");
}

const configuredBaseUrl = normalizeBaseUrl(rawConfiguredBaseUrl || undefined);

export const apiRuntime = {
  useBackend,
  baseUrl: configuredBaseUrl,
  publicAppUrl,
};

export const isOfficialMode = apiRuntime.useBackend;

export function requireBackendApi() {
  throw new Error("Backend API access is required.");
}

export function buildApiUrl(path: string) {
  const candidate = String(path ?? "").trim();
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return new URL(normalizeApiPath(candidate), `${apiRuntime.baseUrl}/`).toString();
}

export function buildBackendFileUrl(path: string) {
  return buildApiUrl(path);
}