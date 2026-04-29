import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, Upload, X, CheckCircle2, FileText, Users, AlertCircle, Lock } from "lucide-react";
import { studentService } from "../../lib/api/services";
import { isEditableSubmissionStatus } from "../../lib/submissionRules";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { getAuthSession } from "../../lib/mockAuth";

export default function StudentSubmitProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data } = useAsyncData(() => studentService.getSubmitCatalog(), []);

  const [subject, setSubject] = useState("");
  const [activityId, setActivityId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [submittedRecordId, setSubmittedRecordId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = data?.subjects ?? [];
  const requestedSubject = searchParams.get("subject") || "";
  const requestedSubjectId = searchParams.get("subjectId") || "";
    const requestedActivityId = searchParams.get("activityId") || "";
  const requestedSubmissionId = searchParams.get("submissionId") || "";
  const backTarget = searchParams.get("back") || "/student/submissions";
  const draftKey = `projtrack-draft:${getAuthSession()?.userId || "unknown"}:${activityId || requestedActivityId || "unselected"}`;

  const { data: existingSubmission } = useAsyncData<any | null>(
    () => requestedSubmissionId ? studentService.getSubmissionDetail(requestedSubmissionId) : Promise.resolve(null),
    [requestedSubmissionId],
  );

  const selectedActivity = useMemo(() => {
    const entries = data?.activities?.[subject] ?? [];
    const resolvedActivityId = activityId || requestedActivityId;
    if (!resolvedActivityId) return undefined;
    return entries.find((item) => String(item.id) === String(resolvedActivityId));
  }, [activityId, data, requestedActivityId, subject]);

  const selectedContext = selectedActivity?.submissionContext;
  const isEditingExistingSubmission = Boolean(requestedSubmissionId);
  const isEditableExistingSubmission = isEditableSubmissionStatus(existingSubmission?.status);
  const isLocked = selectedActivity?.canSubmit === false || (isEditingExistingSubmission && !isEditableExistingSubmission);
  const backLabel = backTarget.includes("/student/subjects/") ? "Back to Activities" : "Back";

  useEffect(() => {
    if (!data) return;
    const requestedById = requestedSubjectId
      ? Object.entries(data.activities || {}).find(([, items]) => (items || []).some((item) => String(item.subjectId || "") === String(requestedSubjectId)))?.[0]
      : "";
    if (requestedById) {
      setSubject((current) => current || requestedById);
      return;
    }
    if (requestedSubject && subjects.includes(requestedSubject)) {
      setSubject((current) => current || requestedSubject);
    }
  }, [data, requestedSubject, requestedSubjectId, subjects]);

  useEffect(() => {
    if (!data || !subject) return;
    const entries = data.activities?.[subject] ?? [];
    const nextActivity = requestedActivityId
      ? entries.find((item) => String(item.id) === String(requestedActivityId))
      : undefined;
    if (nextActivity) {
      setActivityId((current) => current || String(nextActivity.id || ''));
      return;
    }
    if (!activityId && entries.length === 1) {
      setActivityId(String(entries[0].id || ''));
    }
  }, [activityId, data, subject, requestedActivityId]);

  useEffect(() => {
    if (!selectedActivity) return;
    setTitle((current) => current || selectedActivity.title);
  }, [selectedActivity]);

  useEffect(() => {
    if (!existingSubmission) return;
    setTitle(existingSubmission.title || existingSubmission.activityTitle || "");
    setDesc(existingSubmission.description || "");
    setNotes(existingSubmission.notes || "");
    setLinks(existingSubmission.externalLinks?.length ? existingSubmission.externalLinks : [""]);
  }, [existingSubmission]);

  const handleSaveDraft = () => {
    const payload = {
      subject,
      activityId,
      title,
      description: desc,
      notes,
      externalLinks: links.map((item) => item.trim()).filter(Boolean),
      fileName: file?.name ?? null,
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await studentService.submitProject({
        activityId: String(selectedActivity?.id || ""),
        title,
        description: desc,
        notes,
        externalLinks: links.map((item) => item.trim()).filter(Boolean),
        file,
        groupId: selectedActivity?.groupId,
        groupName: selectedActivity?.groupName,
        type: selectedActivity?.type,
      });
      setSubmittedRecordId(String(response?.id || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit the project.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRecordId) {
    return <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-emerald-600" /></div>
      <h2 className="text-slate-900 dark:text-slate-100 font-bold text-xl mb-2">Submission Successful!</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Your submission has been saved and is ready for teacher review.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate(`/student/submissions/${encodeURIComponent(submittedRecordId)}?back=${encodeURIComponent(backTarget)}`)} className="px-5 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900">Open Submission</button>
        <button onClick={() => navigate(backTarget)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">{backLabel}</button>
      </div>
    </div>;
  }

  return <div className="p-6 max-w-4xl mx-auto space-y-6">
    <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> {backLabel}</button>

    <div>
      <h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>{isEditingExistingSubmission ? "Continue Submission" : "Submit Project"}</h1>
      <p className="text-slate-400 dark:text-slate-300 text-sm mt-0.5">Use the correct student submission flow for the selected activity.</p>
    </div>

    {error && <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
    {draftSaved && <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">Draft saved locally.</div>}

    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="student-submit-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Subject</label>
          <select id="student-submit-subject" value={subject} onChange={(e) => { setSubject(e.target.value); setActivityId(""); }} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400">
            <option value="">Select subject</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="student-submit-activity" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Activity</label>
          <select id="student-submit-activity" value={activityId} onChange={(e) => setActivityId(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400" disabled={!subject}>
            <option value="">Select activity</option>
            {(data?.activities?.[subject] ?? []).map((item) => <option key={item.id || item.title} value={String(item.id || '')}>{item.title}</option>)}
          </select>
        </div>
      </div>

      {selectedActivity && <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedActivity.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Due {selectedActivity.due}</p>
          </div>
          <div className="flex flex-wrap gap-2">{selectedActivity.type === "group" ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><Users size={12} /> Group</span> : <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300"><FileText size={12} /> Individual</span>}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div><span className="font-semibold text-slate-700 dark:text-slate-200">Access:</span> {selectedContext?.accessLabel || (selectedActivity.canSubmit ? "Can submit now" : "Unavailable")}</div>
          <div><span className="font-semibold text-slate-700 dark:text-slate-200">Status:</span> {existingSubmission?.status || (selectedActivity.canSubmit ? "Open" : "Locked")}</div>
        </div>

        {selectedContext?.availabilityMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{selectedContext.availabilityMessage}</p>}
        {selectedActivity.type === "group" && !selectedContext?.group && <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-3 py-3 text-sm text-amber-700 dark:text-amber-300">You must join or create the correct subject group before submitting this activity.</div>}
        {selectedActivity.type === "group" && selectedContext?.group && <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-3 py-3 text-sm text-slate-600 dark:text-slate-300"><p><span className="font-semibold text-slate-700 dark:text-slate-200">Group:</span> {selectedContext.group.name}</p><p><span className="font-semibold text-slate-700 dark:text-slate-200">Leader:</span> {selectedContext.group.leader || "—"}</p>{selectedContext.group.members?.length ? <p><span className="font-semibold text-slate-700 dark:text-slate-200">Members:</span> {selectedContext.group.members.join(", ")}</p> : null}</div>}
        {isLocked && <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-3 py-3 text-sm text-amber-700 dark:text-amber-300 inline-flex items-center gap-2"><Lock size={14} /> {isEditingExistingSubmission && !isEditableExistingSubmission ? "This submission can no longer be edited from the student flow." : "This activity is not currently open for editing or submission."}</div>}
      </div>}

      <div>
        <label htmlFor="student-submit-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Submission Title</label>
        <input id="student-submit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a clear submission title" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400" required />
      </div>

      <div>
        <label htmlFor="student-submit-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Description</label>
        <textarea id="student-submit-description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Describe the work you are submitting" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 resize-none" required />
      </div>

      <div>
        <label htmlFor="student-submit-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Notes</label>
        <textarea id="student-submit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add optional notes for your teacher" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 resize-none" />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">External Links</label>
        <div className="space-y-2">
          {links.map((link, index) => <div key={index} className="flex items-center gap-2"><input value={link} onChange={(e) => setLinks((current) => current.map((item, i) => i === index ? e.target.value : item))} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400" aria-label={`External link ${index + 1}`} />{links.length > 1 && <button type="button" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70" aria-label={`Remove external link ${index + 1}`}><X size={14} /></button>}</div>)}
          <button type="button" onClick={() => setLinks((current) => [...current, ""])} className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline" aria-label="Add another submission link">Add another link</button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 mb-2">Upload File</label>
        <label htmlFor="student-submit-file" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-800/70 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50">
          <Upload size={16} />
          <span>{file ? file.name : "Choose a file to upload"}</span>
          <input id="student-submit-file" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      {selectedActivity?.rules?.length ? <div className="rounded-xl border border-blue-100 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/15 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">Submission Rules</p><div className="space-y-1 text-sm text-blue-800">{selectedActivity.rules.map((rule: string) => <p key={rule}>• {rule}</p>)}</div></div> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" onClick={handleSaveDraft} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">Save Draft</button>
        <button type="submit" disabled={submitting || isLocked || !selectedActivity || !subject || !activityId || !title.trim() || !desc.trim()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? <><AlertCircle size={14} /> Saving...</> : isEditingExistingSubmission ? "Save Submission" : "Submit Project"}</button>
      </div>
    </form>
  </div>;
}
