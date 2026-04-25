from pathlib import Path

root = Path('/mnt/data/pass9')

# Update contracts
contracts = root / 'src/app/lib/api/contracts.ts'
text = contracts.read_text()
old = "export interface StudentSubmissionRow {\n  id: string;\n  activityId?: string;\n  subjectId?: string;\n  title: string;\n"
new = "export interface StudentSubmissionRow {\n  id: string;\n  activityId?: string;\n  subjectId?: string;\n  activityTitle?: string;\n  title: string;\n"
if old in text:
    text = text.replace(old, new)
contracts.write_text(text)

# Update services mappings
services = root / 'src/app/lib/api/services.ts'
text = services.read_text()
text = text.replace(
"        title: row.title,\n        subject: row.subject || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\\b\\w/g, (m: string) => m.toUpperCase()) || 'Subject',\n",
"        title: row.title,\n        activityTitle: row.activityTitle || row.title,\n        subject: row.subject || row.subjectName || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\\b\\w/g, (m: string) => m.toUpperCase()) || 'Subject',\n",
1)
text = text.replace(
"        title: row.title,\n        subject: row.subjectName || row.subject || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\\b\\w/g, (m: string) => m.toUpperCase()) || 'Subject',\n",
"        title: row.title,\n        activityTitle: row.activityTitle || row.title,\n        subject: row.subjectName || row.subject || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\\b\\w/g, (m: string) => m.toUpperCase()) || 'Subject',\n",
1)
services.write_text(text)

