import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, PencilLine, RefreshCcw } from "lucide-react";
import { AppModal } from "../../components/ui/app-modal";
import { StatusChip } from "../../components/ui/StatusChip";
import { adminCatalogService, adminDetailService, adminService } from "../../lib/api/services";
import type { AdminSubjectUpsertInput, AdminSubjectViewResponse, AdminTeacherRecord } from "../../lib/api/contracts";

const modalFieldClassName =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

export default function AdminSubjectView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<AdminSubjectViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<(AdminSubjectUpsertInput & { teacherName?: string }) | null>(null);
  const [teachers, setTeachers] = useState<AdminTeacherRecord[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<{ saving: boolean; error: string | null; note: string | null }>({ saving: false, error: null, note: null });

  const loadRecord = async () => {
    if (!id) {
      setError("Subject ID is missing.");
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    return adminDetailService
      .getSubjectView(id)
      .then(setData)
      .catch(() => setError("Unable to load subject record."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecord();
  }, [id]);

  useEffect(() => {
    let active = true;
    adminCatalogService.getTeachers().then((rows) => {
      if (!active) return;
      setTeachers(rows);
      setCatalogError(null);
    }).catch((catalogLoadError) => {
      if (!active) return;
      setCatalogError(
        catalogLoadError instanceof Error
          ? catalogLoadError.message
          : "Unable to load teacher options.",
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenEdit = () => {
    if (!data) return;
    setEditForm(data.form);
    setSaveState({ saving: false, error: null, note: null });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editForm) return;
    setSaveState({ saving: true, error: null, note: null });
    try {
      await adminService.updateSubject(id, {
        code: editForm.code,
        name: editForm.name,
        teacherId: editForm.teacherId,
        status: editForm.status,
        groupEnabled: editForm.groupEnabled,
        allowLateSubmission: editForm.allowLateSubmission,
      });
      await loadRecord();
      setEditOpen(false);
      setSaveState({ saving: false, error: null, note: "Subject details updated." });
    } catch (editError) {
      setSaveState({ saving: false, error: editError instanceof Error ? editError.message : "Unable to update subject.", note: null });
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/subjects")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"><ChevronLeft size={14} /> Back to Subjects</button>
          <button disabled={loading} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"><RefreshCcw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="p-6 max-w-7xl mx-auto text-sm text-slate-400 dark:text-slate-300">Loading subject record…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {saveState.error && <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{saveState.error}</div>}
      {catalogError && <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Teacher options could not be loaded: {catalogError}</div>}
      {saveState.note && <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{saveState.note}</div>}
      {loading && data && <div className="text-xs text-slate-400 dark:text-slate-300">Refreshing subject record…</div>}

      <div className="flex items-center justify-between gap-4">
        <button onClick={() => navigate("/admin/subjects")} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> Back to Subjects</button>
        <button disabled={loading} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"><RefreshCcw size={14} /> Refresh</button>
      </div>

      <div className={`bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6 ${loading ? "opacity-95" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">{data.code}</span>
            <h1 className={`text-slate-900 dark:text-slate-100 font-bold text-xl mt-1 ${loading ? "opacity-80" : ""}`}>{data.name}</h1>
            <p className={`text-slate-400 dark:text-slate-300 text-sm ${loading ? "opacity-80" : ""}`}>{data.term}</p>
          </div>
          <div className={`flex gap-2 flex-wrap justify-end ${loading ? "opacity-95" : ""}`}>
            <button disabled={loading} onClick={handleOpenEdit} className="px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-50 disabled:opacity-50"><PencilLine size={13} className="inline mr-1" />Edit</button>
            <button disabled={loading} onClick={loadRecord} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">Refresh</button>
            <StatusChip status={data.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
          <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">Subject Details</p>
          {data.details.map((field) => (
            <div key={field.l} className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0">
              <span className="text-slate-400 dark:text-slate-300 text-xs">{field.l}</span>
              <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{field.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
          <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">Submission Stats</p>
          {data.stats.map((field) => (
            <div key={field.l} className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0">
              <span className="text-slate-400 dark:text-slate-300 text-xs">{field.l}</span>
              <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{field.v}</span>
            </div>
          ))}
        </div>
      </div>

      <AppModal
        open={editOpen && Boolean(editForm)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditOpen(false);
          }
        }}
        title="Edit Subject"
        description="Update subject metadata and assignment settings."
        size="xl"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button disabled={saveState.saving} onClick={handleSaveEdit} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50">{saveState.saving ? "Saving…" : "Save Changes"}</button>
          </>
        }
      >
        {editForm ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subject Code" value={editForm.code} onChange={(value) => setEditForm((current) => current ? { ...current, code: value } : current)} />
            <Field label="Subject Name" value={editForm.name} onChange={(value) => setEditForm((current) => current ? { ...current, name: value } : current)} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Teacher</label>
              <select value={editForm.teacherId} onChange={(event) => setEditForm((current) => current ? { ...current, teacherId: event.target.value } : current)} className={modalFieldClassName}>
                <option value="">Unassigned</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Status</label>
              <select value={editForm.status} onChange={(event) => setEditForm((current) => current ? { ...current, status: event.target.value } : current)} className={modalFieldClassName}>
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
              <input type="checkbox" checked={editForm.groupEnabled} onChange={(event) => setEditForm((current) => current ? { ...current, groupEnabled: event.target.checked } : current)} />
              Enable group submissions
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
              <input type="checkbox" checked={editForm.allowLateSubmission} onChange={(event) => setEditForm((current) => current ? { ...current, allowLateSubmission: event.target.checked } : current)} />
              Allow late submissions
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 md:col-span-2 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Current Sections</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{editForm.sectionCodes.length ? editForm.sectionCodes.join(", ") : "No enrolled sections yet."}</p>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-300 dark:text-slate-500">Section membership is derived from current student enrollments and is managed when the subject is first created.</p>
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={modalFieldClassName} />
    </div>
  );
}
