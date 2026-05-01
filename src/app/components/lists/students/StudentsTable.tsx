import { ArrowRightLeft, ArrowUpRight, Eye, Mail, UserX, Users } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AdminStudentRecord } from "../../../lib/api/contracts";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";

type SetupLinkTimePresentation = {
  label: string;
  className: string;
  tooltip: string;
};

function formatRemainingTime(msRemaining: number) {
  const totalMinutes = Math.max(0, Math.floor(msRemaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (minutes > 0) {
    return `${minutes}m remaining`;
  }

  return "Less than 1m remaining";
}

export function getSetupLinkTimePresentation(
  student: AdminStudentRecord,
  currentTimeMs = Date.now(),
): SetupLinkTimePresentation {
  const status = String(student.status || "").trim();
  const activationStatus = String(student.activationStatus || "").trim();
  const activationEmailStatus = String(student.activationEmailStatus || "").trim().toLowerCase();
  const expiresAtRaw = String(student.setupTokenExpiresAt || "").trim();

  if (status === "Active" || activationStatus === "Active") {
    return {
      label: "Activated",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25",
      tooltip: "The student account is already active.",
    };
  }

  if (status === "Activation Email Failed" || activationEmailStatus === "failed") {
    return {
      label: "Needs resend",
      className:
        "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
      tooltip: "Latest activation email failed. Resend activation.",
    };
  }

  if (!expiresAtRaw) {
    if (status === "Needs Resend") {
      return {
        label: "Needs resend",
        className:
          "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
        tooltip: "No active setup link is available. Resend activation.",
      };
    }

    if (activationEmailStatus === "not sent" || status === "Pending Setup" || status === "Pending Activation") {
      return {
        label: "No setup link",
        className:
          "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
        tooltip: "No active setup link is available for this student.",
      };
    }

    return {
      label: "—",
      className:
        "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
      tooltip: "Setup link timing is unavailable.",
    };
  }

  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      label: "—",
      className:
        "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-500/35",
      tooltip: "Setup link timing is unavailable.",
    };
  }

  if (expiresAt.getTime() <= currentTimeMs) {
    return {
      label: "Expired",
      className:
        "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/25",
      tooltip: "Activation link expired. Send a new setup email.",
    };
  }

  return {
    label: formatRemainingTime(expiresAt.getTime() - currentTimeMs),
    className:
      "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/25",
    tooltip: `Setup link expires at ${expiresAt.toLocaleString()}`,
  };
}

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
  busyStudentId?: string | null;
  sortState?: {
    columnKey: string;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
  currentTimeMs?: number;
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
  busyStudentId = null,
  sortState,
  onSortChange,
  currentTimeMs = Date.now(),
}: StudentsTableProps) {
  return (
    <DataTableCard
      title="Student directory"
      description="Review the roster, queue setup emails, or move students into the next section structure."
      action={loading ? <span className="text-xs font-medium text-slate-400 dark:text-slate-300">Loading directory...</span> : null}
      columns={[
        {
          key: "studentId",
          header: "Student ID",
          sortable: true,
          renderCell: (student) => student.studentId || student.id.slice(0, 8),
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
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {student.firstName || "—"}
            </span>
          ),
        },
        {
          key: "middleInitial",
          header: "M.I.",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {student.middleInitial || "—"}
            </span>
          ),
        },
        {
          key: "yearLevel",
          header: "Year Level",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {student.yearLevel || "—"}
            </span>
          ),
        },
        {
          key: "section",
          header: "Section",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{student.section}</span>
          ),
        },
        {
          key: "course",
          header: "Course",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {student.course || "—"}
            </span>
          ),
        },
        {
          key: "academicYear",
          header: "Academic Year",
          sortable: true,
          renderCell: (student) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {student.academicYear || "—"}
            </span>
          ),
        },
        {
          key: "email",
          header: "Email",
          renderCell: (student) => (
            <span className="font-medium text-slate-500 dark:text-slate-400 dark:text-slate-300">{student.email}</span>
          ),
        },
        {
          key: "status",
          header: "Activation / Status",
          sortable: true,
          renderCell: (student) => {
            let tooltipContent = "";
            if (student.status === "Activation Email Failed") {
              tooltipContent = student.activationEmailFailureReason || "Email delivery failed.";
            } else if (student.status === "Setup Expired") {
              tooltipContent = "Activation link expired. Send a new setup email.";
            }
            return (
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <StatusChip status={student.status} size="xs" />
                  </TooltipTrigger>
                  {tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
                </Tooltip>
                {busyStudentId === student.id ? (
                  <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                    Queueing activation email...
                  </p>
                ) : null}
              </div>
            );
          },
        },
        {
          key: "setupLinkTime",
          header: "Setup Link Time",
          renderCell: (student) => {
            const presentation = getSetupLinkTimePresentation(student, currentTimeMs);
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${presentation.className}`}
                  >
                    {presentation.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{presentation.tooltip}</TooltipContent>
              </Tooltip>
            );
          },
        },
        {
          key: "createdAt",
          header: "Created",
          renderCell: (student) =>
            student.createdAt
              ? new Date(student.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—",
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
      tableClassName="min-w-[1500px]"
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
          label: () =>
            busyStudentId === student.id
              ? "Queueing..."
              : student.status === "Pending Activation"
                ? "Send Activation Email"
                : student.status === "Pending Setup" ||
                    student.status === "Needs Resend" ||
                    student.status === "Activation Email Failed" ||
                    student.status === "Setup Expired"
                  ? "Resend Activation Email"
                  : "Send Password Reset Email",
          icon: <Mail size={15} />,
          ariaLabel:
            student.status === "Pending Activation"
              ? `Send activation email to ${student.name}`
              : student.status === "Pending Setup" ||
                  student.status === "Needs Resend" ||
                  student.status === "Activation Email Failed" ||
                  student.status === "Setup Expired"
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
