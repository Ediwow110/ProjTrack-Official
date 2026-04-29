import { BootstrapIcon, BootstrapIconTooltip, type BootstrapIconName, type BootstrapIconTone } from "./bootstrap-icon";

type GradeTone = "success" | "warning" | "danger" | "muted" | "info";

type GradePresentation = {
  label: string;
  tone: GradeTone;
  icon: BootstrapIconName;
  classes: string;
  tooltip: string;
};

const toneClasses: Record<GradeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/25",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/25",
  muted: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
};

function normalize(value?: string | null) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasGrade(value?: string | number | null) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "—" && text !== "-");
}

export function getGradePresentation({
  grade,
  status,
}: {
  grade?: string | number | null;
  status?: string | null;
}): GradePresentation {
  const statusText = normalize(status);
  const displayGrade = hasGrade(grade) ? String(grade).replace(/\/100$/, "") : "—";
  const label = hasGrade(grade) ? `${displayGrade}/100` : "Pending";

  if (/fail|failed|rejected|zero|invalid/.test(statusText)) {
    return {
      label,
      tone: "danger",
      icon: "x-circle-fill",
      classes: toneClasses.danger,
      tooltip: "Failing or rejected result. Review the submission record and feedback.",
    };
  }

  if (/late|overdue|needs revision|returned for revision|pending|review/.test(statusText)) {
    return {
      label,
      tone: "warning",
      icon: "exclamation-triangle-fill",
      classes: toneClasses.warning,
      tooltip: "Warning result. The submission is late, pending review, or needs follow-up.",
    };
  }

  if (/graded|approved|complete|completed/.test(statusText) && hasGrade(grade)) {
    return {
      label,
      tone: "success",
      icon: "check-circle-fill",
      classes: toneClasses.success,
      tooltip: "Graded result. The score has been recorded.",
    };
  }

  if (hasGrade(grade)) {
    return {
      label,
      tone: "info",
      icon: "info-circle-fill",
      classes: toneClasses.info,
      tooltip: "Score recorded. Check the status chip for final grading state.",
    };
  }

  return {
    label,
    tone: "muted",
    icon: "info-circle-fill",
    classes: toneClasses.muted,
    tooltip: "No grade has been recorded yet.",
  };
}

export function GradeChip({
  grade,
  status,
  size = "xs",
}: {
  grade?: string | number | null;
  status?: string | null;
  size?: "xs" | "sm";
}) {
  const presentation = getGradePresentation({ grade, status });
  return (
    <BootstrapIconTooltip label={presentation.tooltip}>
      <span
        className={`inline-flex items-center gap-1 rounded-full font-semibold ${presentation.classes} ${
          size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
        }`}
      >
        <BootstrapIcon name={presentation.icon} tone={presentation.tone as BootstrapIconTone} size={size === "xs" ? 10 : 11} />
        {presentation.label}
      </span>
    </BootstrapIconTooltip>
  );
}
