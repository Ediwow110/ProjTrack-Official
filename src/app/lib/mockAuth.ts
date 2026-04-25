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
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    emitAuthSessionChange(null);
    return;
  }

  window.localStorage.setItem(KEY, JSON.stringify(session));
  if (session.accessToken) {
    window.localStorage.setItem(ACCESS_KEY, session.accessToken);
  } else {
    window.localStorage.removeItem(ACCESS_KEY);
  }
  if (session.refreshToken) {
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
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function updateAuthTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  const current = getAuthSession();
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
