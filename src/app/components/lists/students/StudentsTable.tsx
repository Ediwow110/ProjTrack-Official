import { ArrowRightLeft, ArrowUpRight, Eye, Mail, UserX, Users } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AdminStudentRecord } from "../../../lib/api/contracts";

type StudentsTableProps = {
  rows: AdminStudentRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedRowKeys: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onPreview: (id: string) => void;
  onView: (id: string) => void;
  onSendSetupLink: (id: string) => void;
  onMove: (student: AdminStudentRecord) => void;
  onDeactivate: (student: AdminStudentRecord) => void;
  actionBusy?: boolean;
  sortState?: {
    columnKey: string;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

export function StudentsTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  selectedRowKeys,
  onToggleRow,
  onToggleAll,
  onPreview,
  onView,
  onSendSetupLink,
  onMove,
  onDeactivate,
  actionBusy = false,
  sortState,
  onSortChange,
}: StudentsTableProps) {
  return (
    <DataTableCard
      title="Student directory"
      description="Review the roster, queue setup emails, or move students into the next section structure."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading directory...</span> : null}
      columns={[
        {
          key: "studentId",
          header: "Student ID",
          sortable: true,
          renderCell: (student) => (
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-300">
                {student.studentId || "—"}
              </span>
              <CopyableIdChip value={student.id} label="Copy User ID" className="bg-transparent px-0" />
            </div>
          ),
        },
        {
          key: "lastName",
          header: "Last Name",
          sortable: true,
          renderCell: (student) => (
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {student.lastName || "—"}
            </p>
          ),
        },
        {
          key: "firstName",
          header: "First Name",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {student.firstName || "—"}
            </span>
          ),
        },
        {
          key: "middleInitial",
          header: "M.I.",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {student.middleInitial || ""}
            </span>
          ),
        },
        {
          key: "yearLevel",
          header: "Year Level",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {student.yearLevel || "—"}
            </span>
          ),
        },
        {
          key: "section",
          header: "Section",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{student.section}</span>
          ),
        },
        {
          key: "course",
          header: "Course",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {student.course || "—"}
            </span>
          ),
        },
        {
          key: "academicYear",
          header: "Academic Year",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {student.academicYear || "—"}
            </span>
          ),
        },
        {
          key: "email",
          header: "Email",
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{student.email}</span>
          ),
        },
        {
          key: "status",
          header: "Status",
          sortable: true,
          renderCell: (student) => <StatusChip status={student.status} size="xs" />,
        },
      ]}
      rows={rows}
      rowKey={(student) => student.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      selectable
      selectedRowKeys={selectedRowKeys}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      onRowClick={(student) => onPreview(student.id)}
      sortState={sortState}
      onSortChange={onSortChange}
      tableClassName="min-w-[1380px]"
      rowActions={(student) => [
        {
          key: "preview",
          label: "View Student",
          icon: <Eye size={15} />,
          ariaLabel: `View ${student.name}`,
          onClick: () => onPreview(student.id),
          disabled: () => actionBusy,
        },
        {
          key: "view",
          label: "Edit Student",
          icon: <ArrowUpRight size={15} />,
          ariaLabel: `Edit ${student.name}`,
          onClick: () => onView(student.id),
          disabled: () => actionBusy,
        },
        {
          key: "setup",
          label: student.status === "Pending Setup" ? "Send Setup Email" : "Send Password Reset Email",
          icon: <Mail size={15} />,
          ariaLabel:
            student.status === "Pending Setup"
              ? `Send setup email to ${student.name}`
              : `Send password reset email to ${student.name}`,
          onClick: () => onSendSetupLink(student.id),
          disabled: () =>
            actionBusy ||
            student.status === "Inactive" ||
            student.status === "Restricted" ||
            student.status === "Disabled" ||
            student.status === "Archived" ||
            student.status === "Graduated",
        },
        {
          key: "move",
          label: "Move Student",
          icon: <ArrowRightLeft size={15} />,
          ariaLabel: `Move ${student.name}`,
          onClick: () => onMove(student),
          disabled: () => actionBusy,
        },
        {
          key: "deactivate",
          label: "Deactivate",
          icon: <UserX size={15} />,
          ariaLabel: `Deactivate ${student.name}`,
          onClick: () => onDeactivate(student),
          tone: "danger",
          hidden: () => student.status === "Inactive",
          disabled: () => actionBusy,
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={Users}
          title="No students match this view"
          description="Try clearing the search, widening the filters, or importing a fresh student roster."
        />
      )}
    />
  );
}
