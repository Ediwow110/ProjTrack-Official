import type { ReactNode } from "react";
import { FeatureHighlights, type AuthFeature } from "./FeatureHighlights";
import type { PortalRole } from "../../lib/roleTheme";

export function BrandPanel({
  role,
  logo,
  portalEyebrow,
  headlineL1,
  headlineL2Pre,
  headlineAccent,
  description,
  features,
}: {
  role: PortalRole;
  logo: ReactNode;
  portalEyebrow: string;
  headlineL1: string;
  headlineL2Pre: string;
  headlineAccent: string;
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
          <span className="auth-hero-headline-line">{headlineL1}</span>
          <span className="auth-hero-headline-line">
            {headlineL2Pre}
            <span className="auth-hero-headline-accent">{headlineAccent}</span>
          </span>
        </h1>
        <p className="auth-hero-description">{description}</p>
        <span className="auth-hero-rule" aria-hidden="true" />
      </div>

      <FeatureHighlights features={features} />
    </aside>
  );
}
