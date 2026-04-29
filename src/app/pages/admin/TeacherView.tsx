import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, PencilLine, RefreshCcw, RotateCcw, ShieldOff } from "lucide-react";
import { AppModal } from "../../components/ui/app-modal";
import { BootstrapIcon } from "../../components/ui/bootstrap-icon";
import { StatusChip } from "../../components/ui/StatusChip";
import { adminCatalogService, adminDetailService, adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { assertConfirmedMailJob } from "../../lib/mailActionSafety";
import type {
  AdminDepartmentRecord,
  AdminTeacherUpsertInput,
  AdminTeacherViewResponse,
} from "../../lib/api/contracts";

const modalFieldClassName =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

export default function AdminTeacherView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<AdminTeacherViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<AdminTeacherUpsertInput | null>(null);
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null; note: string | null }>({ busy: false, error: null, note: null });
  const {
    data: departmentData,
    loading: departmentsLoading,
    error: departmentsError,
    reload: reloadDepartments,
  } = useAsyncData(() => adminCatalogService.getDepartments(), []);

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setActionState((current) => ({ ...current, error: null }));
    return adminDetailService
      .getTeacherView(String(id ?? ""))
      .then(setData)
      .catch(() => setError("Unable to load teacher record."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setActionState({ busy: false, error: null, note: null });
    loadRecord();
  }, [id]);

  const handleActivate = async () => {
    if (!id || actionState.busy) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      const result = await adminService.activateTeacher(id);
      const mailJobId = assertConfirmedMailJob(result, "teacher activation email");
      await loadRecord();
      setActionState({ busy: false, error: null, note: `Teacher activation/setup MailJob queued (${mailJobId}). Open Mail Jobs to watch delivery.` });
    } catch (actionError) {
      setActionState({ busy: false, error: actionError instanceof Error ? actionError.message : "Unable to activate teacher.", note: null });
    }
  };

  const handleReset = async () => {
    if (!id || actionState.busy) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      const result = await adminService.sendTeacherResetLink(id);
      const mailJobId = assertConfirmedMailJob(result, "teacher password reset email");
      await loadRecord();
      setActionState({ busy: false, error: null, note: `Teacher reset MailJob queued (${mailJobId}). Open Mail Jobs to watch delivery.` });
    } catch (actionError) {
      setActionState({ busy: false, error: actionError instanceof Error ? actionError.message : "Unable to send reset link.", note: null });
    }
  };

  const handleDeactivate = async () => {
    if (!id || actionState.busy) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      await adminService.deactivateTeacher(id);
      await loadRecord();
      setActionState({ busy: false, error: null, note: "Teacher account deactivated." });
    } catch (actionError) {
      setActionState({ busy: false, error: actionError instanceof Error ? actionError.message : "Unable to deactivate teacher.", note: null });
    }
  };

  const handleOpenEdit = () => {
    if (!data) return;
    reloadDepartments();
    setEditForm(data.form);
    setEditOpen(true);
  };

  const departmentOptions = buildDepartmentOptions(
    departmentData ?? [],
    editForm?.department ?? data?.form.department ?? "",
  );

  const handleSaveEdit = async () => {
    if (!id || !editForm) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      await adminService.updateTeacher(id, editForm);
      await loadRecord();
      setEditOpen(false);
      setActionState({ busy: false, error: null, note: "Teacher details updated." });
    } catch (editError) {
      setActionState({ busy: false, error: editError instanceof Error ? editError.message : "Unable to update teacher.", note: null });
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/teachers")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"><ChevronLeft size={14} /> Back to Teachers</button>
          <button disabled={loading || actionState.busy} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"><RefreshCcw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="p-6 max-w-7xl mx-auto text-sm text-slate-400 dark:text-slate-300">Loading teacher record…</div>;
  }

  return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {actionState.error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"><BootstrapIcon name="x-circle-fill" tone="danger" className="mt-0.5 shrink-0" /> <span>{actionState.error}</span></div>}
      {actionState.note && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"><BootstrapIcon name="check-circle-fill" tone="success" className="mt-0.5 shrink-0" /> <span>{actionState.note}</span></div>}
      {departmentsError && <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"><BootstrapIcon name="exclamation-triangle-fill" tone="warning" className="mt-0.5 shrink-0" /> <span>{departmentsError}</span></div>}
      {actionState.busy && <div className="text-xs text-slate-400 dark:text-slate-300">Updating teacher account state…</div>}
      {loading && data && <div className="text-xs text-slate-400 dark:text-slate-300">Refreshing teacher record…</div>}

      <div className="flex items-center justify-between gap-4">
        <button onClick={() => navigate("/admin/teachers")} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> Back to Teachers</button>
        <button disabled={loading || actionState.busy} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"><RefreshCcw size={14} /> Refresh</button>
      </div>

      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-700 flex items-center justify-center text-white text-lg font-bold shrink-0">{data.initials}</div>
            <div>
              <h1 className="text-slate-900 dark:text-slate-100 font-bold text-xl">{data.name}</h1>
              <p className="text-slate-400 dark:text-slate-300 text-sm">{data.subtitle}</p>
              <div className="flex gap-2 mt-2"><StatusChip status={data.status} /></div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={loadRecord} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70"><RefreshCcw size={13} /> Refresh</button>
            <button disabled={actionState.busy} onClick={handleOpenEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-50 disabled:opacity-50"><PencilLine size={13} /> Edit</button>
            <button disabled={actionState.busy} onClick={handleReset} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-50 disabled:opacity-50"><RotateCcw size={13} /> Reset Password</button>
            <button disabled={actionState.busy} onClick={handleActivate} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sky-200 text-sky-700 text-xs font-semibold hover:bg-sky-50 disabled:opacity-50"><ShieldOff size={13} /> Send Setup Link</button>
            <button disabled={actionState.busy} onClick={handleDeactivate} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"><ShieldOff size={13} /> Deactivate</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Account Details</p>
            <div className="space-y-2">
              {data.accountDetails.map((field) => (
                <div key={field.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0">
                  <span className="text-slate-400 dark:text-slate-300 text-xs">{field.label}</span>
                  <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {data.stats.map((stat) => (
              <div key={stat.l} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
                <p className="text-slate-400 dark:text-slate-300 text-xs">{stat.l}</p>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-xl mt-1">{stat.v}</p>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">Handled Subjects</p>
            <div className="space-y-2">
              {data.handledSubjects.map((subject, index) => (
                <div key={`${subject.code}-${index}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70">
                  <div>
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 font-bold">{subject.code}</span>
                    <p className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{subject.name}</p>
                    <p className="text-slate-400 dark:text-slate-300 text-[10px]">{subject.section}</p>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{subject.students} students</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AppModal
        open={editOpen && Boolean(editForm)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditOpen(false);
          }
        }}
        title="Edit Teacher"
        description="Update faculty account details."
        size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button disabled={actionState.busy} onClick={handleSaveEdit} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50">Save Changes</button>
          </>
        }
      >
        {editForm ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First Name" value={editForm.firstName} onChange={(value) => setEditForm((current) => current ? { ...current, firstName: value } : current)} />
            <Field label="Last Name" value={editForm.lastName} onChange={(value) => setEditForm((current) => current ? { ...current, lastName: value } : current)} />
            <Field label="Email" type="email" value={editForm.email} onChange={(value) => setEditForm((current) => current ? { ...current, email: value } : current)} />
            <Field label="Employee ID" value={editForm.employeeId} onChange={(value) => setEditForm((current) => current ? { ...current, employeeId: value } : current)} />
            <div className="md:col-span-2">
              <SelectField
                label="Department"
                value={editForm.department ?? ""}
                onChange={(value) => setEditForm((current) => current ? { ...current, department: value } : current)}
                options={departmentOptions}
                placeholder={
                  departmentsLoading
                    ? "Loading departments..."
                    : departmentOptions.length === 0
                      ? "No departments available"
                      : "Select department"
                }
                disabled={departmentsLoading || departmentOptions.length === 0}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This dropdown uses the same department catalog as the main Departments page.
              </p>
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">{label}</label>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className={modalFieldClassName} />
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
        className={modalFieldClassName}
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

function buildDepartmentOptions(
  departments: AdminDepartmentRecord[],
  currentDepartment: string,
) {
  const currentName = String(currentDepartment || "").trim();
  const known = new Set(departments.map((department) => department.name.trim().toLowerCase()));

  if (currentName && !known.has(currentName.toLowerCase())) {
    return [
      { id: `current:${currentName.toLowerCase()}`, name: currentName, description: "", teachers: 0, subjects: 0 },
      ...departments,
    ];
  }

  return departments;
}
