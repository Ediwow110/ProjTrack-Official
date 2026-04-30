function parseBooleanEnv(value: unknown, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeBaseUrl(value: unknown, useBackend: boolean) {
  const fallback = "http://127.0.0.1:3001";
  const candidate = String(value ?? "").trim() || fallback;
  const sanitized = candidate.replace(/\/+$/, "");

  try {
    return new URL(`${sanitized}/`).toString().replace(/\/+$/, "");
  } catch {
    if (import.meta.env.PROD && useBackend) {
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

// Default to false so deployments without a backend (e.g. Vercel preview) don't crash.
// Set VITE_USE_BACKEND=true explicitly when a real backend is available.
const useBackend = parseBooleanEnv(import.meta.env.VITE_USE_BACKEND, false);

const rawConfiguredBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
if (import.meta.env.PROD && useBackend && !rawConfiguredBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required for production builds when VITE_USE_BACKEND=true.");
}
if (import.meta.env.PROD && useBackend && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(rawConfiguredBaseUrl)) {
  throw new Error("VITE_API_BASE_URL cannot point to localhost in production builds.");
}

const configuredBaseUrl = normalizeBaseUrl(rawConfiguredBaseUrl || undefined, useBackend);

export const apiRuntime = {
  useBackend,
  baseUrl: configuredBaseUrl,
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

