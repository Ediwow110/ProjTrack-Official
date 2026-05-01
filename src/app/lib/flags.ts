function envFlag(value: string | boolean | undefined, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export const featureFlags = {
  clientErrorReporting: envFlag(import.meta.env.VITE_ENABLE_CLIENT_ERROR_REPORTING, true),
  globalOfflineBanner: envFlag(import.meta.env.VITE_ENABLE_OFFLINE_BANNER, true),
  globalNetworkOverlay: envFlag(import.meta.env.VITE_ENABLE_NETWORK_OVERLAY, true),
  realAccountSmokeDocs: envFlag(import.meta.env.VITE_ENABLE_REAL_ACCOUNT_SMOKE_DOCS, true),
} as const;
