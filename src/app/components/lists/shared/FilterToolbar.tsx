import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "../../ui/utils";

export type FilterToolbarProps = {
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  /**
   * If > 0, the onSearchChange callback is debounced by this many ms.
   * The search input updates immediately; the callback fires after inactivity.
   */
  debounceMs?: number;
  primaryFilters?: ReactNode;
  secondaryFilters?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
};

export function FilterToolbar({
  searchValue,
  searchPlaceholder = "Search",
  onSearchChange,
  debounceMs = 0,
  primaryFilters,
  secondaryFilters,
  primaryAction,
  secondaryActions,
  onResetFilters,
  hasActiveFilters = false,
  className,
}: FilterToolbarProps) {
  // Internal debounce state
  const [localValue, setLocalValue] = useState(searchValue);
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external searchValue changes into local state
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLocalValue(searchValue);
  }, [searchValue]);

  const shouldDebounce = debounceMs > 0;
  const displayValue = shouldDebounce ? localValue : searchValue;
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-3">
        <div className="portal-search-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200/75 bg-white/88 px-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)]">
          <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
          <Input
            value={displayValue}
            onChange={(event) => {
              const next = event.target.value;
              if (shouldDebounce) {
                setLocalValue(next);
                if (debounceTimer.current) clearTimeout(debounceTimer.current);
                debounceTimer.current = setTimeout(() => onSearchChange(next), debounceMs);
              } else {
                onSearchChange(next);
              }
            }}
            placeholder={searchPlaceholder}
            className="h-11 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {primaryFilters ? (
          <div className="flex flex-wrap gap-2">{primaryFilters}</div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-3 xl:items-end">
        {secondaryFilters ? (
          <div className="flex flex-wrap justify-end gap-2">{secondaryFilters}</div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {hasActiveFilters && onResetFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={onResetFilters}>
              Reset filters
            </Button>
          ) : null}
          {secondaryActions}
          {primaryAction}
        </div>
      </div>
    </section>
  );
}