# Rewrite Student SubjectDetails with safer routing
(root / 'src/app/pages/student/SubjectDetails.tsx').write_text('''import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, BookOpen, Users, FileText, Clock, Copy, CheckCircle2, Plus, Lock, UserPlus } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { studentGroupService, studentService, studentSubjectService } from "../../lib/api/services";

const allTabs = ["Overview", "Activities", "My Group"] as const;
type SubjectTab = (typeof allTabs)[number];
const tabParamMap: Record<string, SubjectTab> = { overview: "Overview", activities: "Activities", group: "My Group" };
const reverseTabParamMap: Record<SubjectTab, string> = { Overview: "overview", Activities: "activities", "My Group": "group" };

function normalizeStatus(value?: string) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeWindow(value?: string) {
  return String(value || "").trim().toUpperCase();
}

function isEditableSubmission(status?: string) {
  const normalized = normalizeStatus(status);
  return normalized === "DRAFT" || normalized === "NEEDS_REVISION" || normalized === "REOPENED";
}

function isViewOnlySubmission(status?: string) {
  const normalized = normalizeStatus(status);
  return ["SUBMITTED", "PENDING_REVIEW", "REVIEWED", "GRADED", "LATE"].includes(normalized);
}

function isSubmissionWindowOpen(windowStatus?: string) {
  return ["OPEN", "REOPENED"].includes(normalizeWindow(windowStatus));
}

function buildActivityAction(args: {
  activity: any;
  subjectId: string;
  subjectName: string;
  backTarget: string;
  matchedSubmission?: any;
}) {
  const { activity, subjectId, subjectName, backTarget, matchedSubmission } = args;
  const submissionStatus = normalizeStatus(activity.status);
  const windowStatus = normalizeWindow(activity.window);
  const actionLabel = String(activity.action || "").trim();

  if (matchedSubmission && (isEditableSubmission(submissionStatus) || actionLabel === "Continue" || actionLabel === "Resubmit")) {
    return {
      disabled: false,
      label: actionLabel || "Continue",
      target: `/student/submit?subject=${encodeURIComponent(subjectName)}&subjectId=${encodeURIComponent(subjectId)}&activity=${encodeURIComponent(matchedSubmission.activityTitle || activity.title)}&activityId=${encodeURIComponent(String(activity.id))}&submissionId=${encodeURIComponent(String(matchedSubmission.id))}&back=${encodeURIComponent(backTarget)}`,
    };
  }

  if (matchedSubmission && (isViewOnlySubmission(submissionStatus) || actionLabel === "View" || actionLabel === "View Result")) {
    return {
      disabled: false,
      label: actionLabel === "View Result" ? "View Result" : "View Submission",
      target: `/student/submissions/${encodeURIComponent(String(matchedSubmission.id))}?back=${encodeURIComponent(backTarget)}`,
    };
  }

  if (isSubmissionWindowOpen(windowStatus) && actionLabel !== "Closed") {
    return {
      disabled: false,
      label: actionLabel || "Submit",
      target: `/student/submit?subject=${encodeURIComponent(subjectName)}&subjectId=${encodeURIComponent(subjectId)}&activity=${encodeURIComponent(activity.title)}&activityId=${encodeURIComponent(String(activity.id))}&back=${encodeURIComponent(backTarget)}`,
    };
  }

  if (matchedSubmission) {
    return {
      disabled: false,
      label: "Open Submission",
      target: `/student/submissions/${encodeURIComponent(String(matchedSubmission.id))}?back=${encodeURIComponent(backTarget)}`,
    };
  }

  return {
    disabled: true,
    label: windowStatus === "CLOSED" ? "Closed" : "Not Yet Open",
    target: "",
  };
}

export default function StudentSubjectDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = tabParamMap[searchParams.get("tab") || ""] || "Overview";
  const [copied, setCopied] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupActionState, setGroupActionState] = useState<{ saving: boolean; error: string | null; success: string | null }>({ saving: false, error: null, success: null });
  const { data, loading, reload } = useAsyncData(() => id ? studentSubjectService.getSubject(id) : Promise.reject(new Error("Subject id is required.")), [id]);
  const { data: submissionRows = [] } = useAsyncData(() => studentService.getSubmissions(), []);
  const tabs = data?.groupEnabled ? allTabs : (["Overview", "Activities"] as const);
  const tab = tabs.includes(requestedTab as any) ? requestedTab : "Overview";
  const subjectPath = `/student/subjects/${encodeURIComponent(String(id || ""))}`;
  const returnToActivities = `${subjectPath}?tab=activities`;

  const copyCode = async () => {
    if (!data?.group?.code || data.group.code === "—") return;
    try {
      await navigator.clipboard.writeText(data.group.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleTabChange = (nextTab: SubjectTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", reverseTabParamMap[nextTab] || "overview");
    setSearchParams(next, { replace: true });
  };

  const activityRows = useMemo(() => {
    if (!data || !id) return [];
    return data.activities.map((activity: any) => {
      const matchedSubmission = submissionRows.find((item) => String(item.activityId || "") === String(activity.id || ""));
      const action = buildActivityAction({
        activity: {
          id: activity.id,
          title: activity.title,
          status: activity.status,
          window: activity.window,
          action: activity.action,
        },
        subjectId: String(id),
        subjectName: data.name,
        backTarget: returnToActivities,
        matchedSubmission,
      });

      return {
        ...activity,
        disabled: action.disabled,
        target: action.target,
        label: action.label,
      };
    });
  }, [data, id, returnToActivities, submissionRows]);

  const handleCreateGroup = async () => {
    if (!id || !groupName.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.createGroup(id, groupName.trim());
      await reload();
      setGroupName("");
      setGroupActionState({ saving: false, error: null, success: "Group created successfully." });
    } catch (err) {
      setGroupActionState({ saving: false, error: err instanceof Error ? err.message : "Unable to create the group right now.", success: null });
    }
  };

  const handleJoinGroup = async () => {
    if (!id || !joinCode.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.joinGroup(id, joinCode.trim());
      await reload();
      setJoinCode("");
      setGroupActionState({ saving: false, error: null, success: "Group joined successfully." });
    } catch (err) {
      setGroupActionState({ saving: false, error: err instanceof Error ? err.message : "Unable to join the group with that code.", success: null });
    }
  };

  if (!data && loading) return <div className="p-6 max-w-7xl mx-auto"><div className="h-72 rounded-xl bg-slate-100 animate-pulse" /></div>;
  if (!data) return null;

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <button onClick={() => navigate("/student/subjects")} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition-colors"><ChevronLeft size={15} /> Back to Subjects</button>
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-blue-800 flex items-center justify-center shrink-0"><BookOpen size={24} className="text-white" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1"> <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{data.code}</span> <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Active</span> </div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>{data.name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500"><span>👨‍🏫 {data.teacher}</span><span>📚 {data.section}</span><span>📅 {data.term}</span><span>📋 {data.activitiesCount} Activities</span></div>
        </div>
      </div>
    </div>
    <div className="flex gap-1 border-b border-slate-200"> {tabs.map((t) => <button key={t} onClick={() => handleTabChange(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t ? "border-blue-800 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>)} </div>
    {tab === "Overview" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{data.overview.map((s: any) => <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"><p className="text-slate-400 text-xs font-medium">{s.label}</p><p className="text-slate-900 font-bold text-2xl mt-1">{s.value}</p></div>)}</div>}
    {tab === "Activities" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b border-slate-100">{["Activity Title", "Type", "Due Date", "File Types", "Window", "Status", "Action"].map((h) => <th key={h} className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{activityRows.map((a: any) => <tr key={a.id} className="hover:bg-slate-50 transition-colors"><td className="px-5 py-3.5"><p className="text-slate-800 font-semibold text-xs">{a.title}</p>{a.daysLeft < 0 && <p className="text-rose-500 text-[10px] font-semibold">Overdue by {Math.abs(a.daysLeft)}d</p>}{a.daysLeft >= 0 && a.daysLeft <= 5 && <p className="text-amber-600 text-[10px] font-semibold">{a.daysLeft}d left</p>}</td><td className="px-5 py-3.5"><span className="flex items-center gap-1 text-xs text-slate-500">{a.type === "Group" ? <Users size={11} /> : <FileText size={11} />} {a.type}</span></td><td className="px-5 py-3.5 text-slate-500 text-xs flex items-center gap-1"><Clock size={11} className="shrink-0" /> {a.due}</td><td className="px-5 py-3.5 text-slate-400 text-[11px]">{a.fileTypes}</td><td className="px-5 py-3.5"><StatusChip status={a.window} size="xs" /></td><td className="px-5 py-3.5"><StatusChip status={a.status} size="xs" /></td><td className="px-5 py-3.5"><button onClick={() => !a.disabled && a.target && navigate(a.target)} disabled={a.disabled} className={`text-xs font-semibold whitespace-nowrap ${a.disabled ? "text-slate-300 cursor-not-allowed" : "text-blue-700 hover:underline"}`}>{a.label} {!a.disabled ? "→" : ""}</button></td></tr>)}</tbody></table></div>}
    {tab === "My Group" && <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6">
      <div className="space-y-5">
        {!data.group ? <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-5">
          <div><p className="text-slate-400 text-xs font-medium">No active group yet</p><h2 className="text-slate-900 text-lg font-bold mt-1">Create or Join a Group</h2><p className="text-slate-500 text-sm mt-1">This subject supports group work. Create a new group or paste a valid invite code to join an existing one.</p></div>
          {groupActionState.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{groupActionState.error}</div>}
          {groupActionState.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{groupActionState.success}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex items-center gap-2"><Plus size={16} className="text-blue-700" /><p className="text-slate-800 font-semibold text-sm">Create a Group</p></div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Enter your group name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400" /><button onClick={handleCreateGroup} disabled={groupActionState.saving || !groupName.trim()} className="w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{groupActionState.saving ? "Saving..." : "Create Group"}</button></div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex items-center gap-2"><UserPlus size={16} className="text-teal-700" /><p className="text-slate-800 font-semibold text-sm">Join by Invite Code</p></div><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Paste the invite code" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase tracking-widest text-slate-700 outline-none focus:border-teal-400" /><button onClick={handleJoinGroup} disabled={groupActionState.saving || !joinCode.trim()} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">{groupActionState.saving ? "Joining..." : "Join Group"}</button></div>
          </div>
        </div> : <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-slate-400 text-xs font-medium">Current Group</p><h2 className="text-slate-900 text-lg font-bold mt-1">{data.group.name}</h2><p className="text-slate-500 text-sm mt-1">Manage your member list, invite code, and activity submissions from this workspace.</p></div><div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${String(data.group.status || "").toLowerCase() === "locked" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{String(data.group.status || "").toLowerCase() === "locked" ? <Lock size={12} /> : <CheckCircle2 size={12} />} {data.group.status}</div></div>
          <div className="grid md:grid-cols-2 gap-4"><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Invite Code</p><div className="mt-3 flex items-center gap-3"><div className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-mono tracking-[0.2em] text-slate-700 uppercase">{data.group.code}</div><button onClick={copyCode} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Copy size={13} /> {copied ? "Copied" : "Copy"}</button></div><p className="mt-2 text-xs text-slate-400">Share this invite code with classmates who should join your approved group.</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Group Summary</p><div className="mt-3 space-y-2 text-sm text-slate-600"><p><span className="font-semibold text-slate-700">Members:</span> {data.group.members}</p><p><span className="font-semibold text-slate-700">Leader:</span> {data.group.leader}</p><p><span className="font-semibold text-slate-700">Status:</span> {data.group.status}</p></div></div></div>
        </div>}
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"><p className="text-slate-400 text-xs font-medium">Recent Group Activity</p><div className="mt-3 space-y-2">{(data.recentActivity || []).map((entry: string) => <div key={entry} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">{entry}</div>)}{(!data.recentActivity || data.recentActivity.length === 0) && <p className="text-sm text-slate-400">No group activity has been recorded yet.</p>}</div></div>
      </div>
    </div>}
  </div>;
}
''')

