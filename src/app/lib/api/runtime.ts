function parseBooleanEnv(value: unknown, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeBaseUrl(value: unknown) {
  const fallback = "http://127.0.0.1:3001";
  const candidate = String(value ?? fallback).trim() || fallback;
  const sanitized = candidate.replace(/\/+$/, "");

  try {
    return new URL(`${sanitized}/`).toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function normalizeApiPath(path: string) {
  const candidate = String(path ?? "").trim();
  if (!candidate) return "/";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const apiRuntime = {
  useBackend: parseBooleanEnv(import.meta.env.VITE_USE_BACKEND, true),
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

