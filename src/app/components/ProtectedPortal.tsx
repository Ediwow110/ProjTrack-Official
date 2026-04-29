import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { clearAuthSession, getAuthSession, type AppRole } from "../lib/mockAuth";
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
  const [verificationError, setVerificationError] = useState("");

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
        setVerificationError("");
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
          clearAuthSession();
          setAllowed(false);
          return;
        }

        if (apiRuntime.useBackend) {
          setVerificationError("Session verification is temporarily unavailable. Please retry when the backend is reachable.");
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
    if (verificationError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center px-6">
          <div role="alert" className="max-w-lg rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 shadow-[var(--shadow-soft)] dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
            {verificationError}
          </div>
        </div>
      );
    }
    return <Navigate to={`/${role}/login`} replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
