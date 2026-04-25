import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";

import { PortalTablePanel } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { cn } from "../../ui/utils";

export type DataColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  widthClassName?: string;
  align?: "left" | "center" | "right";
  renderCell: (row: T) => ReactNode;
};

export type RowAction<T> = {
  key: string;
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  icon?: ReactNode;
  ariaLabel?: string | ((row: T) => string);
  tone?: "default" | "danger";
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
};

export type DataTableCardProps<T> = {
  title?: string;
  description?: string;
  action?: ReactNode;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyState?: ReactNode;
  onRetry?: () => void;
  selectable?: boolean;
  selectedRowKeys?: string[];
  onToggleRow?: (key: string) => void;
  onToggleAll?: () => void;
  rowActions?: RowAction<T>[] | ((row: T) => RowAction<T>[]);
  onRowClick?: (row: T) => void;
  sortState?: {
    columnKey: string;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
  className?: string;
  tableClassName?: string;
  pageSize?: number;
};

function renderSortIcon(direction?: "asc" | "desc") {
  if (direction === "asc") {
    return <ChevronUp size={14} className="text-slate-400" />;
  }

  if (direction === "desc") {
    return <ChevronDown size={14} className="text-slate-400" />;
  }

  return <ArrowUpDown size={14} className="text-slate-400" />;
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  const pages = Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages]),
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const items: Array<number | string> = [];
  pages.forEach((page, index) => {
    const previousPage = pages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push(`ellipsis-${page}`);
    }
    items.push(page);
  });
  return items;
}

export function DataTableCard<T>({
  title,
  description,
  action,
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  emptyState,
  onRetry,
  selectable = false,
  selectedRowKeys = [],
  onToggleRow,
  onToggleAll,
  rowActions,
  onRowClick,
  sortState,
  onSortChange,
  className,
  tableClassName,
  pageSize = 8,
}: DataTableCardProps<T>) {
  const hasRows = rows.length > 0;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleRows = useMemo(() => {
    if (!hasRows) return rows;
    const startIndex = (currentPage - 1) * safePageSize;
    return rows.slice(startIndex, startIndex + safePageSize);
  }, [currentPage, hasRows, rows, safePageSize]);

  const showingFrom = hasRows ? (currentPage - 1) * safePageSize + 1 : 0;
  const showingTo = hasRows ? Math.min(currentPage * safePageSize, rows.length) : 0;
  const allRowsSelected =
    selectable &&
    hasRows &&
    rows.every((row) => selectedRowKeys.includes(rowKey(row)));
  const paginationItems = buildPaginationItems(currentPage, totalPages);

  return (
    <PortalTablePanel
      title={title}
      description={description}
      action={action}
      className={className}
    >
      {loading && !hasRows ? (
        <div className="p-5 sm:p-6">
          <div className="space-y-3">
            {Array.from({ length: safePageSize }).map((_, index) => (
              <div
                key={index}
                className="h-12 animate-pulse rounded-[var(--radius-control)] bg-slate-100 dark:bg-slate-800/70"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="rounded-[var(--radius-control)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
            {error}
          </div>
          {onRetry ? (
            <div>
              <Button type="button" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      ) : !hasRows ? (
        <div className="p-5 sm:p-6">{emptyState}</div>
      ) : (
        <>
          <Table className={cn("min-w-[1040px]", tableClassName)}>
            <TableHeader className="bg-slate-50/85 dark:bg-slate-800/60">
              <TableRow className="hover:bg-transparent">
                {selectable ? (
                  <TableHead className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(allRowsSelected)}
                      aria-label="Select all rows"
                      onChange={() => onToggleAll?.()}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--role-accent)]"
                    />
                  </TableHead>
                ) : null}
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.widthClassName,
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 transition hover:text-slate-600 dark:hover:text-slate-200",
                          column.align === "center" && "mx-auto",
                          column.align === "right" && "ml-auto",
                        )}
                      >
                        <span>{column.header}</span>
                        {renderSortIcon(
                          sortState?.columnKey === column.key ? sortState.direction : undefined,
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
                {rowActions ? (
                  <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Actions
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const key = rowKey(row);
                const actions =
                  typeof rowActions === "function" ? rowActions(row) : (rowActions ?? []);
                const visibleActions = actions.filter((item) => !item.hidden?.(row));

                return (
                  <TableRow
                    key={key}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer hover:bg-slate-50/85 dark:hover:bg-slate-800/55",
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {selectable ? (
                      <TableCell className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.includes(key)}
                          aria-label={`Select row ${key}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggleRow?.(key)}
                          className="h-4 w-4 rounded border-slate-300 text-[var(--role-accent)]"
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "px-5 py-4",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.widthClassName,
                        )}
                      >
                        {column.renderCell(row)}
                      </TableCell>
                    ))}
                    {rowActions ? (
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {visibleActions.map((item) => {
                            const label =
                              typeof item.label === "function" ? item.label(row) : item.label;
                            const ariaLabel =
                              typeof item.ariaLabel === "function"
                                ? item.ariaLabel(row)
                                : (item.ariaLabel ?? label);
                            const isDangerAction = item.tone === "danger";

                            return (
                              <Button
                                key={item.key}
                                type="button"
                                variant={item.icon ? "ghost" : "link"}
                                size={item.icon ? "icon" : "sm"}
                                title={label}
                                aria-label={item.icon ? label : ariaLabel}
                                disabled={item.disabled?.(row)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  item.onClick(row);
                                }}
                                className={cn(
                                  item.icon
                                    ? isDangerAction
                                      ? "h-8 w-8 rounded-xl border border-rose-200/80 bg-rose-50/80 p-0 text-rose-700 shadow-none transition-colors hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/45 dark:hover:bg-rose-500/20"
                                      : "h-8 w-8 rounded-xl border border-slate-200/80 bg-white/90 p-0 text-blue-700 shadow-none transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/12"
                                    : "h-auto px-0",
                                  isDangerAction
                                    ? "text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
                                    : "text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200",
                                )}
                              >
                                {item.icon ? item.icon : label}
                              </Button>
                            );
                          })}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-slate-200/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/70">
              <p className="text-xs font-medium text-slate-400">
                Showing {showingFrom}-{showingTo} of {rows.length}
              </p>
              <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={currentPage === 1}
                      className={cn(
                        currentPage === 1 && "pointer-events-none opacity-50",
                      )}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((page) => page - 1);
                        }
                      }}
                    />
                  </PaginationItem>

                  {paginationItems.map((item) =>
                    typeof item === "number" ? (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === currentPage}
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ),
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={currentPage === totalPages}
                      className={cn(
                        currentPage === totalPages && "pointer-events-none opacity-50",
                      )}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((page) => page + 1);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </>
      )}
    </PortalTablePanel>
  );
}
