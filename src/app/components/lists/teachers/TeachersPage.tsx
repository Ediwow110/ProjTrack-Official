import { useState } from "react";
import { Mail, Plus, RefreshCcw, UserCog } from "lucide-react";
import { useNavigate } from "react-router";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { BulkActionBar } from "../shared/BulkActionBar";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PortalNotice } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import { BootstrapIcon } from "../../ui/bootstrap-icon";
import { AppModal } from "../../ui/app-modal";
import { TeacherPreviewDrawer } from "./TeacherPreviewDrawer";
import { TeachersTable } from "./TeachersTable";
import { adminCatalogService, adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import { assertConfirmedMailJob } from "../../../lib/mailActionSafety";
import type {
  AdminDepartmentRecord,
  AdminTeacherRecord,
  AdminTeacherUpsertInput,
} from "../../../lib/api/contracts";

const initialForm: AdminTeacherUpsertInput = {
  firstName: "",
  lastName: "",
  email: "",
  employeeId: "",
  department: "",
};

type TeacherSortKey = "name" | "dept" | "status" | "subjects" | "students";

export default function TeachersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<string[]>([]);
  const [previewTeacherId, setPreviewTeacherId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminTeacherRecord | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: TeacherSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "name", direction: "asc" });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AdminTeacherUpsertInput>(initialForm);
  const [submitState, setSubmitState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });
  const [actionState, setActionState] = useState<{
    busy: boolean;
    error: string | null;
  }>({ busy: false, error: null });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const { data, loading, error, reload, setData } = useAsyncData(
    () => adminCatalogService.getTeachers({ search, status: statusFilter }),
    [search, statusFilter],
  );
  const {
    data: departmentData,
    loading: departmentsLoading,
    error: departmentsError,
    reload: reloadDepartments,
  } = useAsyncData(() => adminCatalogService.getDepartments(), []);

  const allTeachers = data ?? [];
  const departments = departmentData ?? [];
  const teachers = [...allTeachers].sort((left, right) => {
    if (!sortState) return 0;

    const direction = sortState.direction === "asc" ? 1 : -1;
    const pickValue = (teacher: AdminTeacherRecord) => {
      switch (sortState.columnKey) {
        case "dept":
          return teacher.dept.toLowerCase();
        case "status":
          return teacher.status.toLowerCase();
        case "subjects":
          return String(teacher.subjects).padStart(6, "0");
        case "students":
          return String(teacher.students).padStart(6, "0");
        case "name":
        default:
          return teacher.name.toLowerCase();
      }
    };

    return pickValue(left).localeCompare(pickValue(right)) * direction;
  });
  const previewTeacher =
    teachers.find((teacher) => teacher.id === previewTeacherId) ??
    allTeachers.find((teacher) => teacher.id === previewTeacherId) ??
    null;
  const selectedTeachers = teachers.filter((teacher) => selected.includes(teacher.id));
  const activeCount = teachers.filter((teacher) => teacher.status === "Active").length;
  const pendingSetupCount = teachers.filter(
    (teacher) =>
      teacher.status === "Pending Activation" ||
      teacher.status === "Pending Password Setup",
  ).length;
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "All";
  const activeFilterItems = [
    search.trim()
      ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }
      : null,
    statusFilter !== "All"
      ? { key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("All") }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function showFeedback(tone: "success" | "error", message: string) {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  function updateTeacherPatch(teacherId: string, patch: Partial<AdminTeacherRecord>) {
    setData((current) =>
      (current ?? []).map((teacher) => (teacher.id === teacherId ? { ...teacher, ...patch } : teacher)),
    );
  }

  function openTeacherPage(teacherId: string) {
    navigate(`/admin/teachers/${teacherId}`);
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setSelected((current) =>
      current.length === teachers.length ? [] : teachers.map((teacher) => teacher.id),
    );
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  function openCreateModal() {
    reloadDepartments();
    setForm(initialForm);
    setSubmitState({ saving: false, error: null });
    setCreateOpen(true);
  }

  async function sendSetupLink(teacher: AdminTeacherRecord) {
    const result = teacher.status === "Pending Activation"
      ? await adminService.activateTeacher(teacher.id)
      : await adminService.sendTeacherResetLink(teacher.id);
    const mailJobId = assertConfirmedMailJob(
      result,
      teacher.status === "Pending Activation" ? "teacher activation email" : "teacher password reset email",
    );
    updateTeacherPatch(teacher.id, {
      status: "Pending Password Setup",
    });
    return mailJobId;
  }

  async function handleActivate(teacherId: string) {
    if (actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      const teacher = allTeachers.find((item) => item.id === teacherId);
      if (!teacher) throw new Error("Unable to find the selected teacher.");
      const mailJobId = await sendSetupLink(teacher);
      await reload();
      setActionState({ busy: false, error: null });
      showFeedback("success", `Setup MailJob queued for ${teacher.name} (${mailJobId}). Open Mail Jobs to watch delivery.`);
    } catch (activateError) {
      const message =
        activateError instanceof Error ? activateError.message : "Unable to send the setup link.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleReset(teacherId: string) {
    if (actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      const teacher = allTeachers.find((item) => item.id === teacherId);
      if (!teacher) throw new Error("Unable to find the selected teacher.");
      const result = await adminService.sendTeacherResetLink(teacherId);
      const mailJobId = assertConfirmedMailJob(result, "teacher password reset email");
      updateTeacherPatch(teacherId, { status: "Pending Password Setup" });
      await reload();
      setActionState({ busy: false, error: null });
      showFeedback("success", `Reset MailJob queued for ${teacher.name} (${mailJobId}). Open Mail Jobs to watch delivery.`);
    } catch (resetError) {
      const message =
        resetError instanceof Error ? resetError.message : "Unable to send the reset link.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleBulkSetupLinks() {
    if (actionState.busy || selectedTeachers.length === 0) return;
    setActionState({ busy: true, error: null });
    try {
      let processed = 0;
      let skipped = 0;
      for (const teacher of selectedTeachers) {
        if (teacher.status === "Inactive") {
          skipped += 1;
          continue;
        }
        await sendSetupLink(teacher);
        processed += 1;
      }
      await reload();
      setSelected([]);
      setActionState({ busy: false, error: null });
      const skippedMessage = skipped ? ` Skipped ${skipped} inactive account${skipped > 1 ? "s" : ""}.` : "";
      showFeedback(
        processed > 0 ? "success" : "error",
        processed > 0
          ? `${processed} teacher setup/reset MailJob${processed > 1 ? "s" : ""} queued.${skippedMessage} Open Mail Jobs to watch delivery.`
          : `No teacher setup/reset emails were queued.${skippedMessage}`,
      );
    } catch (bulkError) {
      const message =
        bulkError instanceof Error
          ? bulkError.message
          : "Unable to process the selected teacher accounts.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await adminService.deactivateTeacher(deactivateTarget.id);
      updateTeacherPatch(deactivateTarget.id, { status: "Inactive" });
      await reload();
      setSelected((current) => current.filter((value) => value !== deactivateTarget.id));
      setDeactivateTarget(null);
      setActionState({ busy: false, error: null });
      showFeedback("success", `${deactivateTarget.name} was moved to inactive status.`);
    } catch (deactivateError) {
      const message =
        deactivateError instanceof Error ? deactivateError.message : "Unable to deactivate this teacher.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleCreateTeacher() {
    setSubmitState({ saving: true, error: null });
    try {
      await adminService.createTeacher(form);
      await reload();
      setCreateOpen(false);
      setForm(initialForm);
      setSubmitState({ saving: false, error: null });
      showFeedback("success", "Teacher account created in pending activation state.");
    } catch (createError) {
      setSubmitState({
        saving: false,
        error: createError instanceof Error ? createError.message : "Unable to create teacher.",
      });
    }
  }

  return (
    <>
      <RoleListShell
        tone="slate"
        eyebrow="Faculty Management"
        title="Teachers"
        subtitle="Manage faculty accounts, setup links, and teaching coverage from one shared operational workspace."
        icon={UserCog}
        meta={[
          { label: "Status filter", value: statusFilter === "All" ? "All statuses" : statusFilter },
          { label: "Current view", value: "Faculty directory" },
        ]}
        stats={[
          {
            label: "Visible teachers",
            value: loading ? "..." : String(teachers.length),
            hint: "Current result set after search and status filters.",
          },
          {
            label: "Active",
            value: loading ? "..." : String(activeCount),
            hint: "Teachers currently able to access the portal.",
          },
          {
            label: "Needs setup",
            value: loading ? "..." : String(pendingSetupCount),
            hint: "Accounts waiting for activation or password setup.",
          },
          {
            label: "Selected",
            value: String(selected.length),
            hint: "Rows ready for shared bulk actions.",
          },
        ]}
        actions={(
          <>
            <Button
              type="button"
              disabled={loading || actionState.busy}
              onClick={() => {
                setSelected([]);
                reload();
              }}
              variant="outline"
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCcw size={14} />
              Refresh
            </Button>
          </>
        )}
        toolbar={(
          <FilterToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search teachers by name, ID, or email"
            primaryFilters={(
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "All", label: "All statuses" },
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                  { value: "Pending Activation", label: "Pending Activation" },
                  { value: "Pending Password Setup", label: "Pending Password Setup" },
                ]}
              />
            )}
            secondaryActions={(
              <Button
                type="button"
                disabled={loading || actionState.busy}
                onClick={openCreateModal}
                className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
              >
                <Plus size={14} />
                Add Teacher
              </Button>
            )}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />
        )}
        activeFilters={<ActiveFilterChips items={activeFilterItems} onClearAll={resetFilters} />}
        notices={(
          <div className="space-y-3">
            {error ? (
              <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
                {error}
              </PortalNotice>
            ) : null}
            {actionState.error ? (
              <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
                {actionState.error}
              </PortalNotice>
            ) : null}
            {feedback ? (
              <PortalNotice
                tone={feedback.tone === "success" ? "success" : "danger"}
                icon={feedback.tone === "success" ? <BootstrapIcon name="check-circle-fill" tone="success" /> : <BootstrapIcon name="x-circle-fill" tone="danger" />}
              >
                {feedback.message}
              </PortalNotice>
            ) : null}
            {departmentsError ? (
              <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
                {departmentsError}
              </PortalNotice>
            ) : null}
            {!departmentsLoading && departments.length === 0 ? (
              <PortalNotice tone="warning">
                No departments are available yet. Add department cards first so new teachers can be assigned from the dropdown.
              </PortalNotice>
            ) : null}
            {statusFilter === "Pending Password Setup" ? (
              <PortalNotice tone="warning">
                Showing teachers who still need to complete account setup from an invitation or reset link.
              </PortalNotice>
            ) : null}
          </div>
        )}
        bulkActions={(
          <BulkActionBar
            selectedCount={selected.length}
            onClearSelection={() => setSelected([])}
            actions={(
              <Button
                type="button"
                size="sm"
                disabled={actionState.busy || selected.length === 0}
                onClick={handleBulkSetupLinks}
                className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
              >
                <Mail size={14} />
                Send setup links
              </Button>
            )}
          />
        )}
        drawer={(
          <TeacherPreviewDrawer
            open={Boolean(previewTeacher)}
            teacher={previewTeacher}
            actionBusy={actionState.busy}
            onClose={() => setPreviewTeacherId(null)}
            onView={openTeacherPage}
            onActivate={handleActivate}
            onReset={handleReset}
            onDeactivate={(teacher) => setDeactivateTarget(teacher)}
          />
        )}
      >
        <TeachersTable
          rows={teachers}
          loading={loading}
          error={error}
          onRetry={reload}
          selectedRowKeys={selected}
          onToggleRow={toggleOne}
          onToggleAll={toggleAll}
          onPreview={setPreviewTeacherId}
          onView={openTeacherPage}
          onActivate={handleActivate}
          onReset={handleReset}
          onDeactivate={(teacher) => setDeactivateTarget(teacher)}
          actionBusy={actionState.busy}
          sortState={sortState}
          onSortChange={(columnKey) =>
            setSortState((current) => {
              if (!current || current.columnKey !== columnKey) {
                return { columnKey: columnKey as TeacherSortKey, direction: "asc" };
              }

              return {
                columnKey: current.columnKey,
                direction: current.direction === "asc" ? "desc" : "asc",
              };
            })
          }
        />
      </RoleListShell>

      <AppModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Teacher"
        description="Create a real faculty account that can be activated from the admin flow."
        size="lg"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateTeacher}
              disabled={
                submitState.saving ||
                !form.firstName.trim() ||
                !form.lastName.trim() ||
                !form.email.trim() ||
                !form.department?.trim() ||
                departmentsLoading ||
                departments.length === 0
              }
              className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
            >
              {submitState.saving ? "Creating..." : "Create Teacher"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First Name" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
          <Field label="Last Name" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          <Field label="Employee ID" value={form.employeeId} onChange={(value) => setForm((current) => ({ ...current, employeeId: value }))} />
          <div className="md:col-span-2">
            <SelectField
              label="Department"
              value={form.department ?? ""}
              onChange={(value) => setForm((current) => ({ ...current, department: value }))}
              options={departments}
              placeholder={
                departmentsLoading
                  ? "Loading departments..."
                  : departments.length === 0
                    ? "No departments available"
                    : "Select department"
              }
              disabled={departmentsLoading || departments.length === 0}
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Create department cards first to control what appears in this dropdown.
            </p>
          </div>
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate teacher account?"
        description={
          deactivateTarget
            ? `${deactivateTarget.name} will lose active portal access until the account is re-enabled.`
            : "The selected teacher will lose active portal access until the account is re-enabled."
        }
        confirmLabel="Deactivate teacher"
        tone="danger"
        loading={actionState.busy}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
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
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">{label}</label>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminDepartmentRecord[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
