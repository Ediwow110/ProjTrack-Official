import { useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PortalEmptyState, PortalHero, PortalPage, PortalPanel } from "../../components/portal/PortalPage";
import { AppModal } from "../../components/ui/app-modal";
import { Button } from "../../components/ui/button";
import { adminCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type {
  AdminDepartmentCreateInput,
  AdminDepartmentRecord,
  AdminDepartmentUpdateInput,
} from "../../lib/api/contracts";

const initialForm: AdminDepartmentCreateInput = {
  name: "",
  description: "",
};

type EditorState = {
  open: boolean;
  mode: "create" | "edit";
  target: AdminDepartmentRecord | null;
};

export default function AdminDepartments() {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    mode: "create",
    target: null,
  });
  const [form, setForm] = useState<AdminDepartmentCreateInput>(initialForm);
  const [saveState, setSaveState] = useState<{ saving: boolean; error: string | null }>({
    saving: false,
    error: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminDepartmentRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteState, setDeleteState] = useState<{ deleting: boolean; error: string | null }>({
    deleting: false,
    error: null,
  });

  const { data, loading, error, reload } = useAsyncData(
    () => adminCatalogService.getDepartments({ search }),
    [search],
  );

  const departments = data ?? [];
  const totalTeachers = departments.reduce((sum, department) => sum + Number(department.teachers || 0), 0);
  const totalSubjects = departments.reduce((sum, department) => sum + Number(department.subjects || 0), 0);
  const describedCount = departments.filter((department) => department.description?.trim()).length;
  const legacyCount = departments.filter((department) => department.isLegacy).length;
  const deleteBlocked = useMemo(
    () => Boolean(deleteTarget && !deleteTarget.canDelete),
    [deleteTarget],
  );

  function resetEditorState() {
    setForm(initialForm);
    setSaveState({ saving: false, error: null });
    setEditor({ open: false, mode: "create", target: null });
  }

  function openCreateModal() {
    setForm(initialForm);
    setSaveState({ saving: false, error: null });
    setEditor({ open: true, mode: "create", target: null });
  }

  function openEditModal(department: AdminDepartmentRecord) {
    setForm({
      name: department.name,
      description: department.description ?? "",
    });
    setSaveState({ saving: false, error: null });
    setEditor({ open: true, mode: "edit", target: department });
  }

  function openDeleteModal(department: AdminDepartmentRecord) {
    setDeleteTarget(department);
    setDeleteConfirmation("");
    setDeleteState({ deleting: false, error: null });
  }

  async function handleSaveDepartment() {
    setSaveState({ saving: true, error: null });
    try {
      if (editor.mode === "create") {
        await adminCatalogService.createDepartment(form);
        toast.success("Department created.");
      } else if (editor.target) {
        const payload: AdminDepartmentUpdateInput = {
          name: form.name,
          description: form.description,
        };
        await adminCatalogService.updateDepartment(editor.target.id, payload);
        toast.success("Department updated.");
      }
      await reload();
      resetEditorState();
    } catch (saveError) {
      setSaveState({
        saving: false,
        error: saveError instanceof Error ? saveError.message : "Unable to save department.",
      });
    }
  }

  async function handleDeleteDepartment() {
    if (!deleteTarget || deleteBlocked) return;
    setDeleteState({ deleting: true, error: null });
    try {
      await adminCatalogService.deleteDepartment(deleteTarget.id, "DELETE DEPARTMENT");
      toast.success("Department deleted.");
      await reload();
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setDeleteState({ deleting: false, error: null });
    } catch (deleteError) {
      setDeleteState({
        deleting: false,
        error: deleteError instanceof Error ? deleteError.message : "Unable to delete department.",
      });
    }
  }

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="slate"
        eyebrow="Academic Structure"
        title="Departments"
        description="Manage the live department catalog used by teacher assignment flows. Edits update linked teacher mappings, and deletions are blocked while academic records still depend on the department."
        icon={Building2}
        meta={[
          { label: "Search", value: search.trim() ? "Filtered" : "All departments" },
          { label: "Catalog mode", value: "Backend-backed" },
          { label: "Legacy mappings", value: legacyCount > 0 ? `${legacyCount} detected` : "None" },
        ]}
        stats={[
          {
            label: "Departments",
            value: String(departments.length),
            hint: "Visible department records in the current view.",
          },
          {
            label: "Teachers",
            value: String(totalTeachers),
            hint: "Teacher profiles currently mapped to these departments.",
          },
          {
            label: "Subjects",
            value: String(totalSubjects),
            hint: "Subjects currently covered by teachers in these departments.",
          },
          {
            label: "With Notes",
            value: String(describedCount),
            hint: "Departments that already include a description.",
          },
        ]}
        actions={(
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={reload}
              className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCcw size={16} />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={openCreateModal}
              className="border border-white/20 bg-white/12 text-white hover:bg-white/18"
            >
              <Plus size={16} />
              Add Department
            </Button>
          </>
        )}
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <PortalPanel
        title="Search the department catalog"
        description="Search by department name or description. Changes here flow directly to the backend department catalog."
      >
        <label className="portal-input flex max-w-xl items-center gap-3 rounded-[24px] px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
          <input
            disabled={loading}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by department name or description..."
            aria-label="Search departments"
            className="w-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-subtle)] disabled:opacity-50"
          />
        </label>
      </PortalPanel>

      <PortalPanel
        title="Department Cards"
        description={`${departments.length} department${departments.length === 1 ? "" : "s"} in the current view.`}
      >
        {loading && departments.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-[28px] bg-slate-100 dark:bg-slate-800/70"
              />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <PortalEmptyState
            title={search.trim() ? "No departments match this search" : "No departments yet"}
            description={
              search.trim()
                ? "Try a broader search or clear the filter."
                : "Create the first department so teacher forms can use a live catalog instead of static placeholders."
            }
            icon={Building2}
            className="border-slate-200 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/70"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {departments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
            ))}
          </div>
        )}
      </PortalPanel>

      <AppModal
        open={editor.open}
        onOpenChange={(nextOpen) => {
          if (!saveState.saving && !nextOpen) resetEditorState();
        }}
        title={editor.mode === "create" ? "Add Department" : `Edit ${editor.target?.name ?? "Department"}`}
        description={
          editor.mode === "create"
            ? "Create a real department catalog entry for teacher assignment and reporting."
            : editor.target?.isLegacy
              ? "Updating this legacy mapping will create or refresh a catalog entry and rename linked teacher department mappings."
              : "Update the catalog entry. Renaming also updates linked teacher department mappings."
        }
        size="lg"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saveState.saving}
              onClick={resetEditorState}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveState.saving || !form.name.trim()}
              onClick={handleSaveDepartment}
              className="bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {saveState.saving
                ? editor.mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : editor.mode === "create"
                  ? "Create Department"
                  : "Save Changes"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-5">
          <Field
            label="Department Name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="College of Computing"
          />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Description
            </label>
            <textarea
              aria-label="Description"
              value={form.description ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={5}
              placeholder="Optional notes for the department card."
              className="portal-input w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          {saveState.error ? (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {saveState.error}
            </div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!deleteState.deleting && !nextOpen) {
            setDeleteTarget(null);
            setDeleteConfirmation("");
            setDeleteState({ deleting: false, error: null });
          }
        }}
        title={`Delete ${deleteTarget?.name ?? "Department"}?`}
        description="This permanently deletes the catalog entry. Linked teachers and subjects block deletion and must be reassigned first."
        size="lg"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              disabled={deleteState.deleting}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmation("");
                setDeleteState({ deleting: false, error: null });
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteState.deleting ||
                deleteBlocked ||
                deleteConfirmation.trim().toUpperCase() !== "DELETE DEPARTMENT"
              }
              onClick={handleDeleteDepartment}
            >
              {deleteState.deleting ? "Deleting..." : "Delete Department"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-5">
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-[var(--text-strong)]">{deleteTarget?.name}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
              Teachers linked: {deleteTarget?.teachers ?? 0}. Subjects linked: {deleteTarget?.subjects ?? 0}.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
              Source: {deleteTarget?.isLegacy ? "Derived from live teacher mappings" : "Catalog entry"}.
            </p>
          </div>

          {deleteBlocked ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200">
              This department cannot be deleted while it is still used by linked teachers or subjects. Reassign those records first.
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Type DELETE DEPARTMENT to confirm
              </label>
              <input
                aria-label="Delete Department Confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="DELETE DEPARTMENT"
                className="portal-input h-12 w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          )}

          {deleteState.error ? (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {deleteState.error}
            </div>
          ) : null}
        </div>
      </AppModal>
    </PortalPage>
  );
}

function DepartmentCard({
  department,
  onEdit,
  onDelete,
}: {
  department: AdminDepartmentRecord;
  onEdit: (department: AdminDepartmentRecord) => void;
  onDelete: (department: AdminDepartmentRecord) => void;
}) {
  return (
    <div className="portal-card rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {department.name}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  department.isLegacy
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                }`}
              >
                {department.isLegacy ? "Legacy" : "Catalog"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
              {department.description?.trim() || "No description yet. This department is ready for teacher assignment and reporting."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-2xl px-3"
            aria-label={`Edit ${department.name}`}
            onClick={() => onEdit(department)}
          >
            <Pencil size={14} />
            {department.isLegacy ? "Edit / Normalize" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-2xl px-3 text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
            aria-label={`Delete ${department.name}`}
            disabled={!department.canDelete}
            onClick={() => onDelete(department)}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricTile icon={Users} label="Teachers" value={String(department.teachers)} />
        <MetricTile icon={BookOpen} label="Subjects" value={String(department.subjects)} />
      </div>

      {!department.canDelete ? (
        <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200">
          Delete is blocked while linked teachers or subjects still use this department.
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-lg font-semibold text-[var(--text-strong)]">{value}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="portal-input h-12 w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
      />
    </div>
  );
}
