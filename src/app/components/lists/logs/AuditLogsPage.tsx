import { useEffect, useMemo, useState } from "react";
import { Clock3, RefreshCcw, XCircle } from "lucide-react";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { PortalNotice } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import { AuditLogsTable } from "./AuditLogsTable";
import { AuditEventDrawer } from "./AuditEventDrawer";
import { adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import type { AuditLogRecord } from "../../../lib/api/contracts";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncData(
    () => adminService.getAuditLogs({ search, module: moduleFilter }),
    [search, moduleFilter],
  );

  const rows = data ?? [];
  const selected = rows.find((log) => log.id === selectedId) ?? detail;
  const modules = [
    "All",
    "Students",
    "Submissions",
    "Requests",
    "Accounts",
    "Settings",
    "Auth",
    "Subjects",
    "Groups",
    "Notifications",
  ];
  const visibleCount = rows.length;
  const createCount = useMemo(() => rows.filter((log) => log.action === "CREATE").length, [rows]);
  const warningCount = useMemo(() => rows.filter((log) => log.result === "Queued").length, [rows]);
  const failedCount = useMemo(() => rows.filter((log) => log.result === "Failed").length, [rows]);
  const hasActiveFilters = Boolean(search.trim()) || moduleFilter !== "All";
  const activeFilterItems = [
    search.trim()
      ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }
      : null,
    moduleFilter !== "All"
      ? { key: "module", label: `Module: ${moduleFilter}`, onRemove: () => setModuleFilter("All") }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, [search, moduleFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);

    adminService
      .getAuditLogDetail(selectedId)
      .then((payload) => {
        if (!active) return;
        setDetail(payload);
      })
      .catch(() => {
        if (!active) return;
        setDetailError("Unable to load full audit log details.");
        setDetail(null);
      })
      .finally(() => {
        if (!active) return;
        setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  return (
    <RoleListShell
      tone="slate"
      eyebrow="Operational History"
      title="Audit Logs"
      subtitle="Inspect system actions, actor context, and event details through one shared operational log pattern."
      icon={Clock3}
      meta={[
        { label: "Module filter", value: moduleFilter === "All" ? "All modules" : moduleFilter },
        { label: "Current view", value: "Operational events" },
      ]}
      stats={[
        {
          label: "Visible events",
          value: loading ? "..." : String(visibleCount),
          hint: "Current result set after search and module filtering.",
        },
        {
          label: "Create actions",
          value: loading ? "..." : String(createCount),
          hint: "Provisioning and creation actions in the current view.",
        },
        {
          label: "Queued",
          value: loading ? "..." : String(warningCount),
          hint: "Events that completed with queued or delayed processing.",
        },
        {
          label: "Failed",
          value: loading ? "..." : String(failedCount),
          hint: "Events that ended in a failure state.",
        },
      ]}
      actions={(
        <Button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setDetail(null);
            setDetailError(null);
            reload();
          }}
          disabled={loading || detailLoading}
          variant="outline"
          className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
        >
          <RefreshCcw size={14} />
          Refresh
        </Button>
      )}
      toolbar={(
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search logs by action, actor, target, or details"
          primaryFilters={(
            <FilterSelect
              label="Module"
              value={moduleFilter}
              onChange={setModuleFilter}
              options={modules.map((moduleName) => ({ value: moduleName, label: moduleName }))}
            />
          )}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={() => {
            setSearch("");
            setModuleFilter("All");
          }}
        />
      )}
      activeFilters={<ActiveFilterChips items={activeFilterItems} onClearAll={() => {
        setSearch("");
        setModuleFilter("All");
      }} />}
      notices={(
        <div className="space-y-3">
          {error ? (
            <PortalNotice tone="danger" icon={<XCircle size={16} />}>
              {error}
            </PortalNotice>
          ) : null}
          {detailError ? (
            <PortalNotice tone="warning" icon={<XCircle size={16} />}>
              {detailError}
            </PortalNotice>
          ) : null}
        </div>
      )}
      drawer={(
        <AuditEventDrawer
          open={Boolean(selected)}
          event={selected}
          loading={detailLoading}
          error={detailError}
          onClose={() => setSelectedId(null)}
        />
      )}
    >
      <AuditLogsTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        onPreview={setSelectedId}
      />
    </RoleListShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[180px] flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[var(--radius-control)] border border-slate-200/80 bg-white dark:bg-slate-900/85 px-3 text-sm text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] outline-none focus:border-[var(--role-accent)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "all"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