# Rewrite Student Submission Detail
(root / 'src/app/pages/student/SubmissionDetail.tsx').write_text('''import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, FileText, Users, ExternalLink, Download, PencilLine } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function parseLinkedFile(file: string) {
  if (!file.includes("|||")) return { label: file, href: "" };
  const [label, href] = file.split("|||");
  return { label, href };
}

function isEditableStatus(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "draft" || normalized === "needs revision" || normalized === "reopened";
}

export default function StudentSubmissionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get("back") || "/student/submissions";
  const titleQuery = searchParams.get("title") || "";
  const activityIdQuery = searchParams.get("activityId") || "";

  const { data: detail, loading, error } = useAsyncData(
    () => id ? studentService.getSubmissionDetail(String(id)) : Promise.reject(new Error("Submission not found.")),
    [id],
  );
  const { data: submissionRows = [] } = useAsyncData(() => studentService.getSubmissions(), []);

  const submission = useMemo(() => {
    if (detail) return detail;
    if (activityIdQuery) {
      const byActivity = submissionRows.find((item) => String(item.activityId || "") === String(activityIdQuery));
      if (byActivity) return byActivity;
    }
    if (titleQuery) return submissionRows.find((item) => item.title === titleQuery || item.activityTitle === titleQuery);
    return undefined;
  }, [activityIdQuery, detail, submissionRows, titleQuery]);

  const linkedFiles = submission?.files?.map(parseLinkedFile) ?? [];
  const externalLinks = submission?.externalLinks ?? [];
  const backLabel = backTarget.includes("/student/subjects/") ? "Back to Activities" : "Back";

  if (loading) return <div className="p-6 max-w-5xl mx-auto"><div className="h-72 rounded-xl bg-slate-100 animate-pulse" /></div>;
  if (error) return <div className="p-6 max-w-5xl mx-auto"><div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div></div>;

  if (!submission) {
    return <div className="p-6 max-w-5xl mx-auto space-y-4">
      <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> {backLabel}</button>
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-slate-800 text-sm font-semibold">Submission not found.</p>
        <p className="text-slate-400 text-xs mt-1">The selected submission may have been removed or is no longer available.</p>
      </div>
    </div>;
  }

  const editTarget = `/student/submit?subject=${encodeURIComponent(submission.subject)}&subjectId=${encodeURIComponent(String(submission.subjectId || ""))}&activity=${encodeURIComponent(submission.activityTitle || submission.title)}&activityId=${encodeURIComponent(String(submission.activityId || ""))}&submissionId=${encodeURIComponent(String(submission.id))}&back=${encodeURIComponent(backTarget)}`;

  return <div className="p-6 max-w-5xl mx-auto space-y-6">
    <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> {backLabel}</button>
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Submission Detail</p>
          <h1 className="text-slate-900 font-bold mt-1" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>{submission.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
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
          <div className="text-emerald-600 font-bold text-sm">{submission.grade !== "—" ? `${submission.grade}/100` : "—"}</div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><FileText size={14} className="text-blue-700" /></div>
            <div className="flex-1">
              <p className="text-slate-700 text-xs font-bold mb-1">Teacher Feedback</p>
              {submission.feedback ? <p className="text-slate-600 text-sm leading-relaxed">{submission.feedback}</p> : <p className="text-slate-400 text-sm italic">No feedback yet. Check back after your teacher reviews this submission.</p>}
            </div>
          </div>
        </div>

        {submission.type === "Group" && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0"><Users size={14} className="text-teal-700" /></div>
              <div className="flex-1">
                <p className="text-slate-700 text-xs font-bold mb-1">Group Details</p>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-semibold">Group:</span> {submission.groupName || "—"}</p>
                  <p><span className="font-semibold">Leader:</span> {submission.leader || "—"}</p>
                  <p><span className="font-semibold">Submitted By:</span> {submission.submittedBy || submission.leader || "—"}</p>
                </div>
                {!!submission.members?.length && <div className="mt-3 space-y-1"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Members</p>{submission.members.map((member) => <div key={member} className="text-sm text-slate-500">• {member}</div>)}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,0.8fr] gap-5">
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-slate-700 text-xs font-bold mb-3">Submitted Files</p>
          {linkedFiles.length > 0 ? <div className="space-y-2">{linkedFiles.map((file) => <div key={`${file.label}-${file.href}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><span className="text-sm text-slate-600 break-all">{file.label}</span>{file.href ? <a href={file.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold hover:underline"><Download size={13} /> Download</a> : <span className="text-xs text-slate-400">Attached</span>}</div>)}</div> : <p className="text-sm text-slate-400">No uploaded files were attached to this submission.</p>}
        </div>

        <div className="rounded-xl border border-slate-100 p-4 space-y-4">
          <div>
            <p className="text-slate-700 text-xs font-bold mb-2">Submission Summary</p>
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-semibold">Status:</span> {submission.status}</p>
              <p><span className="font-semibold">Grade:</span> {submission.grade !== "—" ? `${submission.grade}/100` : "Pending"}</p>
              <p><span className="font-semibold">Type:</span> {submission.type}</p>
            </div>
          </div>

          {submission.description && <div><p className="text-slate-700 text-xs font-bold mb-2">Description</p><p className="text-sm text-slate-600 leading-relaxed">{submission.description}</p></div>}
          {submission.notes && <div><p className="text-slate-700 text-xs font-bold mb-2">Notes</p><p className="text-sm text-slate-600 leading-relaxed">{submission.notes}</p></div>}
          {externalLinks.length > 0 && <div><p className="text-slate-700 text-xs font-bold mb-2">External Links</p><div className="space-y-2">{externalLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-700 hover:underline break-all"><ExternalLink size={14} /> {link}</a>)}</div></div>}

          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => navigate("/student/submissions")} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">All Submissions</button>
            {isEditableStatus(submission.status) && <button onClick={() => navigate(editTarget)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900"><PencilLine size={14} /> Continue Editing</button>}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
''')

