import type { ComponentType, ReactNode } from "react";
import { Search } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BodyText } from "../ui/typography";
import { cn } from "../ui/utils";
import { PortalHero, PortalPage, PortalPanel } from "./PortalPage";

type PortalIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

type PortalTone = "blue" | "teal" | "slate";
type NoticeTone = "info" | "success" | "warning" | "danger" | "accent";

const noticeToneStyles: Record<NoticeTone, string> = {
  info: "border-blue-200/70 bg-blue-50/85 text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100",
  success:
    "border-emerald-200/70 bg-emerald-50/85 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200/70 bg-amber-50/90 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100",
  danger:
    "border-rose-200/70 bg-rose-50/90 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100",
  accent:
    "border-[var(--role-accent-border)] bg-[var(--role-accent-soft)] text-[var(--role-accent-text)] dark:text-[var(--role-accent-text-dark)]",
};

export function PortalListPageTemplate({
  tone = "slate",
  eyebrow,
  title,
  description,
  icon,
  meta = [],
  stats = [],
  actions,
  toolbar,
  notices,
  children,
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
  toolbar?: ReactNode;
  notices?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PortalPage className={cn("space-y-6", className)}>
      <PortalHero
        tone={tone}
        eyebrow={eyebrow}
        title={title}
        description={description}
        icon={icon}
        meta={meta}
        stats={stats}
        actions={actions}
      />
      {toolbar ? (
        <PortalPanel contentClassName="space-y-4">
          {toolbar}
        </PortalPanel>
      ) : null}
      {notices}
      {children}
    </PortalPage>
  );
}

export function PortalListToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-4">
        {search}
        {filters}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function PortalSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "portal-search-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200/75 bg-white/88 px-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)]",
        className,
      )}
    >
      <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-11 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}

export function PortalToolbarFilterGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}

export function PortalFilterChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 text-xs font-semibold shadow-none",
        active
          ? "border-[var(--role-accent)] bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)] hover:text-white"
          : "border-slate-200/80 bg-white/85 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-300",
      )}
    >
      {children}
    </Button>
  );
}

export function PortalNotice({
  tone = "info",
  icon,
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-control)] border px-4 py-3 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between",
        noticeToneStyles[tone],
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <BodyText className="text-current text-sm font-medium leading-6" tone="default">
          {children}
        </BodyText>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PortalTablePanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PortalPanel
      title={title}
      description={description}
      action={action}
      contentClassName="p-0"
      className={className}
    >
      {children}
    </PortalPanel>
  );
}
