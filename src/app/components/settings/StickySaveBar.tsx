import { RotateCcw, Save } from "lucide-react";

import { Button } from "../ui/button";
import { BodyText, SectionTitle } from "../ui/typography";
import { cn } from "../ui/utils";

export function StickySaveBar({
  open,
  saving = false,
  disabled = false,
  title = "Unsaved changes",
  description = "Review your updates, then save when you're ready.",
  saveLabel = "Save changes",
  resetLabel = "Reset changes",
  onSave,
  onReset,
  className,
}: {
  open: boolean;
  saving?: boolean;
  disabled?: boolean;
  title?: string;
  description?: string;
  saveLabel?: string;
  resetLabel?: string;
  onSave: () => void;
  onReset: () => void;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[var(--z-toast)]">
      <div className="mx-auto w-full max-w-[var(--content-width-wide)] px-[var(--page-pad-inline)]">
        <div
          className={cn(
            "pointer-events-auto rounded-[var(--radius-panel)] border border-slate-200/80 bg-white/92 px-4 py-4 shadow-[var(--shadow-panel)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/92 sm:px-5",
            className,
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <SectionTitle className="text-base">{title}</SectionTitle>
              <BodyText className="mt-1 text-xs leading-6" tone="muted">
                {description}
              </BodyText>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={onReset} disabled={saving || disabled}>
                <RotateCcw size={14} />
                {resetLabel}
              </Button>
              <Button type="button" onClick={onSave} disabled={saving || disabled}>
                <Save size={14} />
                {saving ? "Saving..." : saveLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
