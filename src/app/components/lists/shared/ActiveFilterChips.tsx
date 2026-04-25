import { X } from "lucide-react";

import { Button } from "../../ui/button";

export type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type ActiveFilterChipsProps = {
  items: ActiveFilterChip[];
  onClearAll?: () => void;
};

export function ActiveFilterChips({
  items,
  onClearAll,
}: ActiveFilterChipsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onRemove}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/88 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-300 dark:hover:bg-slate-800/80"
        >
          <span>{item.label}</span>
          <X size={12} />
        </button>
      ))}
      {onClearAll ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
