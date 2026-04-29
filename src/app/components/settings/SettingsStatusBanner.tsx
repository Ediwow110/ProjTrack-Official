import { BodyText, SectionTitle } from "../ui/typography";
import { cn } from "../ui/utils";
import { BootstrapIcon, type BootstrapIconName, type BootstrapIconTone } from "../ui/bootstrap-icon";

const toneStyles = {
  info: {
    wrap: "border-blue-200 dark:border-blue-500/30 bg-blue-50/90 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-300 dark:text-blue-200",
  },
  success: {
    wrap:
      "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-200",
  },
  warning: {
    wrap:
      "border-amber-200 dark:border-amber-500/30 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-200",
  },
  error: {
    wrap: "border-rose-200 dark:border-rose-500/30 bg-rose-50/90 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-200",
  },
} as const;

export function SettingsStatusBanner({
  tone = "info",
  title,
  description,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  className?: string;
}) {
  const iconName: BootstrapIconName =
    tone === "success"
      ? "check-circle-fill"
      : tone === "warning"
        ? "exclamation-triangle-fill"
        : tone === "error"
          ? "x-circle-fill"
          : "info-circle-fill";
  const iconTone: BootstrapIconTone = tone === "error" ? "danger" : tone;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-[var(--shadow-soft)]",
        toneStyles[tone].wrap,
        className,
      )}
    >
      <BootstrapIcon name={iconName} tone={iconTone} size={18} className={cn("mt-0.5 shrink-0", toneStyles[tone].icon)} />
      <div className="min-w-0">
        <SectionTitle className="text-base">{title}</SectionTitle>
        {description ? (
          <BodyText className="mt-1 text-xs leading-6 opacity-80">
            {description}
          </BodyText>
        ) : null}
      </div>
    </div>
  );
}
