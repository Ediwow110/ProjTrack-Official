import { Eye, FileText } from "lucide-react";

import { BootstrapIcon, type BootstrapIconTone } from "../../ui/bootstrap-icon";
import { PortalEmptyState } from "../../portal/PortalPage";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AuditLogRecord } from "../../../lib/api/contracts";

const actionColor: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-500/15 dark:text-blue-200",
  DELETE: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  APPROVE: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  APPROVED: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  DENIED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  REJECTED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  CANCELLED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  RESET: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  LOGIN_SUCCESS: "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200",
  LOGIN_FAILED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  IMPORT: "bg-violet-50 text-violet-700 dark:text-violet-300 dark:bg-violet-500/15 dark:text-violet-200",
  ACTIVATE: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  DEACTIVATE: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  READ: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  READ_ALL: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  EMAIL: "bg-indigo-50 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200",
  MOVE: "bg-indigo-50 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200",
  SUBMISSION_REVIEWED: "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200",
  SUBMISSION_CREATED: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  SUBMISSION_NOTE_UPDATED: "bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-500/15 dark:text-blue-200",
  FILE_UPLOADED: "bg-violet-50 text-violet-700 dark:text-violet-300 dark:bg-violet-500/15 dark:text-violet-200",
  FILE_DOWNLOADED: "bg-violet-50 text-violet-700 dark:text-violet-300 dark:bg-violet-500/15 dark:text-violet-200",
  FILE_DELETED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  FILE_ATTACHED: "bg-indigo-50 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200",
  FILE_ACCESS_DENIED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  BACKUP_RUN: "bg-indigo-50 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200",
  BACKUP_DELETED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  BACKUP_RESTORE_ATTEMPT: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  PASSWORD_RESET_REQUESTED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  BROADCAST_CREATED: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  ACTIVITY_CREATED: "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200",
  ACTIVITY_UPDATED: "bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-500/15 dark:text-blue-200",
  ACTIVITY_REOPENED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  DATA_DELETION_REQUESTED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  DATA_DELETION_APPROVED: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  DATA_DELETION_DENIED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  DATA_DELETION_CANCELLED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  DATA_DELETION_DRY_RUN_COMPLETED: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  DATA_DELETION_BACKUP_VERIFIED: "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200",
  DATA_DELETION_EXECUTION_BLOCKED: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  DATA_DELETION_EXECUTION_MANUAL_CONFIRMED: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15 dark:text-amber-200",
  SUBJECT_REOPENED: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  ACCOUNT_ACTIVATED: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  RUN: "bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-500/15 dark:text-blue-200",
  BULK_DELETE: "bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-500/15 dark:text-rose-200",
  ANNOUNCEMENT_CREATED: "bg-teal-50 text-teal-700 dark:text-teal-300 dark:bg-teal-500/15 dark:text-teal-200",
  ADMIN_CREATED: "bg-violet-50 text-violet-700 dark:text-violet-300 dark:bg-violet-500/15 dark:text-violet-200",
  STUDENTS_NOTIFIED: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  LOGIN: "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 dark:bg-slate-700/70 dark:text-slate-200",
};

