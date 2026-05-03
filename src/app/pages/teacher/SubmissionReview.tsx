import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, FileText, Download, CheckCircle2, RotateCcw, Star, Clock, Users, AlertCircle } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { teacherService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function TeacherSubmissionReview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const submissionId = id ?? "";
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get('back') || '/teacher/submissions';
  const backLabel = backTarget.includes('/teacher/dashboard') ? 'Back to Dashboard' : backTarget.includes('/teacher/subjects') ? 'Back to Subject' : 'Back to Submissions';
  const { data, reload, error, loading } = useAsyncData(
    () => submissionId ? teacherService.getSubmissionReview(submissionId) : Promise.reject(new Error("Submission ID is required.")),
    [submissionId],
  );
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('Submitted');
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hydratedSubmissionId, setHydratedSubmissionId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<null | 'grade' | 'review' | 'return' | 'reopen'>(null);

  useEffect(() => {
    if (!data || !submissionId || hydratedSubmissionId === submissionId) return;
    if (data.status) setStatus(data.status);
    setFeedback((data as any)?.feedback || '');
    const nextGrade = (data as any)?.grade;
    setGrade(nextGrade !== undefined && nextGrade !== null && String(nextGrade).trim() !== '' ? String(nextGrade) : '');
    setActionError(null);
    setHydratedSubmissionId(submissionId);
  }, [data, hydratedSubmissionId, submissionId]);

  const actionState = data?.allowedActions;
  const formReady = Boolean(data) && hydratedSubmissionId === submissionId;
  const infoRows = useMemo(() => {
    const rows = [
      { label: 'Student', value: data?.student ?? '—' },
      { label: 'Student ID', value: data?.studentId ?? '—' },
      { label: 'Activity', value: data?.activity ?? '—' },
      { label: 'Submitted', value: data?.submittedAt ?? '—' },
      { label: 'Late?', value: data?.late ?? '—' },
    ];
    if (data?.type === 'Group') {
      rows.splice(1, 1,
        { label: 'Group', value: data.groupName ?? '—' },
        { label: 'Submitted By', value: data.submittedBy ?? data.student ?? '—' },
        { label: 'Members', value: (data.groupMembers ?? []).join(', ') || '—' },
      );
    }
    return rows;
  }, [data]);

  const handleAction = async (action: 'grade' | 'review' | 'return' | 'reopen') => {
    const actionMap = {
      grade: { nextStatus: 'GRADED', allowed: actionState?.canGrade },
      review: { nextStatus: 'REVIEWED', allowed: actionState?.canMarkReviewed },
      return: { nextStatus: 'NEEDS_REVISION', allowed: actionState?.canRequestRevision },
      reopen: { nextStatus: 'REOPENED', allowed: actionState?.canReopen },
    } as const;
    const selected = actionMap[action];
    if (!selected.allowed) {
      setActionError(actionState?.reason || 'This action is not valid for the current submission status.');
      return;
    }
    if (action === 'grade' && (!grade || Number.isNaN(Number(grade)))) {
      setActionError('Enter a numeric grade before marking the submission as graded.');
      return;
    }
    setActionError(null);
    if (!submissionId) {
      setActionError('Submission ID is missing, so no review action was saved.');
      return;
    }
    if (actionInFlight) return;
    setActionInFlight(action);

    try {
      await teacherService.reviewSubmission(submissionId, {
        status: selected.nextStatus,
        grade: grade ? Number(grade) : undefined,
        feedback,
      });
      await reload();
      setSaved(true);
      setStatus(selected.nextStatus.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaved(false);
      setActionError(err instanceof Error ? err.message : 'Unable to save the review action.');
    } finally {
      setActionInFlight(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm">
            <ChevronLeft size={15} /> {backLabel}
          </button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div aria-hidden="true" className="h-72 rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            <div aria-hidden="true" className="h-40 rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div aria-hidden="true" className="h-[420px] rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm">
            <ChevronLeft size={15} /> {backLabel}
          </button>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Unable to load this submission.</p>
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300/80">{error}</p>
          <button onClick={() => reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-white dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm">
          <ChevronLeft size={15} /> {backLabel}
        </button>
        <StatusChip status={status} />
      </div>

      {saved && <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30"><CheckCircle2 size={16} className="text-emerald-600 shrink-0" /><p className="text-emerald-700 dark:text-emerald-300 text-sm font-semibold">Review action saved successfully.</p></div>}
      {error && <div className="px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-sm font-medium text-rose-700 dark:text-rose-300">Unable to refresh this submission. Showing the last known data. {error}</div>}
      {actionError && <div className="px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-sm font-medium text-rose-700 dark:text-rose-300">{actionError}</div>}
      {actionState?.reason && !actionError && <div className="px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-sm font-medium text-amber-800">{actionState.reason}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}>{data?.title ?? 'Loading…'}</h1>
                <p className="text-slate-400 dark:text-slate-300 text-sm mt-0.5">{data?.subject ?? ''} · {data?.section ?? ''}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-100">
                <Clock size={13} className="text-amber-600" />
                <span className="text-amber-700 dark:text-amber-300 text-xs font-semibold">Due {data?.due ?? '—'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {infoRows.map((row) => (
                <div key={row.label} className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-300">{row.label}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">{row.value}</p>
                </div>
              ))}
            </div>

            {data?.type === 'Group' && (
              <div className="mb-5 rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-teal-700 dark:text-teal-300" />
                  <p className="text-teal-800 dark:text-teal-200 text-xs font-semibold uppercase tracking-wider">Group Details</p>
                </div>
                <p className="text-slate-800 dark:text-slate-100 text-sm font-semibold">{data.groupName ?? '—'}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Submitted by {data.submittedBy ?? data.student ?? '—'}</p>
                {(data.groupMembers ?? []).length > 0 && <ul className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">{data.groupMembers?.map((member) => <li key={member}>{member}</li>)}</ul>}
              </div>
            )}

            <div className="mb-5">
              <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Submission Description</p>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{data?.description}</p>
            </div>

            <div>
              <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Attached Files</p>
              <div className="space-y-2">{(data?.files ?? []).map((f) => <div key={f.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"><div className="flex items-center gap-2.5"><FileText size={15} className="text-blue-700 dark:text-blue-300" /><div><p className="text-slate-700 dark:text-slate-200 text-xs font-medium">{f.name}</p><p className="text-slate-400 dark:text-slate-300 text-[10px]">{f.size}</p></div></div>{f.href ? <a href={f.href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline"><Download size={12} /> Download</a> : <span className="flex items-center gap-1 text-slate-400 dark:text-slate-300 text-xs font-semibold"><Download size={12} /> Unavailable</span>}</div>)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5 sticky top-6">
            <h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-4">Review & Grade</h2>
            <div className="mb-4">
              <label htmlFor="teacher-review-grade" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Grade (out of 100)</label>
              <input id="teacher-review-grade" type="number" min="0" max="100" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 92" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10 transition-all" disabled={!formReady} />
            </div>
            <div className="mb-5">
              <label htmlFor="teacher-review-feedback" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Feedback / Comments</label>
              <textarea id="teacher-review-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} placeholder="Provide constructive feedback for the student…" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10 transition-all resize-none" disabled={!formReady} />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-600 dark:text-slate-300 mb-4">
              <div className="flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 text-slate-500 dark:text-slate-400 shrink-0" /><p>Only valid actions are enabled for the current submission state. Finalized submissions must be reopened before they can be changed again.</p></div>
            </div>
            <div className="space-y-2">
              <button disabled={loading || !formReady || !actionState?.canGrade || actionInFlight !== null} onClick={() => handleAction('grade')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"><Star size={14} /> {actionInFlight === 'grade' ? 'Saving...' : 'Mark as Graded'}</button>
              <button disabled={loading || !formReady || !actionState?.canMarkReviewed || actionInFlight !== null} onClick={() => handleAction('review')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"><CheckCircle2 size={14} /> {actionInFlight === 'review' ? 'Saving...' : 'Mark as Reviewed'}</button>
              <button disabled={loading || !formReady || !actionState?.canRequestRevision || actionInFlight !== null} onClick={() => handleAction('return')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-200 text-orange-600 text-sm font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50"><RotateCcw size={14} /> {actionInFlight === 'return' ? 'Saving...' : 'Return for Revision'}</button>
              <button disabled={loading || !formReady || !actionState?.canReopen || actionInFlight !== null} onClick={() => handleAction('reopen')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors disabled:opacity-50"><RotateCcw size={14} /> {actionInFlight === 'reopen' ? 'Saving...' : 'Reopen Submission'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
