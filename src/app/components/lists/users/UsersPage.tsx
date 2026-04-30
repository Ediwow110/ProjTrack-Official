import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, ShieldPlus, Users } from "lucide-react";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { UsersTable } from "./UsersTable";
import { Button } from "../../ui/button";
import { AppModal } from "../../ui/app-modal";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import { adminService, type AdminUserFilters } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import type { AdminCreateUserInput, AdminUserRecord } from "../../../lib/api/contracts";

const roleOptions = ["All", "ADMIN", "TEACHER", "STUDENT"] as const;
const statusOptions = [
  "All",
  "Active",
  "Inactive",
  "Pending Activation",
  "Pending Password Setup",
  "Pending Setup",
  "Restricted",
  "Disabled",
] as const;

const initialCreateForm: AdminCreateUserInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  office: "",
  sendActivationEmail: true,
};

type UserSortKey = "id" | "name" | "email" | "role" | "status" | "profileLabel" | "createdAt";

function roleLabel(role: string) {
  return String(role || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function filterUsers(rows: AdminUserRecord[], filters: AdminUserFilters) {
  const q = String(filters.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    const matchesSearch =
      !q ||
      [
        row.id,
        row.email,
        row.firstName,
        row.lastName,
        row.profileLabel,
        row.studentNumber,
        row.employeeId,
      ].some((value) => String(value ?? "").toLowerCase().includes(q));
    const matchesRole =
      !filters.role || filters.role === "All" || String(row.role).toUpperCase() === String(filters.role).toUpperCase();
    const matchesStatus =
      !filters.status ||
      filters.status === "All" ||
      String(row.status).toLowerCase() === String(filters.status).toLowerCase();
    return matchesSearch && matchesRole && matchesStatus;
  });
}

export default function UsersPage() {
  const [filters, setFilters] = useState<AdminUserFilters>({
    search: "",
    role: "All",
    status: "All",
  });
  const [sortState, setSortState] = useState<{
    columnKey: UserSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "createdAt", direction: "desc" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AdminCreateUserInput>(initialCreateForm);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const { data, loading, error, reload } = useAsyncData(() => adminService.getUsers(filters), [
    filters.search,
    filters.role,
    filters.status,
  ]);

  const rows = useMemo(() => {
    const filtered = filterUsers(data ?? [], filters);
    return [...filtered].sort((left, right) => {
      if (!sortState) return 0;
      const direction = sortState.direction === "asc" ? 1 : -1;
      const pickValue = (row: AdminUserRecord) => {
        switch (sortState.columnKey) {
          case "id":
            return row.id.toLowerCase();
          case "name":
            return `${row.firstName} ${row.lastName}`.toLowerCase();
          case "email":
            return row.email.toLowerCase();
          case "role":
            return row.role.toLowerCase();
          case "status":
            return row.status.toLowerCase();
          case "profileLabel":
            return String(row.profileLabel || "").toLowerCase();
          case "createdAt":
          default:
            return row.createdAt || "";
        }
      };
      return pickValue(left).localeCompare(pickValue(right)) * direction;
    });
  }, [data, filters, sortState]);

  const activeFilters = [
    filters.search?.trim()
      ? {
          key: "search",
          label: `Search: ${filters.search.trim()}`,
          onRemove: () => setFilters((current) => ({ ...current, search: "" })),
        }
      : null,
    filters.role && filters.role !== "All"
      ? {
          key: "role",
          label: `Role: ${filters.role}`,
          onRemove: () => setFilters((current) => ({ ...current, role: "All" })),
        }
      : null,
    filters.status && filters.status !== "All"
      ? {
          key: "status",
          label: `Status: ${filters.status}`,
          onRemove: () => setFilters((current) => ({ ...current, status: "All" })),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const pendingUsers = rows.filter((row) => row.status !== "Active").length;
  const adminCount = rows.filter((row) => row.role === "ADMIN").length;

  async function handleCreateAdmin() {
    if (actionState.busy) return;
    const email = String(createForm.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setActionState({ busy: false, error: "Enter a valid email address for the new admin." });
      return;
    }
    setActionState({ busy: true, error: null });
    setFeedback(null);
    try {
      await adminService.createAdmin({ ...createForm, email });
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      setFeedback({
        tone: "success",
        message: "Admin account created. The activation flow has been prepared.",
      });
      await reload();
      setActionState({ busy: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create the admin account.";
      setActionState({ busy: false, error: message });
    }
  }

  async function runUserAction(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    if (actionState.busy) return;
    setActionState({ busy: true, error: null });
    setFeedback(null);
    try {
      await action();
      setFeedback({ tone: "success", message: successMessage });
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setSelectedUser(null);
      await reload();
      setActionState({ busy: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The requested user action could not be completed.";
      setActionState({ busy: false, error: message });
    }
  }

  return (
    <RoleListShell
      tone="slate"
      eyebrow="Admin Control"
      title="Users"
      subtitle="Manage admin, teacher, and student accounts with production-safe activation, reset, and cleanup actions."
      icon={Users}
      meta={[
        { label: "Role filter", value: filters.role === "All" ? "All roles" : filters.role },
        { label: "Status filter", value: filters.status === "All" ? "All statuses" : filters.status },
      ]}
      stats={[
        {
          label: "Visible users",
          value: loading ? "..." : String(rows.length),
          hint: "Current result set after search and filters.",
        },
        {
          label: "Admins",
          value: loading ? "..." : String(adminCount),
          hint: "Accounts with full administrative access.",
        },
        {
          label: "Pending action",
          value: loading ? "..." : String(pendingUsers),
          hint: "Accounts not currently active.",
        },
      ]}
      actions={(
        <>
          <Button
            type="button"
            variant="outline"
            disabled={loading || actionState.busy}
            onClick={reload}
            className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
          >
            <RefreshCcw size={14} />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setActionState({ busy: false, error: null });
            }}
            className="bg-white text-slate-900 hover:bg-slate-100"
          >
            <ShieldPlus size={14} />
            Add Admin
          </Button>
        </>
      )}
      toolbar={(
        <FilterToolbar
          searchValue={filters.search ?? ""}
          onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}
          searchPlaceholder="Search by name, email, user ID, or profile ID"
          primaryFilters={(
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                label="Role"
                value={filters.role ?? "All"}
                onChange={(value) => setFilters((current) => ({ ...current, role: value }))}
                options={roleOptions.map((value) => ({
                  value,
                  label: value === "All" ? "All roles" : roleLabel(value),
                }))}
              />
              <FilterSelect
                label="Status"
                value={filters.status ?? "All"}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                options={statusOptions.map((value) => ({
                  value,
                  label: value === "All" ? "All statuses" : value,
                }))}
              />
            </div>
          )}
          hasActiveFilters={activeFilters.length > 0}
          onResetFilters={() => setFilters({ search: "", role: "All", status: "All" })}
        />
      )}
      activeFilters={
        <ActiveFilterChips
          items={activeFilters}
          onClearAll={() => setFilters({ search: "", role: "All", status: "All" })}
        />
      }
      notices={
        <div className="space-y-3">
          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
          {actionState.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {actionState.error}
            </div>
          ) : null}
        </div>
      }
    >
      <UsersTable
        rows={rows}
        loading={loading}
        error={error}
        actionBusy={actionState.busy}
        onRetry={reload}
        onView={(user) => setSelectedUser(user)}
        onActivate={(user) =>
          runUserAction(() => adminService.activateUser(user.id), `${user.email} activation flow queued.`)
        }
        onDeactivate={(user) =>
          runUserAction(() => adminService.deactivateUser(user.id), `${user.email} was deactivated.`)
        }
        onReset={(user) =>
          runUserAction(() => adminService.sendUserResetLink(user.id), `Reset link queued for ${user.email}.`)
        }
        onResendActivation={(user) =>
          runUserAction(() => adminService.resendUserActivation(user.id), `Activation email queued for ${user.email}.`)
        }
        onDelete={(user) => {
          setDeleteTarget(user);
          setDeleteConfirmation("");
        }}
        sortState={sortState}
        onSortChange={(columnKey) =>
          setSortState((current) => {
            if (!current || current.columnKey !== columnKey) {
              return { columnKey: columnKey as UserSortKey, direction: "asc" };
            }
            return {
              columnKey: current.columnKey,
              direction: current.direction === "asc" ? "desc" : "asc",
            };
          })
        }
      />

      <AppModal
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen) {
            setCreateForm(initialCreateForm);
          }
        }}
        title="Add Admin"
        description="Create a new admin account using the activation flow. Shared or default passwords are never created here."
        size="lg"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={actionState.busy} onClick={handleCreateAdmin}>
              {actionState.busy ? "Creating..." : "Create Admin"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={createForm.firstName}
            onChange={(value) => setCreateForm((current) => ({ ...current, firstName: value }))}
          />
          <Field
            label="Last name"
            value={createForm.lastName}
            onChange={(value) => setCreateForm((current) => ({ ...current, lastName: value }))}
          />
          <Field
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
          />
          <Field
            label="Phone"
            value={createForm.phone ?? ""}
            onChange={(value) => setCreateForm((current) => ({ ...current, phone: value }))}
          />
          <div className="sm:col-span-2">
            <Field
              label="Office"
              value={createForm.office ?? ""}
              onChange={(value) => setCreateForm((current) => ({ ...current, office: value }))}
            />
          </div>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <input
              type="checkbox"
              checked={createForm.sendActivationEmail !== false}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sendActivationEmail: event.target.checked,
                }))
              }
            />
            Send activation email immediately
          </label>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(selectedUser)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedUser(null);
          }
        }}
        title="User Details"
        description="Operational details for support, reset, and activation work."
        size="md"
        footer={
          <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>
            Close
          </Button>
        }
      >
        {selectedUser ? (
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ") || selectedUser.email}
              </p>
              <p>{selectedUser.email}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="User ID" value={<CopyableIdChip value={selectedUser.id} label="Copy User ID" />} />
              <DetailRow label="Role" value={roleLabel(selectedUser.role)} />
              <DetailRow label="Status" value={selectedUser.status} />
              <DetailRow label="Profile ID" value={selectedUser.profileLabel || "—"} />
              <DetailRow label="Phone" value={selectedUser.phone || "—"} />
              <DetailRow label="Office" value={selectedUser.office || "—"} />
              <DetailRow
                label="Created"
                value={
                  selectedUser.createdAt
                    ? new Date(selectedUser.createdAt).toLocaleString("en-US")
                    : "—"
                }
              />
              <DetailRow
                label="Updated"
                value={
                  selectedUser.updatedAt
                    ? new Date(selectedUser.updatedAt).toLocaleString("en-US")
                    : "—"
                }
              />
            </div>
          </div>
        ) : null}
      </AppModal>

      <AppModal
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
            setDeleteConfirmation("");
          }
        }}
        title="Delete user?"
        description="This is intended only for seed, test, or demo data. Real users should be deactivated instead."
        size="md"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionState.busy || deleteConfirmation.trim().toUpperCase() !== "DELETE USER"}
              onClick={() =>
                deleteTarget
                  ? runUserAction(
                      () => adminService.deleteUser(deleteTarget.id, "DELETE USER"),
                      `${deleteTarget.email} was permanently deleted.`,
                    )
                  : Promise.resolve()
              }
            >
              {actionState.busy ? "Deleting..." : "Delete Test User"}
            </Button>
          </>
        )}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                Delete user? This is intended only for seed/test/demo data. Real production users should be deactivated instead. This action may remove related sessions, tokens, notifications, enrollments, group memberships, and profile records.
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Type <span className="font-semibold">DELETE USER</span> to confirm
              </span>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              />
            </label>
          </div>
        ) : null}
      </AppModal>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[var(--radius-control)] border border-slate-200/80 bg-white px-3 text-sm text-slate-700 shadow-[var(--shadow-soft)] outline-none focus:border-[var(--role-accent)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
      />
    </label>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <div className="text-sm text-slate-700 dark:text-slate-100">{value}</div>
    </div>
  );
}