const actionIcon: Record<string, { name: string; tone: BootstrapIconTone }> = {
  CREATE: { name: "check-circle-fill", tone: "success" },
  UPDATE: { name: "pencil-square", tone: "primary" },
  DELETE: { name: "trash-fill", tone: "danger" },
  APPROVE: { name: "check-circle-fill", tone: "success" },
  APPROVED: { name: "check-circle-fill", tone: "success" },
  DENIED: { name: "x-circle-fill", tone: "danger" },
  REJECTED: { name: "x-circle-fill", tone: "danger" },
  CANCELLED: { name: "x-circle-fill", tone: "warning" },
  RESET: { name: "arrow-counterclockwise", tone: "warning" },
  LOGIN_SUCCESS: { name: "shield-check", tone: "info" },
  LOGIN_FAILED: { name: "shield-exclamation", tone: "danger" },
  IMPORT: { name: "archive-fill", tone: "primary" },
  ACTIVATE: { name: "check-circle-fill", tone: "info" },
  DEACTIVATE: { name: "pause-circle-fill", tone: "warning" },
  READ: { name: "eye-fill", tone: "info" },
  READ_ALL: { name: "eye-fill", tone: "info" },
  EMAIL: { name: "envelope-fill", tone: "primary" },
  MOVE: { name: "arrow-clockwise", tone: "primary" },
  SUBMISSION_REVIEWED: { name: "clipboard-check-fill", tone: "success" },
  SUBMISSION_CREATED: { name: "send-fill", tone: "primary" },
  SUBMISSION_NOTE_UPDATED: { name: "pencil-square", tone: "primary" },
  FILE_UPLOADED: { name: "archive-fill", tone: "primary" },
  FILE_DOWNLOADED: { name: "box-arrow-up-right", tone: "primary" },
  FILE_DELETED: { name: "trash-fill", tone: "danger" },
  FILE_ATTACHED: { name: "clipboard-check-fill", tone: "primary" },
  FILE_ACCESS_DENIED: { name: "shield-exclamation", tone: "danger" },
  BACKUP_RUN: { name: "archive-fill", tone: "primary" },
  BACKUP_DELETED: { name: "trash-fill", tone: "danger" },
  BACKUP_RESTORE_ATTEMPT: { name: "arrow-counterclockwise", tone: "warning" },
  PASSWORD_RESET_REQUESTED: { name: "envelope-exclamation-fill", tone: "warning" },
  BROADCAST_CREATED: { name: "send-fill", tone: "primary" },
  ACTIVITY_CREATED: { name: "check-circle-fill", tone: "success" },
  ACTIVITY_UPDATED: { name: "pencil-square", tone: "primary" },
  ACTIVITY_REOPENED: { name: "arrow-clockwise", tone: "warning" },
  DATA_DELETION_REQUESTED: { name: "exclamation-triangle-fill", tone: "warning" },
  DATA_DELETION_APPROVED: { name: "check-circle-fill", tone: "success" },
  DATA_DELETION_DENIED: { name: "x-circle-fill", tone: "danger" },
  DATA_DELETION_CANCELLED: { name: "x-circle-fill", tone: "warning" },
  DATA_DELETION_DRY_RUN_COMPLETED: { name: "clipboard-check-fill", tone: "info" },
  DATA_DELETION_BACKUP_VERIFIED: { name: "shield-check", tone: "success" },
  DATA_DELETION_EXECUTION_BLOCKED: { name: "shield-exclamation", tone: "danger" },
  DATA_DELETION_EXECUTION_MANUAL_CONFIRMED: { name: "check-circle-fill", tone: "warning" },
  SUBJECT_REOPENED: { name: "arrow-clockwise", tone: "info" },
  ACCOUNT_ACTIVATED: { name: "check-circle-fill", tone: "info" },
  RUN: { name: "arrow-clockwise", tone: "primary" },
  BULK_DELETE: { name: "trash-fill", tone: "danger" },
  ANNOUNCEMENT_CREATED: { name: "send-fill", tone: "primary" },
  ADMIN_CREATED: { name: "shield-check", tone: "primary" },
  STUDENTS_NOTIFIED: { name: "send-fill", tone: "info" },
  LOGIN: { name: "shield-check", tone: "secondary" },
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
      action={loading ? <span className="text-xs font-medium text-slate-400 dark:text-slate-300">Loading audit logs...</span> : null}
      columns={[
        {
          key: "action",
          header: "Action",
          renderCell: (log) => (
            <div className="space-y-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${actionColor[log.action] ?? "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 dark:bg-slate-700/70 dark:text-slate-200"}`}>
                {actionIcon[log.action] ? (
                  <BootstrapIcon name={actionIcon[log.action].name as any} tone={actionIcon[log.action].tone} size={10} />
                ) : null}
                {log.action}
              </span>
              <CopyableIdChip value={log.id} label="Copy Audit Log ID" className="bg-transparent px-0" />
            </div>
          ),
        },
        {
          key: "module",
          header: "Module",
          renderCell: (log) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{log.module}</span>
          ),
        },
        {
          key: "user",
          header: "Actor",
          renderCell: (log) => (
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-slate-100">{log.user}</p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-300">{log.role}</p>
              {log.actorUserId ? (
                <div className="mt-1">
                  <CopyableIdChip value={log.actorUserId} label="Copy Actor User ID" className="bg-transparent px-0" />
                </div>
              ) : null}
            </div>
          ),
        },
        {
          key: "target",
          header: "Target",
          renderCell: (log) => (
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{log.target}</span>
              {log.entityId && log.entityId !== "—" ? (
                <CopyableIdChip value={log.entityId} label="Copy Target Entity ID" className="bg-transparent px-0" />
              ) : null}
            </div>
          ),
        },
        {
          key: "time",
          header: "Occurred",
          renderCell: (log) => (
            <span className="text-xs text-slate-400 dark:text-slate-300 dark:text-slate-400">{log.time}</span>
          ),
        },
        {
          key: "result",
          header: "Result",
          renderCell: (log) => (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">{log.result}</span>
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
          icon={FileText}
          title="No audit events match this view"
          description="Try clearing the search or module filter to widen the visible event history."
        />
      )}
    />
  );
}
