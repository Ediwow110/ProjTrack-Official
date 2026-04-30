import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "../ui/utils";
import { roleThemes, type PortalRole } from "../../lib/roleTheme";
import { BRAND_NAME, defaultBranding, type BrandingResponse } from "./branding";
import { useBranding } from "./BrandingProvider";

export function ProjTrackLogo({
  role,
  compact = false,
  inverse = false,
  subtitle,
  showRoleDot = false,
  className,
  textClassName,
  markClassName,
  brandingOverride,
  imageClassName,
}: {
  role: PortalRole;
  compact?: boolean;
  inverse?: boolean;
  subtitle?: string;
  showRoleDot?: boolean;
  className?: string;
  textClassName?: string;
  markClassName?: string;
  brandingOverride?: Partial<BrandingResponse>;
  imageClassName?: string;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const theme = roleThemes[role];
  const label = subtitle ?? theme.logoLabel;
  const { branding } = useBranding();
  const resolvedBranding = { ...defaultBranding, ...branding, ...brandingOverride };
  const fullLogoUrl = resolvedBranding.logoUrl || resolvedBranding.iconUrl;
  const iconLogoUrl = resolvedBranding.iconUrl || resolvedBranding.logoUrl;
  const [fullLogoFailed, setFullLogoFailed] = useState(false);
  const [iconLogoFailed, setIconLogoFailed] = useState(false);

  useEffect(() => {
    setFullLogoFailed(false);
  }, [fullLogoUrl]);

  useEffect(() => {
    setIconLogoFailed(false);
  }, [iconLogoUrl]);

  const showFullLogoImage = !compact && Boolean(fullLogoUrl) && !fullLogoFailed;
  const showIconLogoImage = compact && Boolean(iconLogoUrl) && !iconLogoFailed;

  return (
    <motion.div
      className={cn(
        "projtrack-logo flex min-w-0 items-center",
        compact ? "justify-center" : "gap-3",
        className,
      )}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.24 }}
      aria-label={`${resolvedBranding.brandName || BRAND_NAME} ${theme.label}`}
      data-testid="projtrack-logo"
    >
      {showIconLogoImage ? (
        <motion.div
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)]",
            markClassName,
          )}
          initial={reducedMotion ? false : { scale: 0.94 }}
          animate={reducedMotion ? undefined : { scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.28 }}
          aria-hidden="true"
        >
          <img
            src={iconLogoUrl ?? undefined}
            alt=""
            className={cn("h-full w-full object-contain", imageClassName)}
            onError={() => setIconLogoFailed(true)}
          />
        </motion.div>
      ) : showFullLogoImage ? (
        <div className={cn("flex min-w-0 flex-col", textClassName)}>
          <motion.div
            className={cn(
              "relative flex h-12 w-[9.75rem] max-w-full items-center justify-start overflow-hidden",
              markClassName,
            )}
            initial={reducedMotion ? false : { scale: 0.97 }}
            animate={reducedMotion ? undefined : { scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.28 }}
            aria-hidden="true"
          >
            <img
              src={fullLogoUrl ?? undefined}
              alt=""
              className={cn("h-full w-full object-contain object-left", imageClassName)}
              onError={() => setFullLogoFailed(true)}
            />
          </motion.div>
          <p
            className={cn(
              "mt-1 flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
              inverse ? "text-white/70" : "text-[var(--role-accent-text)] dark:text-[var(--role-accent-text-dark)]",
            )}
            data-testid="projtrack-role-label"
          >
            {showRoleDot ? (
              <span
                className="projtrack-role-dot h-2 w-2 shrink-0 rounded-full bg-[var(--role-dot)]"
                aria-hidden="true"
              />
            ) : null}
            <span className={cn("min-w-0", showRoleDot ? "whitespace-nowrap" : "truncate")}>
              {label}
            </span>
          </p>
        </div>
      ) : (
        <>
          <motion.div
            className={cn(
              "projtrack-logo-mark relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--role-accent)] text-white shadow-lg",
              markClassName,
            )}
            initial={reducedMotion ? false : { scale: 0.94 }}
            animate={reducedMotion ? undefined : { scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.28 }}
            aria-hidden="true"
          >
            <span className="relative z-10 font-display text-[13px] font-black tracking-[0.04em]">
              PT
            </span>
            <span className="absolute bottom-2 left-2 right-2 h-0.5 rounded-full bg-white/70" />
            <span className="absolute -right-3 -top-3 h-9 w-9 rounded-full bg-white/22" />
          </motion.div>
          {!compact ? (
            <div className={cn("min-w-0", textClassName)}>
              <p
                className={cn(
                  "font-display text-base font-semibold leading-none",
                  inverse ? "text-white" : "text-slate-900 dark:text-slate-100",
                )}
              >
                {resolvedBranding.brandName || BRAND_NAME}
              </p>
              <p
                className={cn(
                  "mt-1 flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
                  inverse ? "text-white/70" : "text-[var(--role-accent-text)] dark:text-[var(--role-accent-text-dark)]",
                )}
                data-testid="projtrack-role-label"
              >
                {showRoleDot ? (
                  <span
                    className="projtrack-role-dot h-2 w-2 shrink-0 rounded-full bg-[var(--role-dot)]"
                    aria-hidden="true"
                  />
                ) : null}
                <span className={cn("min-w-0", showRoleDot ? "whitespace-nowrap" : "truncate")}>
                  {label}
                </span>
              </p>
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
