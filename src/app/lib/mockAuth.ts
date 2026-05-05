export type AppRole = "student" | "teacher" | "admin";

const BROKEN_NAME_PATTERNS = new Set([
  "undefined undefined",
  "null null",
  "undefined",
  "null",
  "undefined null",
  "null undefined",
]);

function sanitizeDisplayName(value: string | undefined | null): string | undefined {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || BROKEN_NAME_PATTERNS.has(cleaned.toLowerCase())) {
    return undefined;
  }
  return cleaned;
}

export interface AuthSession {
  role: AppRole;
  identifier: string;
  displayName: string;
  userId?: string;
  email?: string;
  status?: string;
  avatarRelativePath?: string;
  avatarVersion?: number;
  accessToken?: string;
  refreshToken?: string;
}

const KEY = "projtrack-auth-session";
const ACCESS_KEY = "projtrack-access-token";
const REFRESH_KEY = "projtrack-refresh-token";
const REMEMBER_KEY = "projtrack-remember-me";
const SESSION_EVENT = "projtrack-auth-session-change";
let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export function productionRuntime() {
  return import.meta.env.PROD;
}

const roleNames: Record<AppRole, string> = {
  student: "Student Account",
  teacher: "Teacher Account",
  admin: "Admin User",
};

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function emitAuthSessionChange(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthSession | null>(SESSION_EVENT, { detail: session }));
}

function persistAuthSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(REMEMBER_KEY);
    emitAuthSessionChange(null);
    return;
  }

  memoryAccessToken = session.accessToken ?? memoryAccessToken;
  memoryRefreshToken = session.refreshToken ?? memoryRefreshToken;
  const persistedSession = productionRuntime()
    ? { ...session, accessToken: undefined, refreshToken: undefined }
    : session;

  window.localStorage.setItem(KEY, JSON.stringify(persistedSession));
  if (!productionRuntime() && session.accessToken) {
    window.localStorage.setItem(ACCESS_KEY, session.accessToken);
  } else {
    window.localStorage.removeItem(ACCESS_KEY);
  }
  if ((getRememberMePreference() || !productionRuntime()) && session.refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_KEY);
  }
  emitAuthSessionChange(session);
}

export function setAuthSession(
  role: AppRole,
  identifier: string,
  tokens?: { accessToken?: string; refreshToken?: string },
  displayName?: string,
  extras?: Partial<Omit<AuthSession, "role" | "identifier" | "displayName" | "accessToken" | "refreshToken">>,
) {
  // PRODUCTION SAFETY: In production, we NEVER allow pure client-side session creation.
  // Real login must come through authService.login() which calls the backend.
  if (productionRuntime() && !tokens?.accessToken) {
    console.error("[SECURITY] Blocked client-only session creation in production. Use real login API.");
    return;
  }

  const session: AuthSession = {
    role,
    identifier,
    displayName: sanitizeDisplayName(displayName) ?? roleNames[role],
    accessToken: tokens?.accessToken,
    refreshToken: tokens?.refreshToken,
    ...extras,
  };
  persistAuthSession(session);
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  if (memoryAccessToken) return memoryAccessToken;
  if (productionRuntime()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  if (memoryRefreshToken) return memoryRefreshToken;
  if (productionRuntime() && !getRememberMePreference()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getRememberMePreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(REMEMBER_KEY) === "true";
}

export function setRememberMePreference(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(REMEMBER_KEY, "true");
  } else {
    window.localStorage.removeItem(REMEMBER_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  }
}

export function updateAuthTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  const current = getAuthSession();
  memoryAccessToken = tokens.accessToken ?? memoryAccessToken;
  memoryRefreshToken = tokens.refreshToken ?? memoryRefreshToken;

  if (!current) return;
  persistAuthSession({
    ...current,
    accessToken: tokens.accessToken ?? current.accessToken,
    refreshToken: tokens.refreshToken ?? current.refreshToken,
  });
}

export function updateAuthSession(patch: Partial<AuthSession>) {
  const current = getAuthSession();
  if (!current) return;
  persistAuthSession({
    ...current,
    ...patch,
    role: patch.role ?? current.role,
    identifier: patch.identifier ?? current.identifier,
    displayName: sanitizeDisplayName(patch.displayName) ?? current.displayName,
  });
}

export function subscribeAuthSession(listener: (session: AuthSession | null) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    listener((event as CustomEvent<AuthSession | null>).detail ?? getAuthSession());
  };

  window.addEventListener(SESSION_EVENT, handleChange as EventListener);
  return () => {
    window.removeEventListener(SESSION_EVENT, handleChange as EventListener);
  };
}

export function clearAuthSession() {
  persistAuthSession(null);
}