# Rewrite Student Submit Project
(root / 'src/app/pages/student/SubmitProject.tsx').write_text('''import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, Upload, X, CheckCircle2, FileText, Users, AlertCircle, Lock } from "lucide-react";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function normalizeStatus(value?: string) {
  return String(value || "").trim().toLowerCase();
}

export default function StudentSubmitProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data } = useAsyncData(() => studentService.getSubmitCatalog(), []);

  const [subject, setSubject] = useState("");
  const [activity, setActivity] = useState("");
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
  const requestedActivity = searchParams.get("activity") || "";
  const requestedActivityId = searchParams.get("activityId") || "";
  const requestedSubmissionId = searchParams.get("submissionId") || "";
  const backTarget = searchParams.get("back") || "/student/submissions";

  const { data: existingSubmission } = useAsyncData(
    () => requestedSubmissionId ? studentService.getSubmissionDetail(requestedSubmissionId) : Promise.resolve(null),
    [requestedSubmissionId],
  );

  const selectedActivity = useMemo(() => {
    const entries = data?.activities?.[subject] ?? [];
    if (requestedActivityId) {
      const byId = entries.find((item) => String(item.id) === String(requestedActivityId));
      if (byId) return byId;
    }
    if (activity) {
      const byTitle = entries.find((item) => item.title === activity);
      if (byTitle) return byTitle;
    }
    return undefined;
  }, [activity, data, requestedActivityId, subject]);

  const selectedContext = selectedActivity?.submissionContext;
  const isEditingExistingSubmission = Boolean(requestedSubmissionId);
  const isLocked = selectedActivity?.canSubmit === false;
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
      : entries.find((item) => item.title === requestedActivity);
    if (nextActivity) {
      setActivity((current) => current || nextActivity.title);
    }
  }, [data, subject, requestedActivity, requestedActivityId]);

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
      activity,
      title,
      description: desc,
      notes,
      externalLinks: links.map((item) => item.trim()).filter(Boolean),
      fileName: file?.name ?? null,
    };
    localStorage.setItem("student-submit-draft", JSON.stringify(payload));
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
        activityId: selectedActivity?.id,
        activityTitle: selectedActivity?.title || activity,
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
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-emerald-600" /></div>
      <h2 className="text-slate-900 font-bold text-xl mb-2">Submission Successful!</h2>
      <p className="text-slate-500 text-sm mb-6">Your submission has been saved in the official student workflow and is ready for teacher review.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate(`/student/submissions/${encodeURIComponent(submittedRecordId)}?back=${encodeURIComponent(backTarget)}`)} className="px-5 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900">Open Submission</button>
        <button onClick={() => navigate(backTarget)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">{backLabel}</button>
      </div>
    </div>;
  }

  return <div className="p-6 max-w-4xl mx-auto space-y-6">
    <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> {backLabel}</button>

    <div>
      <h1 className="text-slate-900 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>{isEditingExistingSubmission ? "Continue Submission" : "Submit Project"}</h1>
      <p className="text-slate-400 text-sm mt-0.5">Use the correct student submission flow for the selected activity.</p>
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {draftSaved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Draft saved locally.</div>}

    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Subject</label>
          <select value={subject} onChange={(e) => { setSubject(e.target.value); setActivity(""); }} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400">
            <option value="">Select subject</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Activity</label>
          <select value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400" disabled={!subject}>
            <option value="">Select activity</option>
            {(data?.activities?.[subject] ?? []).map((item) => <option key={item.id || item.title} value={item.title}>{item.title}</option>)}
          </select>
        </div>
      </div>

      {selectedActivity && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800">{selectedActivity.title}</p>
            <p className="text-xs text-slate-500 mt-1">Due {selectedActivity.due}</p>
          </div>
          <div className="flex flex-wrap gap-2">{selectedActivity.type === "group" ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"><Users size={12} /> Group</span> : <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><FileText size={12} /> Individual</span>}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-sm text-slate-600">
          <div><span className="font-semibold text-slate-700">Access:</span> {selectedContext?.accessLabel || (selectedActivity.canSubmit ? "Can submit now" : "Unavailable")}</div>
          <div><span className="font-semibold text-slate-700">Status:</span> {existingSubmission?.status || (selectedActivity.canSubmit ? "Open" : "Locked")}</div>
        </div>

        {selectedContext?.availabilityMessage && <p className="text-sm text-slate-600">{selectedContext.availabilityMessage}</p>}
        {selectedActivity.type === "group" && !selectedContext?.group && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">You must join or create the correct subject group before submitting this activity.</div>}
        {selectedActivity.type === "group" && selectedContext?.group && <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600"><p><span className="font-semibold text-slate-700">Group:</span> {selectedContext.group.name}</p><p><span className="font-semibold text-slate-700">Leader:</span> {selectedContext.group.leader || "—"}</p>{selectedContext.group.members?.length ? <p><span className="font-semibold text-slate-700">Members:</span> {selectedContext.group.members.join(", ")}</p> : null}</div>}
        {isLocked && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700 inline-flex items-center gap-2"><Lock size={14} /> This activity is not currently open for editing or submission.</div>}
      </div>}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Submission Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a clear submission title" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400" required />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Describe the work you are submitting" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 resize-none" required />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add optional notes for your teacher" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 resize-none" />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">External Links</label>
        <div className="space-y-2">
          {links.map((link, index) => <div key={index} className="flex items-center gap-2"><input value={link} onChange={(e) => setLinks((current) => current.map((item, i) => i === index ? e.target.value : item))} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400" />{links.length > 1 && <button type="button" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={14} /></button>}</div>)}
          <button type="button" onClick={() => setLinks((current) => [...current, ""])} className="text-sm font-semibold text-blue-700 hover:underline">Add another link</button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Upload File</label>
        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50">
          <Upload size={16} />
          <span>{file ? file.name : "Choose a file to upload"}</span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      {selectedActivity?.rules?.length ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Submission Rules</p><div className="space-y-1 text-sm text-blue-800">{selectedActivity.rules.map((rule: string) => <p key={rule}>• {rule}</p>)}</div></div> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" onClick={handleSaveDraft} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">Save Draft</button>
        <button type="submit" disabled={submitting || isLocked || !selectedActivity || !subject || !activity || !title.trim() || !desc.trim()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? <><AlertCircle size={14} /> Saving...</> : isEditingExistingSubmission ? "Save Submission" : "Submit Project"}</button>
      </div>
    </form>
  </div>;
}
''')

