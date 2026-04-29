import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, FileText, Download, RefreshCcw } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { adminDetailService, adminService } from "../../lib/api/services";
import type { AdminSubmissionViewResponse } from "../../lib/api/contracts";

export default function AdminSubmissionView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get("back") || "/admin/submissions";
  const backLabel = useMemo(() => {
    if (backTarget.includes("/admin/dashboard")) return "Back to Dashboard";
    if (backTarget.includes("/admin/groups")) return "Back to Groups";
    return "Back to Submissions";
  }, [backTarget]);

  const [data, setData] = useState<AdminSubmissionViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [initialNote, setInitialNote] = useState("");
  const [noteState, setNoteState] = useState<{ saving: boolean; error: string | null; saved: boolean }>({
    saving: false,
    error: null,
    saved: false,
  });

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setNoteState((current) => ({ ...current, error: null, saved: false }));
    return adminDetailService
      .getSubmissionView(String(id ?? ""))
      .then((payload) => {
        setData(payload);
        setNote(payload.adminNote || "");
        setInitialNote(payload.adminNote || "");
      })
      .catch(() => setError("Unable to load submission record."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setNote("");
    setInitialNote("");
    setNoteState({ saving: false, error: null, saved: false });
    loadRecord();
  }, [id]);

  const noteDirty = note.trim() !== initialNote.trim();

  const handleSaveNote = async () => {
    if (!id || noteState.saving || !noteDirty) return;
    setNoteState({ saving: true, error: null, saved: false });
    try {
      await adminService.saveSubmissionNote(id, note);
      await loadRecord();
      setNoteState({ saving: false, error: null, saved: true });
    } catch (saveError) {
      setNoteState({
        saving: false,
        error: saveError instanceof Error ? saveError.message : "Unable to save admin note.",
        saved: false,
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backTarget)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <ChevronLeft size={14} /> {backLabel}
          </button>
          <button disabled={noteState.saving} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
            <RefreshCcw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="p-6 max-w-5xl mx-auto text-sm text-slate-400 dark:text-slate-300">Loading submission record…</div>;
  }

  return (
    <div className={`p-6 max-w-5xl mx-auto space-y-6 ${loading || noteState.saving ? "opacity-95" : ""}`}>
      {noteState.error && <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{noteState.error}</div>}
      {noteState.saved && <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">Admin note saved.</div>}
      {noteState.saving && <div className="text-xs text-slate-400 dark:text-slate-300">Saving admin note…</div>}
      <div className={`flex items-center justify-between gap-4 ${loading || noteState.saving ? "opacity-95" : ""}`}>
        <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm">
          <ChevronLeft size={15} /> {backLabel}
        </button>
        <button disabled={noteState.saving} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 font-bold text-xl">{data.title}</h1>
            <p className="text-slate-400 dark:text-slate-300 text-sm">{data.subtitle}</p>
          </div>
          <StatusChip status={data.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Submission Details</p>
            {data.details.map((field) => (
              <div key={field.l} className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0">
                <span className="text-slate-400 dark:text-slate-300 text-xs">{field.l}</span>
                <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{field.v}</span>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Files</p>
            {data.files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-xs text-slate-400 dark:text-slate-300">No uploaded files are attached to this submission.</div>
            ) : (
              data.files.map((file) => (
                <div key={file.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 mb-2 last:mb-0">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-700 dark:text-blue-300" />
                    <span className="text-slate-600 dark:text-slate-300 text-xs">{file.name}</span>
                  </div>
                  {file.href ? (
                    <a href={file.href} target="_blank" rel="noreferrer" className="text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline flex items-center gap-1">
                      <Download size={11} /> Download
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-300 text-xs font-semibold flex items-center gap-1">
                      <Download size={11} /> Unavailable
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Audit Timeline</p>
            {data.timeline.map((item, index) => (
              <div key={`${item.e}-${index}`} className="flex items-start gap-3 mb-2.5 last:mb-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-slate-700 dark:text-slate-200 text-xs font-medium">{item.e}</p>
                  <p className="text-slate-400 dark:text-slate-300 text-[10px]">{item.t}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className={`text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3 ${loading || noteState.saving ? "opacity-80" : ""}`}>Admin Notes</p>
            <p className="text-slate-400 dark:text-slate-300 text-[11px] mb-3">Add an admin note for this submission.</p>
            <textarea
              disabled={noteState.saving || loading}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteState((current) => ({ ...current, error: null, saved: false }));
              }}
              rows={4}
              placeholder="Add admin notes here…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none resize-none disabled:opacity-60"
            />
            <button disabled={noteState.saving || !noteDirty} onClick={handleSaveNote} className="mt-2 w-full py-2 rounded-lg bg-blue-800 text-white text-xs font-semibold hover:bg-blue-900 disabled:opacity-50">
              {noteState.saving ? "Saving…" : !noteDirty ? "No Changes" : "Save Note"}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Teacher Feedback</p>
            <p className={`text-xs ${data.feedback.startsWith("No ") ? "text-slate-400 dark:text-slate-300 italic" : "text-slate-700 dark:text-slate-200"}`}>{data.feedback}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
