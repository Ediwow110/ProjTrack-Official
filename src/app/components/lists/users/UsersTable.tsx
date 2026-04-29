import { Eye, Mail, ShieldCheck, ShieldOff, Trash2, UserCog } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AdminUserRecord } from "../../../lib/api/contracts";

type UserSortKey = "displayIdentifier" | "name" | "email" | "role" | "status" | "profileLabel" | "createdAt";

type UsersTableProps = {
  rows: AdminUserRecord[];
  loading?: boolean;
  error?: string | null;
  actionBusy?: boolean;
  onRetry?: () => void;
  onView: (user: AdminUserRecord) => void;
  onActivate: (user: AdminUserRecord) => void;
  onDeactivate: (user: AdminUserRecord) => void;
  onReset: (user: AdminUserRecord) => void;
  onResendActivation: (user: AdminUserRecord) => void;
  onDelete: (user: AdminUserRecord) => void;
  sortState?: {
    columnKey: UserSortKey;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

function roleLabel(role: string) {
  return String(role || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

export function UsersTable({
  rows,
  loading = false,
  error = null,
  actionBusy = false,
  onRetry,
  onView,
  onActivate,
  onDeactivate,
  onReset,
  onResendActivation,
  onDelete,
  sortState,
  onSortChange,
}: UsersTableProps) {
  return (
    <DataTableCard
      title="User directory"
      description="Search, filter, and safely manage admin, teacher, and student accounts."
      action={loading ? <span className="text-xs font-medium text-slate-400 dark:text-slate-300">Loading users...</span> : null}
      columns={[
        {
          key: "displayIdentifier",
          header: "Student/Employee ID",
          sortable: true,
          renderCell: (user) => (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {user.displayIdentifier || "—"}
              </p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {user.identifierLabel || "Identifier"}
              </p>
            </div>
          ),
        },
        {
          key: "name",
          header: "Name",
          sortable: true,
          renderCell: (user) => (
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed User"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-300">{user.phone || user.office || "—"}</p>
            </div>
          ),
        },
        {
          key: "email",
          header: "Email",
          sortable: true,
          renderCell: (user) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{user.email}</span>
          ),
        },
        {
          key: "role",
          header: "Role",
          sortable: true,
          renderCell: (user) => (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 dark:text-slate-200">
              {roleLabel(user.role)}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          sortable: true,
          renderCell: (user) => <StatusChip status={user.status} size="xs" />,
        },
        {
          key: "profileLabel",
          header: "Profile",
          sortable: true,
          renderCell: (user) => (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-slate-100">
                {user.profileLabel || "—"}
              </p>
              {user.employeeId ? (
                <CopyableIdChip
                  value={user.employeeId}
                  label="Copy Employee ID"
                  className="bg-transparent px-0 text-slate-500 dark:text-slate-400 dark:text-slate-300"
                />
              ) : null}
            </div>
          ),
        },
        {
          key: "createdAt",
          header: "Created",
          sortable: true,
          renderCell: (user) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(user) => user.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      sortState={sortState}
      onSortChange={onSortChange}
      onRowClick={(user) => onView(user)}
      tableClassName="min-w-[1200px]"
      rowActions={(user) => [
        {
          key: "view",
          label: "View",
          icon: <Eye size={15} />,
          ariaLabel: `View ${user.email}`,
          onClick: () => onView(user),
          disabled: () => actionBusy,
        },
        {
          key: "toggle-status",
          label: user.status === "Active" ? "Deactivate" : "Activate",
          icon: user.status === "Active" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />,
          ariaLabel: user.status === "Active" ? `Deactivate ${user.email}` : `Activate ${user.email}`,
          onClick: () => (user.status === "Active" ? onDeactivate(user) : onActivate(user)),
          tone: user.status === "Active" ? "danger" : "default",
          disabled: () => actionBusy,
        },
        {
          key: "reset",
          label: "Send Reset Link",
          icon: <Mail size={15} />,
          ariaLabel: `Send reset link to ${user.email}`,
          onClick: () => onReset(user),
          disabled: () => actionBusy,
        },
        {
          key: "activation",
          label: "Resend Activation",
          icon: <UserCog size={15} />,
          ariaLabel: `Resend activation to ${user.email}`,
          onClick: () => onResendActivation(user),
          disabled: () => actionBusy,
          hidden: () => user.status === "Active",
        },
        {
          key: "delete",
          label: "Delete Test User",
          icon: <Trash2 size={15} />,
          ariaLabel: `Delete test user ${user.email}`,
          onClick: () => onDelete(user),
          tone: "danger",
          disabled: () => actionBusy,
          hidden: () => !user.isSeedCandidate,
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={UserCog}
          title="No users match this view"
          description="Try clearing the search or filters to widen the current result set."
        />
      )}
    />
  );
}
