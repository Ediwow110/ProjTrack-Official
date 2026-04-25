import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "../../ui/utils";

export type FilterToolbarProps = {
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
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
  primaryFilters,
  secondaryFilters,
  primaryAction,
  secondaryActions,
  onResetFilters,
  hasActiveFilters = false,
  className,
}: FilterToolbarProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-3">
        <div className="portal-search-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-200/75 bg-white/88 px-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)]">
          <Search size={16} className="shrink-0 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
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
