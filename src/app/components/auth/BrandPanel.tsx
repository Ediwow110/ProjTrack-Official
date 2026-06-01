import type { ReactNode } from "react";
import { FeatureHighlights, type AuthFeature } from "./FeatureHighlights";
import type { PortalRole } from "../../lib/roleTheme";

export function BrandPanel({
  role,
  logo,
  portalEyebrow,
  headlines,
  description,
  features,
}: {
  role: PortalRole;
  logo: ReactNode;
  portalEyebrow: string;
  headlines: string[];
  description: string;
  features: AuthFeature[];
}) {
  return (
    <aside className="auth-login-hero">
      <div className="auth-hero-header">
        {logo}
      </div>

      <div className="auth-hero-copy">
        <h1 className="auth-hero-headline">
          {headlines.map((line, i) => (
            <span key={i} className="auth-hero-headline-line">
              {line}
            </span>
          ))}
        </h1>
        <p className="auth-hero-description">{description}</p>
        <span className="auth-hero-rule" aria-hidden="true" />
      </div>

      <FeatureHighlights features={features} />
    </aside>
  );
}
