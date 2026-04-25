import type { ReactNode } from "react";

import { BodyText } from "../../ui/typography";

export type BulkActionBarProps = {
  selectedCount: number;
  actions: ReactNode;
  onClearSelection: () => void;
};

export function BulkActionBar({
  selectedCount,
  actions,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-[var(--role-accent-border)] bg-[var(--role-accent-soft)] px-4 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <BodyText className="font-semibold text-[var(--role-accent-text)] dark:text-[var(--role-accent-text-dark)]">
            {selectedCount} selected
          </BodyText>
          <BodyText className="text-xs text-[var(--role-accent-text)]/80 dark:text-[var(--role-accent-text-dark)]/80">
            Use shared bulk actions or clear the current selection.
          </BodyText>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-[var(--radius-control)] border border-[var(--role-accent-border)] px-3 py-2 text-xs font-semibold text-[var(--role-accent-text)] transition hover:bg-white/45 dark:text-[var(--role-accent-text-dark)] dark:hover:bg-slate-900/30"
          >
            Clear selection
          </button>
        </div>
      </div>
    </section>
  );
}
