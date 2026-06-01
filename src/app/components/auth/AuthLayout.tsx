import type { ComponentType, ReactNode } from "react";

import { roleThemeStyle, type PortalRole } from "../../lib/roleTheme";
import { cn } from "../ui/utils";
import { BrandPanel } from "./BrandPanel";
import { LoginCard } from "./LoginCard";
import type { AuthFeature } from "./FeatureHighlights";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export type { AuthFeature };

const heroLogoSrc = "/branding/projtrack-logo-clean.png";
const heroTitleSrc = "/branding/projtrack-system-title-clean.png";

export function AuthLayout({
  role,
  portalEyebrow,
  cardKicker,
  headlines,
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
  headlines: string[];
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
        "auth-login-page min-h-dvh overflow-x-hidden",
        `portal-role-${role}`,
      )}
      style={roleThemeStyle(role)}
      data-auth-role={role}
    >
      <div className="auth-bg-shape auth-bg-shape-primary" aria-hidden="true" />
      <div className="auth-bg-shape auth-bg-shape-secondary" aria-hidden="true" />
      <div className="auth-bg-dots" aria-hidden="true" />

      <div className="auth-shell">
        <div className="auth-container">
          <BrandPanel
            role={role}
            logo={
              <div className="auth-hero-brand-lockup" aria-label="ProjTrack brand">
                <img
                  src={heroLogoSrc}
                  alt=""
                  className="auth-hero-brand-mark"
                />
                <div className="auth-hero-brand-title-text">
                  <div className="auth-hero-brand-title-main">
                    <span className="auth-hero-word-proj">
                      {"PROJ".split("").map((char, i) => (
                        <span
                          key={i}
                          className="auth-hero-char"
                          style={{ animationDelay: `${i * 0.06}s` }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                    <span className="auth-hero-word-track">
                      {"TRACK".split("").map((char, i) => (
                        <span
                          key={i}
                          className="auth-hero-char"
                          style={{ animationDelay: `${(i + 4) * 0.06}s` }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="auth-hero-brand-title-sub">
                    {"PROJECT SUBMISSION MANAGEMENT SYSTEM".split(" ").map((word, i) => (
                      <span
                        key={i}
                        className="auth-hero-sub-word"
                        style={{ animationDelay: `${0.6 + i * 0.05}s` }}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                  <div className="auth-hero-brand-title-line" />
                </div>
              </div>
            }
            portalEyebrow={portalEyebrow}
            headlines={headlines}
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
            <span aria-hidden="true">&middot;</span>
            <a href="/legal/terms">Terms of Service</a>
            <span aria-hidden="true">&middot;</span>
            <a href="/help">Help Center</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
