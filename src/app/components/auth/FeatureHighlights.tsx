import type { ComponentType } from "react";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export type AuthFeature = {
  icon: AuthIcon;
  label: string;
  sub: string;
};

export function FeatureHighlights({ features }: { features: AuthFeature[] }) {
  if (!features.length) return null;
  return (
    <div className="auth-feature-grid">
      {features.map((feature) => {
        const FeatureIcon = feature.icon;
        return (
          <div
            key={`${feature.label}-${feature.sub}`}
            className="auth-feature-card"
          >
            <div className="auth-feature-icon" aria-hidden="true">
              <FeatureIcon size={26} strokeWidth={1.85} />
            </div>
            <div className="auth-feature-label">
              <span>{feature.label}</span>
              <span>{feature.sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
