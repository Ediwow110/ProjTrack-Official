import { Eye, JournalText } from "react-bootstrap-icons";

import { PortalEmptyState } from "../../portal/PortalPage";
import { DataTableCard } from "../shared/DataTableCard";
import type { AuditLogRecord } from "../../../lib/api/contracts";

const actionColor: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  APPROVE: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  RESET: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  LOGIN: "bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200",
  IMPORT: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  ACTIVATE: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  EMAIL: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
};

type AuditLogsTableProps = {
  rows: AuditLogRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPreview: (id: string) => void;
};

export function AuditLogsTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  onPreview,
}: AuditLogsTableProps) {
  return (
    <DataTableCard
      title="Audit log records"
      description="Inspect system actions, target entities, and security-critical events through a shared operational log table."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading audit logs...</span> : null}
      columns={[
        {
          key: "action",
          header: "Action",
          renderCell: (log) => (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${actionColor[log.action] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200"}`}>
              {log.action}
            </span>
          ),
        },
        {
          key: "module",
          header: "Module",
          renderCell: (log) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{log.module}</span>
          ),
        },
        {
          key: "user",
          header: "Actor",
          renderCell: (log) => (
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-100">{log.user}</p>
              <p className="mt-1 text-[10px] text-slate-400">{log.role}</p>
            </div>
          ),
        },
        {
          key: "target",
          header: "Target",
          renderCell: (log) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{log.target}</span>
          ),
        },
        {
          key: "time",
          header: "Occurred",
          renderCell: (log) => (
            <span className="text-xs text-slate-400 dark:text-slate-400">{log.time}</span>
          ),
        },
        {
          key: "result",
          header: "Result",
          renderCell: (log) => (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">{log.result}</span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(log) => log.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(log) => onPreview(log.id)}
      rowActions={[
        {
          key: "view",
          label: "View details",
          icon: <Eye size={15} />,
          ariaLabel: (log) => `View details for ${log.action} on ${log.target}`,
          onClick: (log) => onPreview(log.id),
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={JournalText}
          title="No audit events match this view"
          description="Try clearing the search or module filter to widen the visible event history."
        />
      )}
    />
  );
}
