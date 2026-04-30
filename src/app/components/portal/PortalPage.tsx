import type { ComponentType, ReactNode } from "react";
import { PageContainer, SectionHeader, Stack } from "../layout/primitives";
import { BodyText, DisplayTitle, Eyebrow, SectionTitle } from "../ui/typography";
import { cn } from "../ui/utils";

type PortalIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

type PortalTone = "blue" | "teal" | "slate";

const toneStyles: Record<
  PortalTone,
  {
    hero: string;
    heroBorder: string;
    heroGlow: string;
    iconWrap: string;
    iconColor: string;
    softBadge: string;
    statCard: string;
    statBorder: string;
  }
> = {
  blue: {
    hero: "portal-hero portal-hero-blue",
    heroBorder: "",
    heroGlow: "portal-hero-glow-primary",
    iconWrap: "portal-hero-icon",
    iconColor: "portal-hero-icon-symbol",
    softBadge: "portal-hero-badge",
    statCard: "portal-hero-stat",
    statBorder: "",
  },
  teal: {
    hero: "portal-hero portal-hero-teal",
    heroBorder: "",
    heroGlow: "portal-hero-glow-primary",
    iconWrap: "portal-hero-icon",
    iconColor: "portal-hero-icon-symbol",
    softBadge: "portal-hero-badge",
    statCard: "portal-hero-stat",
    statBorder: "",
  },
  slate: {
    hero: "portal-hero portal-hero-slate",
    heroBorder: "",
    heroGlow: "portal-hero-glow-primary",
    iconWrap: "portal-hero-icon",
    iconColor: "portal-hero-icon-symbol",
    softBadge: "portal-hero-badge",
    statCard: "portal-hero-stat",
    statBorder: "",
  },
};

export function PortalPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <PageContainer
      width="wide"
      className={cn(
        "relative",
        className,
      )}
    >
      {children}
    </PageContainer>
  );
}

export function PortalHero({
  tone = "blue",
  eyebrow,
  title,
  description,
  icon: Icon,
  meta = [],
  stats = [],
  actions,
  className,
}: {
  tone?: PortalTone;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: PortalIcon;
  meta?: Array<{ label: string; value?: string }>;
  stats?: Array<{ label: string; value: string; hint?: string }>;
  actions?: ReactNode;
  className?: string;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-hero)] border p-6 shadow-[var(--shadow-hero)] sm:p-8 lg:p-10",
        toneStyle.hero,
        toneStyle.heroBorder,
        className,
      )}
    >
      <div
        className={cn(
          "absolute -right-12 top-0 h-52 w-52 rounded-full blur-3xl",
          toneStyle.heroGlow,
        )}
      />
      <div className="portal-hero-glow-secondary absolute bottom-0 left-8 h-24 w-40 rounded-full blur-3xl" />
      <div className="portal-hero-divider absolute inset-x-0 bottom-0 h-px" />

      <div className="relative flex flex-col gap-[var(--section-gap-xl)] xl:flex-row xl:items-end xl:justify-between">
        <Stack gap="md" className="max-w-3xl">
          {eyebrow ? <Eyebrow className="portal-hero-eyebrow">{eyebrow}</Eyebrow> : null}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {Icon ? (
              <div
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] backdrop-blur-sm",
                  toneStyle.iconWrap,
                )}
              >
                <Icon size={28} className={toneStyle.iconColor} />
              </div>
            ) : null}

            <Stack gap="sm">
              <DisplayTitle className="portal-hero-title">
                {title}
              </DisplayTitle>
              {description ? (
                <BodyText className="portal-hero-body max-w-2xl text-base" tone="inverse">
                  {description}
                </BodyText>
              ) : null}
            </Stack>
          </div>

          {meta.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {meta.map((item) => (
                <div
                  key={`${item.label}-${item.value ?? ""}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold backdrop-blur-sm",
                    toneStyle.softBadge,
                  )}
                >
                  <span className="portal-hero-badge-label">{item.label}</span>
                  {item.value ? <span className="portal-hero-badge-value">{item.value}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </Stack>

        {actions ? (
          <div className="flex flex-wrap items-center gap-3 xl:max-w-sm xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {stats.length > 0 ? (
        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-[var(--radius-card)] border px-4 py-4 backdrop-blur-sm",
                toneStyle.statCard,
                toneStyle.statBorder,
              )}
            >
              <Eyebrow className="portal-hero-stat-label text-[0.68rem]">{stat.label}</Eyebrow>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {stat.value}
              </p>
              {stat.hint ? (
                <BodyText className="portal-hero-stat-hint mt-1.5 text-xs leading-5" tone="inverse">
                  {stat.hint}
                </BodyText>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PortalPanel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "portal-card overflow-hidden rounded-[var(--radius-panel)] border shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {title || description || action ? (
        <div className="border-b border-slate-200/70 px-5 py-5 dark:border-slate-700/60 sm:px-6">
          <SectionHeader
            title={title ? <SectionTitle>{title}</SectionTitle> : null}
            description={
              description ? <BodyText tone="muted">{description}</BodyText> : null
            }
            action={action}
          />
        </div>
      ) : null}
      <div className={cn("px-5 py-5 sm:px-6", contentClassName)}>{children}</div>
    </section>
  );
}

export function PortalMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: PortalIcon;
  tone?: PortalTone;
  className?: string;
}) {
  const toneMap: Record<
    PortalTone,
    { wrap: string; iconWrap: string; iconColor: string; hintColor: string }
  > = {
    blue: {
      wrap:
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(239,246,255,0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(30,41,59,0.92)_100%)]",
      iconWrap: "bg-blue-100 dark:bg-blue-500/15",
      iconColor: "text-blue-700 dark:text-blue-200",
      hintColor: "text-blue-700/70 dark:text-blue-200/70",
    },
    teal: {
      wrap:
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(240,253,250,0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(19,78,74,0.28)_100%)]",
      iconWrap: "bg-teal-100 dark:bg-teal-500/15",
      iconColor: "text-teal-700 dark:text-teal-200",
      hintColor: "text-teal-700/70 dark:text-teal-200/70",
    },
    slate: {
      wrap:
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.94)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(30,41,59,0.92)_100%)]",
      iconWrap: "bg-slate-200 dark:bg-slate-700/70",
      iconColor: "text-slate-700 dark:text-slate-100",
      hintColor: "text-slate-500 dark:text-slate-300/75",
    },
  };
  const palette = toneMap[tone];

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-white/70 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm dark:border-slate-700/60",
        palette.wrap,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow className="text-[0.7rem]">{label}</Eyebrow>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {hint ? (
            <BodyText className={cn("mt-2 text-xs leading-5", palette.hintColor)} tone="muted">
              {hint}
            </BodyText>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              palette.iconWrap,
            )}
          >
            <Icon size={18} className={palette.iconColor} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PortalEmptyState({
  title,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  description: string;
  icon?: PortalIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "portal-card rounded-[var(--radius-panel)] border border-dashed px-6 py-10 text-center shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {Icon ? (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Icon size={22} />
        </div>
      ) : null}
      <SectionTitle className="mt-4">
        {title}
      </SectionTitle>
      <BodyText className="mx-auto mt-2 max-w-xl" tone="muted">
        {description}
      </BodyText>
    </div>
  );
}
