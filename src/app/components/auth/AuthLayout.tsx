import type { ComponentType, ReactNode } from "react";

import { roleThemeStyle, type PortalRole } from "../../lib/roleTheme";
import { cn } from "../ui/utils";
import { BrandPanel } from "./BrandPanel";
import { LoginCard } from "./LoginCard";
import { ProjTrackLogo } from "../brand/ProjTrackLogo";
import type { AuthFeature } from "./FeatureHighlights";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export type { AuthFeature };

export function AuthLayout({
  role,
  portalEyebrow,
  cardKicker,
  headlineL1,
  headlineL2Pre,
  headlineAccent,
  description,
  icon: Icon,
  features = [],
  securityBadge,
  children,
  footer,
}: {
  role: PortalRole;
  portalEyebrow: string;
  cardKicker: string;
  headlineL1: string;
  headlineL2Pre: string;
  headlineAccent: string;
  description: string;
  icon: AuthIcon;
  features?: AuthFeature[];
  securityBadge?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div
      className={cn(
        "auth-login-page auth-starry-login min-h-dvh overflow-x-hidden text-white",
        `portal-role-${role}`,
      )}
      style={roleThemeStyle(role)}
      data-auth-role={role}
    >
      {/* Background layers: campus silhouette + starfield + dots framed to composition */}
      <div className="auth-campus-bg" aria-hidden="true" />
      <div className="auth-campus-skyline" aria-hidden="true" />
      <div className="auth-campus-glow" aria-hidden="true" />
      <div className="auth-starfield" aria-hidden="true" />
      <div className="auth-dot-grid" aria-hidden="true" />
      <div className="auth-space-glow auth-space-glow-primary" aria-hidden="true" />
      <div className="auth-space-glow auth-space-glow-secondary" aria-hidden="true" />
      <div className="auth-leaf auth-leaf-bl" aria-hidden="true" />
      <div className="auth-leaf auth-leaf-br" aria-hidden="true" />

      <div className="auth-shell relative z-10 mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Curved glowing arc divider — visible only at lg+ */}
        <span className="auth-arc" aria-hidden="true" />
        <span className="auth-arc auth-arc-soft" aria-hidden="true" />

        <div className="auth-grid relative grid flex-1 items-center gap-10 py-4 md:py-6 lg:gap-14">
          <BrandPanel
            role={role}
            logo={
              <ProjTrackLogo
                role={role}
                inverse
                subtitle="PROJECT SUBMISSION MANAGEMENT SYSTEM"
                className="auth-hero-logo"
                markClassName="h-[4.6rem] w-[4.6rem] rounded-[1.5rem]"
                textClassName="auth-hero-logo-text"
              />
            }
            portalEyebrow={portalEyebrow}
            headlineL1={headlineL1}
            headlineL2Pre={headlineL2Pre}
            headlineAccent={headlineAccent}
            description={description}
            features={features}
          />

          <LoginCard
            role={role}
            cardKicker={cardKicker}
            icon={Icon}
            securityBadge={securityBadge}
            footer={footer}
          >
            {children}
          </LoginCard>
        </div>

        <footer className="auth-page-footer">
          <p>{`© ${year} ProjTrack. All rights reserved.`}</p>
          <nav aria-label="Legal">
            <a href="/legal/privacy">Privacy Policy</a>
            <span aria-hidden="true">•</span>
            <a href="/legal/terms">Terms of Service</a>
            <span aria-hidden="true">•</span>
            <a href="/help">Help Center</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

// Retain legacy AuthField for potential external imports, although replaced by AuthTextInput in forms.
export function AuthField({
  label,
  htmlFor,
  icon: Icon,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: AuthIcon;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="auth-field-label mb-2 block text-sm font-semibold text-white">
        {label}
      </span>
      <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.95)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-slate-300">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </label>
  );
}
