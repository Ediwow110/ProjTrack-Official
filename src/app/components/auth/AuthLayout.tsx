import type { ComponentType, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  fadeUpVariants,
  scaleInVariants,
  staggerContainer,
} from "../../lib/motion";
import { PageContainer, Stack } from "../layout/primitives";
import { BodyText, DisplayTitle, Eyebrow, SectionTitle } from "../ui/typography";
import { cn } from "../ui/utils";

type AuthRole = "student" | "teacher" | "admin";
type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export function AuthLayout({
  role,
  title,
  subtitle,
  hint,
  icon: Icon,
  badge,
  metrics = [],
  children,
  footer,
}: {
  role: AuthRole;
  title: string;
  subtitle: string;
  hint: string;
  icon: AuthIcon;
  badge: string;
  metrics?: Array<{ label: string; value: string }>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div
      className={cn(
        "auth-login-page min-h-screen bg-[var(--surface-canvas)] text-[var(--text-strong)]",
        `portal-role-${role}`,
      )}
    >
      <div className="auth-role-background min-h-screen">
        <PageContainer
          width="wide"
          className="relative flex min-h-screen items-center py-[clamp(1.5rem,4vw,3rem)]"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="auth-ambient-orb auth-ambient-orb-primary left-[-5rem] top-12 h-48 w-48 md:h-64 md:w-64"
              animate={
                reducedMotion
                  ? { opacity: 0.65 }
                  : { x: [0, 18, 0], y: [0, -12, 0], scale: [1, 1.04, 1] }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 12, ease: "easeInOut", repeat: Infinity }
              }
            />
            <motion.div
              className="auth-ambient-orb auth-ambient-orb-secondary bottom-8 right-[-4rem] h-56 w-56 md:h-72 md:w-72"
              animate={
                reducedMotion
                  ? { opacity: 0.55 }
                  : { x: [0, -16, 0], y: [0, 14, 0], scale: [1, 1.05, 1] }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 14, ease: "easeInOut", repeat: Infinity }
              }
            />
          </div>

          <motion.div
            className="grid w-full overflow-hidden rounded-[calc(var(--radius-hero)+0.25rem)] border border-white/75 bg-[rgba(255,255,255,0.78)] shadow-[var(--shadow-shell)] backdrop-blur-xl lg:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)]"
            initial="hidden"
            animate="visible"
            variants={scaleInVariants(reducedMotion, { scale: 0.992 })}
          >
            <motion.aside
              className="auth-role-hero relative hidden min-h-[42rem] flex-col justify-between p-8 text-white lg:flex xl:p-10"
              variants={staggerContainer(reducedMotion, {
                delayChildren: 0.08,
                staggerChildren: 0.08,
              })}
            >
              <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
              <Stack gap="lg" className="relative z-10">
                <motion.div
                  className="flex items-center justify-between gap-4"
                  variants={fadeUpVariants(reducedMotion)}
                >
                  <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/72 backdrop-blur-sm">
                    {badge}
                  </div>
                </motion.div>

                <motion.div className="max-w-xl" variants={fadeUpVariants(reducedMotion, { delay: 0.04 })}>
                  <motion.div
                    className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/12 ring-1 ring-white/15 backdrop-blur-sm"
                    variants={scaleInVariants(reducedMotion, { delay: 0.08, scale: 0.94 })}
                  >
                    <Icon size={28} className="text-white" />
                  </motion.div>
                  <Eyebrow className="text-white/65">ProjTrack Access</Eyebrow>
                  <DisplayTitle className="mt-4 text-white">{title}</DisplayTitle>
                  <BodyText className="mt-4 max-w-lg text-base" tone="inverse">
                    {subtitle}
                  </BodyText>
                </motion.div>
              </Stack>

              <motion.div
                className="relative z-10 grid grid-cols-3 gap-3"
                variants={staggerContainer(reducedMotion, {
                  delayChildren: 0.18,
                  staggerChildren: 0.06,
                })}
              >
                {metrics.map((metric) => (
                  <motion.div
                    key={metric.label}
                    className="rounded-[var(--radius-card)] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm"
                    variants={fadeUpVariants(reducedMotion, { distance: 14 })}
                  >
                    <p className="text-2xl font-semibold tracking-[-0.04em] text-white">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-[0.72rem] font-medium leading-5 text-white/58">
                      {metric.label}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.aside>

            <motion.main
              className="flex min-h-[42rem] flex-col justify-center bg-[rgba(255,255,255,0.88)] p-6 sm:p-8 lg:p-10"
              variants={staggerContainer(reducedMotion, {
                delayChildren: 0.12,
                staggerChildren: 0.08,
              })}
            >
              <motion.div className="mt-0" variants={fadeUpVariants(reducedMotion)}>
                <div className="flex items-start gap-4">
                  <motion.div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[var(--role-accent)] text-white shadow-[var(--shadow-soft)]"
                    variants={scaleInVariants(reducedMotion, { delay: 0.04, scale: 0.92 })}
                  >
                    <Icon size={20} />
                  </motion.div>
                  <div className="min-w-0">
                    <Eyebrow className="portal-accent-text auth-heading-eyebrow">{badge}</Eyebrow>
                    <SectionTitle className="auth-heading-title mt-2 text-2xl sm:text-[1.8rem]">
                      {title}
                    </SectionTitle>
                    <BodyText className="auth-heading-body mt-2 max-w-lg" tone="muted">
                      {hint}
                    </BodyText>
                  </div>
                </div>
              </motion.div>

              <motion.div className="mt-8" variants={fadeUpVariants(reducedMotion, { delay: 0.04 })}>
                {children}
              </motion.div>

              {footer ? (
                <motion.div className="mt-6 auth-footer-text" variants={fadeUpVariants(reducedMotion, { delay: 0.08 })}>
                  {footer}
                </motion.div>
              ) : null}
            </motion.main>
          </motion.div>
        </PageContainer>
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
      <Eyebrow as="span" className="mb-3 block text-slate-500">
        {label}
      </Eyebrow>
      <div className="auth-role-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200 bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </label>
  );
}
