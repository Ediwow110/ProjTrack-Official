import { BootstrapIcon, BootstrapIconTooltip, type BootstrapIconName, type BootstrapIconTone } from "./bootstrap-icon";

type StatusTone = BootstrapIconTone;

type StatusPresentation = {
  display: string;
  classes: string;
  icon: BootstrapIconName;
  tone: StatusTone;
  tooltip: string;
};

const toneClasses: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/25",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/25",
  primary: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/25",
  secondary: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
  muted: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
};

function titleCase(value: string) {
  const cleaned = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Unknown";

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStatus(status: string) {
  return String(status || "Unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function getStatusPresentation(status: string): StatusPresentation {
  const normalized = normalizeStatus(status);
  const display = titleCase(status);

  // Dangerous states: destructive, blocked, failed, closed, or no longer actionable.
  if (
    includesAny(normalized, [
      "fail",
      "failed",
      "failure",
      "error",
      "rejected",
      "restricted",
      "overdue",
      "closed",
      "blocked",
      "dead",
      "cancelled",
      "canceled",
      "disabled",
      "locked",
      "account restricted",
    ])
  ) {
    return {
      display,
      classes: toneClasses.danger,
      icon: "x-circle-fill",
      tone: "danger",
      tooltip: `${display}: danger state. Check the blocker or failure before continuing.`,
    };
  }

  // Successful states: completed, usable, accepted, open/reopened windows, and graded work.
  if (
    includesAny(normalized, [
      "graded",
      "approved",
      "active",
      "healthy",
      "ready",
      "sent",
      "completed",
      "complete",
      "done",
      "connected",
      "open",
      "reopened",
      "available",
      "verified",
    ])
  ) {
    return {
      display,
      classes: toneClasses.success,
      icon: "check-circle-fill",
      tone: "success",
      tooltip: `${display}: success state. The item is available or completed.`,
    };
  }

  // Warning states: late, waiting, needs action, not yet available, or still in progress.
  if (
    includesAny(normalized, [
      "late",
      "pending",
      "revision",
      "processing",
      "queued",
      "upcoming",
      "due soon",
      "not yet open",
      "waiting",
      "needs",
      "review",
    ])
  ) {
    return {
      display,
      classes: toneClasses.warning,
      icon: "exclamation-triangle-fill",
      tone: "warning",
      tooltip: `${display}: warning state. Review timing, requirements, or next action.`,
    };
  }

  if (includesAny(normalized, ["draft", "inactive", "archived", "paused", "empty", "none"])) {
    return {
      display,
      classes: toneClasses.muted,
      icon: "archive-fill",
      tone: "muted",
      tooltip: `${display}: inactive or non-final state.`,
    };
  }

  if (includesAny(normalized, ["submitted", "new", "info", "preview", "scan"])) {
    return {
      display,
      classes: toneClasses.info,
      icon: "info-circle-fill",
      tone: "info",
      tooltip: `${display}: informational state.`,
    };
  }

  return {
    display,
    classes: toneClasses.secondary,
    icon: "info-circle-fill",
    tone: "secondary",
    tooltip: `${display}: status.`,
  };
}

export function StatusChip({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const semantic = getStatusPresentation(status);
  return (
    <BootstrapIconTooltip label={semantic.tooltip}>
      <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${semantic.classes}
        ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
        <BootstrapIcon name={semantic.icon} tone={semantic.tone} size={size === "xs" ? 10 : 11} />
        {semantic.display}
      </span>
    </BootstrapIconTooltip>
  );
}
