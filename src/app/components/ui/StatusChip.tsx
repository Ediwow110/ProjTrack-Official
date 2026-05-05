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

const toneIcons: Record<StatusTone, BootstrapIconName> = {
  success: "check-circle-fill",
  danger: "x-circle-fill",
  warning: "exclamation-triangle-fill",
  info: "info-circle-fill",
  primary: "info-circle-fill",
  secondary: "info-circle-fill",
  muted: "archive-fill",
};

const toneTooltips: Record<StatusTone, (display: string) => string> = {
  success: (d) => `${d}: success state. The item is available or completed.`,
  danger: (d) => `${d}: danger state. Check the blocker or failure before continuing.`,
  warning: (d) => `${d}: warning state. Review timing, requirements, or next action.`,
  info: (d) => `${d}: informational state.`,
  primary: (d) => `${d}: status.`,
  secondary: (d) => `${d}: status.`,
  muted: (d) => `${d}: inactive or non-final state.`,
};

function titleCase(value: string): string {
  const cleaned = String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.toLowerCase() === "null" || cleaned.toLowerCase() === "undefined") {
    return "Unknown";
  }

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeStatus(status: string | null | undefined): string {
  const raw = String(status ?? "").trim();
  if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return "unknown";
  }
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Exact full-string matches take priority. Use this for multi-word phrases or
// special cases that must NOT be subject to token-based fallback (e.g.
// "Pending Activation" must be warning, not success — even though it contains
// the token "activation" which shares a stem with the success token "active").
const EXACT_TONE: Record<string, StatusTone> = {
  // Account / user
  "pending activation": "warning",
  "account restricted": "danger",
  "needs activation": "warning",
  // Submissions / reviews
  "pending review": "warning",
  "needs revision": "warning",
  "changes requested": "warning",
  "due soon": "warning",
  "not yet open": "warning",
  "not submitted": "muted",
  "in progress": "info",
  // Release / deploy / system
  "not run": "muted",
  "not yet run": "muted",
  "not configured": "warning",
  "no data": "muted",
  unknown: "muted",
};

// Token-priority order matters: danger > warning > muted > success > info.
// Critically, MUTED is checked before SUCCESS so "inactive" is matched as muted
// before any (token-equal) success match could ever apply. Token matching is
// word-boundary based (split on whitespace) so "inactive" never collides with
// the success token "active". Likewise "deactivated" / "reactivated" stay out
// of the success branch unless explicitly added.
const DANGER_TOKENS = new Set([
  "fail", "failed", "failure", "error", "errored",
  "rejected", "blocked", "dead", "down", "unhealthy",
  "suspended", "locked", "restricted", "overdue",
  "closed", "expired", "denied", "fatal",
]);

const WARNING_TOKENS = new Set([
  "pending", "warning", "warn", "degraded", "manual",
  "late", "retrying", "retry", "needs", "revision",
  "waiting", "upcoming", "review",
]);

// Muted is checked BEFORE success/info so "inactive", "archived", etc. take
// priority over any token they might share with another bucket.
const MUTED_TOKENS = new Set([
  "inactive", "archived", "disabled", "draft", "paused",
  "empty", "none", "cancelled", "canceled", "skipped",
  "unknown", "deactivated", "deleted",
]);

const SUCCESS_TOKENS = new Set([
  "active", "healthy", "completed", "complete", "sent",
  "delivered", "approved", "graded", "passed", "success",
  "imported", "verified", "connected", "available", "open",
  "done", "reopened", "reviewed", "ok", "live",
]);

const INFO_TOKENS = new Set([
  "submitted", "new", "info", "running", "processing",
  "queued", "preview", "scan", "ready", "scheduled",
]);

function tokensFromNormalized(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

export function getStatusTone(status: string | null | undefined): StatusTone {
  const normalized = normalizeStatus(status);

  // 1. Exact-match overrides for multi-word and special-case statuses.
  const exact = EXACT_TONE[normalized];
  if (exact) return exact;

  // 2. Token-based matching with strict priority order. Word boundaries
  //    eliminate substring false-positives (the original bug:
  //    "inactive".includes("active") === true).
  const tokens = tokensFromNormalized(normalized);

  for (const token of tokens) {
    if (DANGER_TOKENS.has(token)) return "danger";
  }
  for (const token of tokens) {
    if (WARNING_TOKENS.has(token)) return "warning";
  }
  for (const token of tokens) {
    if (MUTED_TOKENS.has(token)) return "muted";
  }
  for (const token of tokens) {
    if (SUCCESS_TOKENS.has(token)) return "success";
  }
  for (const token of tokens) {
    if (INFO_TOKENS.has(token)) return "info";
  }

  // 3. Safe neutral fallback (never green/success for unrecognized statuses).
  return "muted";
}

export function getStatusLabel(status: string | null | undefined): string {
  return titleCase(String(status ?? ""));
}

export function getStatusPresentation(status: string | null | undefined): StatusPresentation {
  const display = getStatusLabel(status);
  const tone = getStatusTone(status);
  return {
    display,
    classes: toneClasses[tone],
    icon: toneIcons[tone],
    tone,
    tooltip: toneTooltips[tone](display),
  };
}

export function StatusChip({ status, size = "sm" }: { status: string | null | undefined; size?: "xs" | "sm" }) {
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
