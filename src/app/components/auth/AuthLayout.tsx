import type { ComponentType, ReactNode } from "react";
  import { Lock } from "lucide-react";
  import { motion, useReducedMotion } from "motion/react";

  import {
    fadeUpVariants,
    scaleInVariants,
    staggerContainer,
  } from "../../lib/motion";
  import { roleThemeStyle, roleThemes, type PortalRole } from "../../lib/roleTheme";
  import { ProjTrackLogo } from "../brand/ProjTrackLogo";
  import { cn } from "../ui/utils";

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

  const roleNames: Record<PortalRole, string> = {
    student: "Student",
    teacher: "Teacher",
    admin: "Admin",
  };

  export function AuthLayout({
    role,
    portalEyebrow,
    cardKicker,
    headlinePre,
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
    headlinePre: string;
    headlineAccent: string;
    description: string;
    icon: AuthIcon;
    features?: AuthFeature[];
    securityBadge?: string;
    children: ReactNode;
    footer?: ReactNode;
  }) {
    const reducedMotion = useReducedMotion() ?? false;
    const theme = roleThemes[role];
    const year = new Date().getFullYear();
    void theme;

    return (
      <div
        className={cn(
          "auth-login-page auth-starry-login min-h-screen overflow-hidden text-white",
          `portal-role-${role}`,
        )}
        style={roleThemeStyle(role)}
        data-auth-role={role}
      >
        <div className="auth-starfield" aria-hidden="true" />
        <div className="auth-dot-grid" aria-hidden="true" />
        <motion.div
          className="auth-space-glow auth-space-glow-primary"
          aria-hidden="true"
          animate={reducedMotion ? { opacity: 0.72 } : { opacity: [0.62, 0.82, 0.62], scale: [1, 1.035, 1] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="auth-space-glow auth-space-glow-secondary"
          aria-hidden="true"
          animate={reducedMotion ? { opacity: 0.48 } : { opacity: [0.42, 0.6, 0.42], scale: [1, 1.025, 1] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="auth-leaf auth-leaf-bl" aria-hidden="true" />
        <div className="auth-leaf auth-leaf-br" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid flex-1 items-center gap-8 py-6 md:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(27rem,35rem)] lg:gap-14">
            <motion.aside
              className="auth-login-hero"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(reducedMotion, {
                delayChildren: 0.08,
                staggerChildren: 0.08,
              })}
            >
              <motion.div variants={fadeUpVariants(reducedMotion)}>
                <ProjTrackLogo
                  role={role}
                  inverse
                  subtitle="PROJECT SUBMISSION MANAGEMENT SYSTEM"
                  className="auth-hero-logo"
                  markClassName="h-[4.25rem] w-[4.25rem] rounded-[1.45rem]"
                  textClassName="auth-hero-logo-text"
                />
              </motion.div>

              <motion.div className="auth-hero-copy" variants={fadeUpVariants(reducedMotion, { delay: 0.04 })}>
                <span className="auth-hero-eyebrow">{portalEyebrow}</span>
                <h1 className="auth-hero-headline">
                  {headlinePre}
                  <span className="auth-hero-headline-accent">{headlineAccent}</span>
                </h1>
                <p className="auth-hero-description">{description}</p>
                <span className="auth-hero-rule" aria-hidden="true" />
              </motion.div>

              {features.length ? (
                <motion.div
                  className="auth-feature-grid"
                  variants={staggerContainer(reducedMotion, {
                    delayChildren: 0.18,
                    staggerChildren: 0.06,
                  })}
                >
                  {features.map((feature) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <motion.div
                        key={`${feature.label}-${feature.sub}`}
                        className="auth-feature-card"
                        variants={fadeUpVariants(reducedMotion, { distance: 12 })}
                      >
                        <div className="auth-feature-icon" aria-hidden="true">
                          <FeatureIcon size={22} strokeWidth={1.9} />
                        </div>
                        <p className="auth-feature-label">
                          <span>{feature.label}</span>
                          <span>{feature.sub}</span>
                        </p>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : null}
            </motion.aside>

            <motion.main
              className="auth-login-card"
              variants={scaleInVariants(reducedMotion, { scale: 0.982 })}
              initial="hidden"
              animate="visible"
              data-testid="login-card"
            >
              <motion.div
                className="auth-card-icon"
                variants={scaleInVariants(reducedMotion, { delay: 0.08, scale: 0.92 })}
              >
                <Icon size={42} strokeWidth={1.8} />
              </motion.div>

              <motion.div variants={fadeUpVariants(reducedMotion, { delay: 0.1 })}>
                <h2 className="auth-card-title">Welcome Back!</h2>
                <p className="auth-card-divider">
                  <span className="auth-card-divider-line" aria-hidden="true" />
                  <span className="auth-card-divider-text">{cardKicker}</span>
                  <span className="auth-card-divider-line" aria-hidden="true" />
                </p>
              </motion.div>

              <motion.div className="mt-6" variants={fadeUpVariants(reducedMotion, { delay: 0.14 })}>
                {children}
              </motion.div>

              {securityBadge ? (
                <motion.div
                  className="auth-security-badge"
                  variants={fadeUpVariants(reducedMotion, { delay: 0.18 })}
                >
                  <span className="auth-security-divider" aria-hidden="true">
                    <span />
                    <span className="auth-security-divider-text">or</span>
                    <span />
                  </span>
                  <p className="auth-security-text">
                    <Lock size={16} className="shrink-0" aria-hidden="true" />
                    <span>{securityBadge}</span>
                  </p>
                </motion.div>
              ) : null}

              {footer ? (
                <motion.div
                  className="auth-footer-text mt-6"
                  variants={fadeUpVariants(reducedMotion, { delay: 0.18 })}
                >
                  {footer}
                </motion.div>
              ) : null}

              <span className="sr-only">{`Sign in to the ${roleNames[role]} portal`}</span>
            </motion.main>
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
        <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.06] px-4 py-3.5 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.95)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-slate-300">
            <Icon size={16} />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
      </label>
    );
  }
  