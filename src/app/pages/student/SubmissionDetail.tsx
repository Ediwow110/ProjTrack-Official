import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, FileText, Users, ExternalLink, Download, PencilLine } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { GradeChip } from "../../components/ui/GradeChip";
import { PortalPage } from "../../components/portal/PortalPage";
import { studentService } from "../../lib/api/services";
import { isEditableSubmissionStatus } from "../../lib/submissionRules";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function parseLinkedFile(file: string) {
  if (!file.includes("|||")) return { label: file, href: "" };
  const [label, href] = file.split("|||");
  return { label, href };
}

export default function StudentSubmissionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get("back") || "/student/submissions";
  const backLabel = backTarget.includes("/student/subjects/") ? "Back to Activities" : backTarget.includes("/student/dashboard") ? "Back to Dashboard" : backTarget.includes("/student/calendar") ? "Back to Calendar" : "Back to Submissions";
  const activityIdQuery = searchParams.get("activityId") || "";

  const { data: detail, loading, error } = useAsyncData(
    () => id ? studentService.getSubmissionDetail(String(id)) : Promise.reject(new Error("Submission not found.")),
    [id],
  );
  const { data: submissionRowsData } = useAsyncData(() => studentService.getSubmissions(), []);
  const submissionRows = submissionRowsData ?? [];

  const submission = useMemo(() => {
    if (detail) return detail;
    if (activityIdQuery) {
      const byActivity = submissionRows.find((item) => String(item.activityId || "") === String(activityIdQuery));
      if (byActivity) return byActivity;
    }
    return undefined;
  }, [activityIdQuery, detail, submissionRows]);

  const linkedFiles = submission?.files?.map(parseLinkedFile) ?? [];
  const externalLinks = submission?.externalLinks ?? [];

  if (loading) return <PortalPage className="max-w-5xl"><div className="h-72 rounded-[28px] bg-slate-100 dark:bg-slate-800/80 animate-pulse dark:bg-slate-800/70" /></PortalPage>;
  if (error) return <PortalPage className="max-w-5xl"><div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-200">{error}</div></PortalPage>;

  if (!submission) {
    return <PortalPage className="max-w-5xl space-y-4">
      <button onClick={() => navigate(backTarget)} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] transition hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft size={15} /> {backLabel}</button>
      <div className="rounded-[28px] border border-white/70 bg-white/86 p-6 text-center shadow-[0_24px_70px_-46px_rgba(15,23,42,0.45)] dark:border-slate-700/60 dark:bg-slate-900/80">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Submission not found.</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">The selected submission may have been removed or is no longer available.</p>
      </div>
    </PortalPage>;
  }

  const editTarget = `/student/submit?subject=${encodeURIComponent(submission.subject)}&subjectId=${encodeURIComponent(String(submission.subjectId || ""))}&activity=${encodeURIComponent(submission.activityTitle || submission.title)}&activityId=${encodeURIComponent(String(submission.activityId || ""))}&submissionId=${encodeURIComponent(String(submission.id))}&back=${encodeURIComponent(backTarget)}`;

  return <PortalPage className="max-w-5xl space-y-6">
    <button onClick={() => navigate(backTarget)} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] transition hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft size={15} /> {backLabel}</button>
    <div className="space-y-5 rounded-[28px] border border-white/70 bg-white/86 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.45)] dark:border-slate-700/60 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 dark:text-slate-500">Submission Detail</p>
          <h1 className="mt-1 font-bold text-slate-900 dark:text-slate-100" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>{submission.title}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>{submission.subject}</span>
            <span>•</span>
            <span>{submission.type}</span>
            <span>•</span>
            <span>Due {submission.due}</span>
            <span>•</span>
            <span>Submitted {submission.submitted}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={submission.status} size="sm" />
          <GradeChip grade={submission.grade} status={submission.status} size="sm" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[22px] border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 p-4 dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/15"><FileText size={14} className="text-blue-700 dark:text-blue-300 dark:text-blue-200" /></div>
            <div className="flex-1">
              <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Teacher Feedback</p>
              {submission.feedback ? <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{submission.feedback}</p> : <p className="text-sm italic text-slate-400 dark:text-slate-300 dark:text-slate-500">No feedback yet. Check back after your teacher reviews this submission.</p>}
            </div>
          </div>
        </div>

        {submission.type === "Group" && (
          <div className="rounded-[22px] border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 p-4 dark:border-slate-700/60 dark:bg-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-500/15"><Users size={14} className="text-teal-700 dark:text-teal-300 dark:text-teal-200" /></div>
              <div className="flex-1">
                <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Group Details</p>
                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-800 dark:text-slate-100">Group:</span> {submission.groupName || "—"}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-100">Leader:</span> {submission.leader || "—"}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-100">Submitted By:</span> {submission.submittedBy || submission.leader || "—"}</p>
                </div>
                {!!submission.members?.length && <div className="mt-3 space-y-1"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Members</p>{submission.members.map((member) => <div key={member} className="text-sm text-slate-500 dark:text-slate-400">• {member}</div>)}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,0.8fr]">
        <div className="rounded-[22px] border border-slate-100 dark:border-slate-700/70 p-4 dark:border-slate-700/60">
          <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-200">Submitted Files</p>
          {linkedFiles.length > 0 ? <div className="space-y-2">{linkedFiles.map((file) => <div key={`${file.label}-${file.href}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 dark:bg-slate-800/80"><span className="break-all text-sm text-slate-600 dark:text-slate-300">{file.label}</span>{file.href ? <a href={file.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline dark:text-blue-200"><Download size={13} /> Download</a> : <span className="text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">Attached</span>}</div>)}</div> : <p className="text-sm text-slate-400 dark:text-slate-300 dark:text-slate-500">No uploaded files were attached to this submission.</p>}
        </div>

        <div className="space-y-4 rounded-[22px] border border-slate-100 dark:border-slate-700/70 p-4 dark:border-slate-700/60">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Submission Summary</p>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p><span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span> {submission.status}</p>
              <div className="flex items-center gap-2"><span className="font-semibold text-slate-800 dark:text-slate-100">Grade:</span> <GradeChip grade={submission.grade} status={submission.status} size="xs" /></div>
              <p><span className="font-semibold text-slate-800 dark:text-slate-100">Type:</span> {submission.type}</p>
            </div>
          </div>

          {submission.description && <div><p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Description</p><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{submission.description}</p></div>}
          {submission.notes && <div><p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Notes</p><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{submission.notes}</p></div>}
          {externalLinks.length > 0 && <div><p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">External Links</p><div className="space-y-2">{externalLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-sm text-blue-700 dark:text-blue-300 hover:underline dark:text-blue-200"><ExternalLink size={14} /> {link}</a>)}</div></div>}

          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => navigate(backTarget.includes("/student/submissions") ? backTarget : "/student/submissions")} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-800">All Submissions</button>
            {isEditableSubmissionStatus(submission.status) && <button onClick={() => navigate(editTarget)} className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"><PencilLine size={14} /> Continue Editing</button>}
          </div>
        </div>
      </div>
    </div>
  </PortalPage>;
}
