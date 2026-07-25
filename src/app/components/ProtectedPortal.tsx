import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { clearAuthSession, dispatchSessionExpired, getAuthSession, type AppRole, productionRuntime } from "../lib/authSession";
import { authService } from "../lib/api/services";
import { apiRuntime } from "../lib/api/runtime";

function isAuthorizationFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  );
}

export default function ProtectedPortal({ role, children }: { role: AppRole; children: ReactNode }) {
  const location = useLocation();
  const session = getAuthSession();
  const sessionRole = session?.role ?? null;
  const sessionKey = session
    ? `${session.role}:${session.identifier}:${session.accessToken ?? ""}:${session.refreshToken ?? ""}`
    : "anonymous";
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      if (!session) {
        if (mounted) {
          setAllowed(false);
          setChecked(true);
        }
        return;
      }

      try {
        const me = await authService.getCurrentUser();
        if (!mounted) return;
        const roleMatches = String(me?.role || "").toLowerCase() === role && session.role === role;
        if (!roleMatches) {
          clearAuthSession();
        }
        setAllowed(roleMatches);
      } catch (error) {
        if (!mounted) return;
        if (isAuthorizationFailure(error)) {
          dispatchSessionExpired();
          clearAuthSession();
          setAllowed(false);
          return;
        }

        if (apiRuntime.useBackend) {
          // Backend unreachable — clear session and redirect to login
          clearAuthSession();
          setAllowed(false);
          return;
        }

        // SECURITY: In non-backend mode (local dev only), still require valid session structure
        // but log a warning. Never allow role spoofing without any token in production builds.
        if (productionRuntime()) {
          console.error("[SECURITY] Production build with no backend — rejecting session.");
          setAllowed(false);
          return;
        }
        setAllowed(sessionRole === role);
      } finally {
        if (mounted) setChecked(true);
      }
    }

    verify();
    return () => {
      mounted = false;
    };
  }, [role, sessionKey, sessionRole]);

  if (!session) {
    return <Navigate to={`/${role}/login`} replace state={{ from: location.pathname + location.search }} />;
  }

  if (!checked) {
    return <div className="min-h-[40vh] flex items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">Checking session…</div>;
  }

  if (!allowed) {
    return <Navigate to={`/${role}/login`} replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