# Rewrite MySubmissions with better deep link/open behavior
(root / 'src/app/pages/student/MySubmissions.tsx').write_text('''import { useEffect, useMemo, useState } from "react";
import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Search, X, FileText, ChevronDown, Users, ChevronLeft, ExternalLink } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function StudentMySubmissions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSubmissions = useMemo(() => () => studentService.getSubmissions({ search, status: statusFilter }), [search, statusFilter]);
  const { data, loading, error } = useAsyncData(fetchSubmissions, [fetchSubmissions]);
  const submissions = data ?? [];
  const statuses = ["All", "Pending", "Submitted", "Late", "Reviewed", "Graded", "Draft", "Needs Revision", "Reopened"];
  const backTarget = searchParams.get("back");

  useEffect(() => {
    if (submissions.length === 0) return;
    const openId = searchParams.get("openId");
    const openActivityId = searchParams.get("activityId");
    const openTitle = searchParams.get("openTitle");
    const match = openId
      ? submissions.find((item) => String(item.id) === String(openId))
      : openActivityId
        ? submissions.find((item) => String(item.activityId || "") === String(openActivityId))
        : openTitle
          ? submissions.find((item) => item.title === openTitle || item.activityTitle === openTitle)
          : null;

    if (match) {
      setExpandedId(String(match.id));
      const suggested = String(match.status || "").trim();
      if (suggested && statuses.includes(suggested)) setStatusFilter(suggested);
      if (!search) setSearch(match.title || match.activityTitle || "");
    }
  }, [search, searchParams, submissions]);

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    {backTarget && <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm"><ChevronLeft size={15} /> Back to Activities</button>}
    <div>
      <h1 className="text-slate-900 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>My Submissions</h1>
      <p className="text-slate-400 text-sm mt-0.5">Track all your project and activity submissions.</p>
    </div>

    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white flex-1 min-w-[200px]"><Search size={14} className="text-slate-400 shrink-0" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search submissions…" className="text-sm text-slate-700 placeholder-slate-400 outline-none flex-1" />{search && <button onClick={() => setSearch("")}><X size={13} className="text-slate-400 hover:text-slate-600" /></button>}</div>
      <div className="flex gap-1.5 flex-wrap">{statuses.map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? "bg-blue-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{s}</button>)}</div>
    </div>

    {loading && <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-sm text-slate-500">Loading submissions…</div>}
    {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>}

    {!loading && !error && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-50 border-b border-slate-100">{["Title", "Subject", "Type", "Due Date", "Submitted", "Status", "Grade", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-50">
          {submissions.map((s) => <React.Fragment key={s.id}>
            <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${expandedId === String(s.id) ? "bg-slate-50" : ""}`} onClick={() => setExpandedId(expandedId === String(s.id) ? null : String(s.id))}>
              <td className="px-4 py-3.5"><p className="text-slate-800 font-semibold text-xs">{s.title}</p></td>
              <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{s.subject}</td>
              <td className="px-4 py-3.5 text-slate-500 text-xs">{s.type}</td>
              <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{s.due}</td>
              <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{s.submitted}</td>
              <td className="px-4 py-3.5"><StatusChip status={s.status} size="xs" /></td>
              <td className="px-4 py-3.5 text-emerald-600 font-bold text-xs">{s.grade !== "—" ? `${s.grade}/100` : "—"}</td>
              <td className="px-4 py-3.5"><ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === String(s.id) ? "rotate-180" : ""}`} /></td>
            </tr>
            {expandedId === String(s.id) && <tr className="bg-slate-50 border-b border-slate-100"><td colSpan={8} className="px-4 py-4"><div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="flex items-start gap-3"><div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><FileText size={13} className="text-blue-700" /></div><div><p className="text-slate-700 text-xs font-bold mb-1">Teacher Feedback</p>{s.feedback ? <p className="text-slate-600 text-xs leading-relaxed">{s.feedback}</p> : <p className="text-slate-400 text-xs italic">No feedback yet. Check back after your teacher reviews this submission.</p>}{s.files && s.files.length > 0 && <div className="mt-3 space-y-1"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Files</p>{s.files.map((file) => { const [label, href] = file.split("|||"); return <div key={file} className="text-xs text-slate-500"> • {href ? <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{label}</a> : label} </div>; })}</div>}{!!s.externalLinks?.length && <div className="mt-3 space-y-1"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">External Links</p>{s.externalLinks.map((link) => <div key={link} className="text-xs text-slate-500 break-all">• <a href={link} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{link}</a></div>)}</div>}<div className="mt-4"><button onClick={(e) => { e.stopPropagation(); const detailBack = backTarget || `${location.pathname}${location.search}`; navigate(`/student/submissions/${encodeURIComponent(String(s.id))}?back=${encodeURIComponent(detailBack)}`); }} className="inline-flex items-center gap-1.5 text-blue-700 text-xs font-semibold hover:underline"><ExternalLink size={13} /> Open full submission view</button></div></div></div>{s.type === "Group" && <div className="flex items-start gap-3 lg:col-span-2"><div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0"><Users size={13} className="text-teal-700" /></div><div><p className="text-slate-700 text-xs font-bold mb-1">Group Details</p><p className="text-slate-600 text-xs"><span className="font-semibold">Group:</span> {s.groupName}</p><p className="text-slate-600 text-xs mt-1"><span className="font-semibold">Leader:</span> {s.leader}</p><p className="text-slate-600 text-xs mt-1"><span className="font-semibold">Submitted By:</span> {s.submittedBy}</p><div className="mt-3 space-y-1"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Members</p>{s.members?.map((member) => <div key={member} className="text-xs text-slate-500">• {member}</div>)}</div></div></div>}</div></td></tr>}
          </React.Fragment>)}
        </tbody>
      </table>
      {submissions.length === 0 && <div className="py-12 text-center"><FileText size={32} className="mx-auto text-slate-300 mb-2" /><p className="text-slate-500 text-sm font-medium">No submissions found</p><p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter.</p></div>}
    </div>}

    <p className="text-slate-400 text-xs">Showing {submissions.length} submissions in the current filtered view. Click any row to view details.</p>
  </div>;
}
''')

