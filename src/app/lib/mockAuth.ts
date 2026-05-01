export type AppRole = "student" | "teacher" | "admin";

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
const SESSION_EVENT = "projtrack-auth-session-change";
let memoryAccessToken: string | null = null;

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
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    emitAuthSessionChange(null);
    return;
  }

  memoryAccessToken = session.accessToken ?? memoryAccessToken;
  const persistedSession = productionRuntime()
    ? { ...session, accessToken: undefined, refreshToken: undefined }
    : session;

  window.localStorage.setItem(KEY, JSON.stringify(persistedSession));
  if (!productionRuntime() && session.accessToken) {
    window.localStorage.setItem(ACCESS_KEY, session.accessToken);
  } else {
    window.localStorage.removeItem(ACCESS_KEY);
  }
  if (!productionRuntime() && session.refreshToken) {
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
    displayName: displayName ?? roleNames[role],
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
  if (productionRuntime()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function updateAuthTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  const current = getAuthSession();
  memoryAccessToken = tokens.accessToken ?? memoryAccessToken;
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
    displayName: patch.displayName ?? current.displayName,
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
