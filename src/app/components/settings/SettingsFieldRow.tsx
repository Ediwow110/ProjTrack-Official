import type { ReactNode } from "react";

import { BodyText } from "../ui/typography";
import { cn } from "../ui/utils";

export function SettingsFieldRow({
  label,
  htmlFor,
  labelId,
  description,
  error,
  required = false,
  layout = "stacked",
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  description?: string;
  error?: string | null;
  required?: boolean;
  layout?: "stacked" | "inline";
  className?: string;
  children: ReactNode;
}) {
  const labelNode = (
    <label
      htmlFor={htmlFor}
      id={labelId}
      className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
    >
      {label}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </label>
  );

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-[var(--radius-card)] border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-900/30 sm:flex-row sm:items-start sm:justify-between",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          {labelNode}
          {description ? (
            <BodyText className="mt-1 text-xs leading-6" tone="muted">
              {description}
            </BodyText>
          ) : null}
          {error ? <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p> : null}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {labelNode}
      {description ? (
        <BodyText className="text-xs leading-6" tone="muted">
          {description}
        </BodyText>
      ) : null}
      <div>{children}</div>
      {error ? <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}