# Update calendar CTA flow to preserve subject/activity ids and back path
calendar = root / 'src/app/pages/student/Calendar.tsx'
text = calendar.read_text()
old = ' <button onClick={() => navigate(activeSelected?.status === "Submitted" && activeSelected?.submissionId ? `/student/submissions/${encodeURIComponent(String(activeSelected.submissionId))}` : `/student/submit${activeSelected?.subject ? `?subject=${encodeURIComponent(activeSelected.subject)}` : ""}${activeSelected?.title ? `${activeSelected?.subject ? "&" : "?"}activity=${encodeURIComponent(activeSelected.title)}` : ""}`)} className="mt-4 w-full px-4 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900">{activeSelected.status === "Submitted" ? "View Submission" : activeSelected.status === "Draft" ? "Continue Submission" : "Open Submission"}</button> '
new = ' <button onClick={() => navigate(activeSelected?.submissionId && ["Submitted", "Late", "Reviewed", "Graded"].includes(activeSelected.status) ? `/student/submissions/${encodeURIComponent(String(activeSelected.submissionId))}?back=${encodeURIComponent(`/student/calendar`)}` : `/student/submit?subject=${encodeURIComponent(activeSelected?.subject || "")}${activeSelected?.subjectId ? `&subjectId=${encodeURIComponent(String(activeSelected.subjectId))}` : ""}${activeSelected?.title ? `&activity=${encodeURIComponent(activeSelected.title)}` : ""}${activeSelected?.activityId ? `&activityId=${encodeURIComponent(String(activeSelected.activityId))}` : ""}&back=${encodeURIComponent(`/student/calendar`)}`)} className="mt-4 w-full px-4 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900">{["Submitted", "Late", "Reviewed", "Graded"].includes(activeSelected.status) ? "View Submission" : activeSelected.status === "Draft" ? "Continue Submission" : "Open Submission"}</button> '
if old in text:
    text = text.replace(old, new)
calendar.write_text(text)

print('patched pass9 files')
