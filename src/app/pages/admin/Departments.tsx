import { useState } from "react";
import { BookOpen, Building2, Plus, RefreshCcw, Search, Users } from "lucide-react";

import { PortalEmptyState, PortalHero, PortalPage, PortalPanel } from "../../components/portal/PortalPage";
import { AppModal } from "../../components/ui/app-modal";
import { Button } from "../../components/ui/button";
import { adminCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { AdminDepartmentCreateInput, AdminDepartmentRecord } from "../../lib/api/contracts";

const initialForm: AdminDepartmentCreateInput = {
  name: "",
  description: "",
};

export default function AdminDepartments() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AdminDepartmentCreateInput>(initialForm);
  const [submitState, setSubmitState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });

  const { data, loading, error, reload } = useAsyncData(
    () => adminCatalogService.getDepartments({ search }),
    [search],
  );

  const departments = data ?? [];
  const totalTeachers = departments.reduce((sum, department) => sum + Number(department.teachers || 0), 0);
  const totalSubjects = departments.reduce((sum, department) => sum + Number(department.subjects || 0), 0);
  const describedCount = departments.filter((department) => department.description?.trim()).length;

  function openCreateModal() {
    setForm(initialForm);
    setSubmitState({ saving: false, error: null });
    setCreateOpen(true);
  }

  async function handleCreateDepartment() {
    setSubmitState({ saving: true, error: null });
    try {
      await adminCatalogService.createDepartment(form);
      await reload();
      setCreateOpen(false);
      setForm(initialForm);
      setSubmitState({ saving: false, error: null });
    } catch (createError) {
      setSubmitState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create department.",
      });
    }
  }

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="slate"
        eyebrow="Academic Structure"
        title="Departments"
        description="Create the department catalog once, then reuse the same list when assigning teachers across the admin workspace."
        icon={Building2}
        meta={[
          { label: "Search", value: search.trim() ? "Filtered" : "All departments" },
          { label: "Assignment source", value: "Teacher forms" },
          { label: "Catalog mode", value: "Live" },
        ]}
        stats={[
          {
            label: "Departments",
            value: String(departments.length),
            hint: "Visible department cards in the current view.",
          },
          {
            label: "Teachers",
            value: String(totalTeachers),
            hint: "Faculty profiles currently mapped to these departments.",
          },
          {
            label: "Subjects",
            value: String(totalSubjects),
            hint: "Subjects currently covered by teachers in these departments.",
          },
          {
            label: "With Notes",
            value: String(describedCount),
            hint: "Department cards that already include a description.",
          },
        ]}
        actions={(
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={reload}
              className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
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
        description="Use department cards as the source of truth for teacher assignment dropdowns."
      >
        <label className="portal-input flex max-w-xl items-center gap-3 rounded-[24px] px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-400" />
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
                className="h-48 animate-pulse rounded-[28px] bg-slate-100 dark:bg-slate-800/70"
              />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <PortalEmptyState
            title="No departments yet"
            description="Create your first department card so teacher forms can offer a real department dropdown."
            icon={Building2}
            className="border-slate-200 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/70"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {departments.map((department) => (
              <DepartmentCard key={department.id} department={department} />
            ))}
          </div>
        )}
      </PortalPanel>

      <AppModal
        open={createOpen}
        onOpenChange={(nextOpen) => {
          if (!submitState.saving) setCreateOpen(nextOpen);
        }}
        title="Add Department"
        description="Create a department card that will also appear in the teacher department dropdown."
        size="lg"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              disabled={submitState.saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitState.saving || !form.name.trim()}
              onClick={handleCreateDepartment}
              className="bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitState.saving ? "Creating..." : "Create Department"}
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
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              placeholder="Optional details for the department card."
              className="portal-input w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          {submitState.error ? (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>
    </PortalPage>
  );
}

function DepartmentCard({ department }: { department: AdminDepartmentRecord }) {
  return (
    <div className="portal-card rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              {department.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
              {department.description?.trim() || "No description yet. This department is ready for teacher assignment."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricTile
          icon={Users}
          label="Teachers"
          value={String(department.teachers)}
        />
        <MetricTile
          icon={BookOpen}
          label="Subjects"
          value={String(department.subjects)}
        />
      </div>
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
          <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
            {value}
          </p>
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="portal-input h-12 w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
      />
    </div>
  );
}
