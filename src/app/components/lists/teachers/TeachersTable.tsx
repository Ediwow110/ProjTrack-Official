import { ArrowUpRight, Eye, GraduationCap, Mail, UserX } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AdminTeacherRecord } from "../../../lib/api/contracts";

type TeacherSortKey = "name" | "dept" | "status" | "subjects" | "students";

type TeachersTableProps = {
  rows: AdminTeacherRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedRowKeys: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onPreview: (id: string) => void;
  onView: (id: string) => void;
  onActivate: (id: string) => void;
  onReset: (id: string) => void;
  onDeactivate: (teacher: AdminTeacherRecord) => void;
  actionBusy?: boolean;
  sortState?: {
    columnKey: TeacherSortKey;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

export function TeachersTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  selectedRowKeys,
  onToggleRow,
  onToggleAll,
  onPreview,
  onView,
  onActivate,
  onReset,
  onDeactivate,
  actionBusy = false,
  sortState,
  onSortChange,
}: TeachersTableProps) {
  return (
    <DataTableCard
      title="Faculty directory"
      description="Preview teacher workload, resend setup links, or move into the full teacher profile."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading directory...</span> : null}
      columns={[
        {
          key: "name",
          header: "Teacher",
          sortable: true,
          renderCell: (teacher) => (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-700 dark:bg-teal-500/12 dark:text-teal-200">
                {teacher.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{teacher.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-[10px] text-slate-400">{teacher.employeeId || "No employee ID"}</p>
                  <CopyableIdChip value={teacher.id} label="Copy User ID" className="bg-transparent px-0" />
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "email",
          header: "Email",
          renderCell: (teacher) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{teacher.email}</span>
          ),
        },
        {
          key: "dept",
          header: "Department",
          sortable: true,
          renderCell: (teacher) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{teacher.dept}</span>
          ),
        },
        {
          key: "subjects",
          header: "Subjects",
          sortable: true,
          renderCell: (teacher) => (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">{teacher.subjects}</span>
          ),
        },
        {
          key: "students",
          header: "Students",
          sortable: true,
          renderCell: (teacher) => (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">{teacher.students}</span>
          ),
        },
        {
          key: "status",
          header: "Status",
          sortable: true,
          renderCell: (teacher) => <StatusChip status={teacher.status} size="xs" />,
        },
      ]}
      rows={rows}
      rowKey={(teacher) => teacher.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      selectable
      selectedRowKeys={selectedRowKeys}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      onRowClick={(teacher) => onPreview(teacher.id)}
      sortState={sortState}
      onSortChange={onSortChange}
      rowActions={(teacher) => [
        {
          key: "preview",
          label: "Preview",
          icon: <Eye size={15} />,
          ariaLabel: `Preview ${teacher.name}`,
          onClick: () => onPreview(teacher.id),
          disabled: () => actionBusy,
        },
        {
          key: "view",
          label: "View",
          icon: <ArrowUpRight size={15} />,
          ariaLabel: `Open full record for ${teacher.name}`,
          onClick: () => onView(teacher.id),
          disabled: () => actionBusy,
        },
        {
          key: "setup",
          label: teacher.status === "Pending Activation" ? "Activate" : "Send Reset Link",
          icon: <Mail size={15} />,
          ariaLabel:
            teacher.status === "Pending Activation"
              ? `Send activation link to ${teacher.name}`
              : `Send reset link to ${teacher.name}`,
          onClick: () =>
            teacher.status === "Pending Activation"
              ? onActivate(teacher.id)
              : onReset(teacher.id),
          disabled: () => actionBusy,
        },
        {
          key: "deactivate",
          label: "Deactivate",
          icon: <UserX size={15} />,
          ariaLabel: `Deactivate ${teacher.name}`,
          onClick: () => onDeactivate(teacher),
          tone: "danger",
          hidden: () => teacher.status === "Inactive",
          disabled: () => actionBusy,
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={GraduationCap}
          title="No teachers match this view"
          description="Try clearing the search, widening the filters, or creating a new faculty account."
        />
      )}
    />
  );
}
