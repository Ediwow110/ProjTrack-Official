import type { ComponentType, ReactNode } from "react";
import { Lock } from "lucide-react";
import type { PortalRole } from "../../lib/roleTheme";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

const roleNames: Record<PortalRole, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};

export function LoginCard({
  role,
  cardKicker,
  icon: _Icon,
  securityBadge,
  children,
  footer,
}: {
  role: PortalRole;
  cardKicker: string;
  icon: AuthIcon;
  securityBadge?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      className="auth-login-card"
      data-testid="login-card"
    >
      <div className="auth-card-accent-bar" aria-hidden="true" />
      <div className="auth-card-body">
        <div>
          <div className="flex justify-center mb-4">
            <img
              src="/branding/projtrack-logo-clean.png"
              alt="ProjTrack Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="auth-card-divider">
            <span className="auth-card-divider-line" aria-hidden="true" />
            <span className="auth-card-divider-text">{cardKicker}</span>
            <span className="auth-card-divider-line" aria-hidden="true" />
          </div>
        </div>

        <div className="auth-card-form">
          {children}
        </div>

        {securityBadge ? (
          <div className="auth-security-badge">
            <div className="auth-security-divider" aria-hidden="true">
              <span />
              <span className="auth-security-divider-text">or</span>
              <span />
            </div>
            <div className="auth-security-text">
              <Lock size={14} className="shrink-0" aria-hidden="true" />
              <span>{securityBadge}</span>
            </div>
          </div>
        ) : null}

        {footer ? (
          <div className="auth-footer-text mt-6">
            {footer}
          </div>
        ) : null}

        <span className="sr-only">{`Sign in to the ${roleNames[role]} portal`}</span>
      </div>
    </main>
  );
}
