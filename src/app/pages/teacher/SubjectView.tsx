import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Bell,
  BookOpen,
  ChevronLeft,
  Clock,
  FileEdit,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { AppModal } from "../../components/ui/app-modal";
import { StatusChip } from "../../components/ui/StatusChip";
import { teacherSubjectService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { summarizeClassroomNotification } from "../../lib/mailActionSafety";
import type { TeacherSubjectGroupItem, TeacherSubjectSubmissionItem } from "../../lib/api/contracts";

function toDateInputValue(value?: string) {
  if (!value) return "";
  const direct = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(direct)) return direct.slice(0, 10);
  const parsed = new Date(direct);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

const tabs = ["Overview", "Submissions", "Students", "Groups", "Restrictions", "Announcements", "Activity Log"] as const;

type TabKey = (typeof tabs)[number];

type ActivityFormState = {
  title: string;
  instructions: string;
  deadline: string;
  openAt: string;
  closeAt: string;
  submissionMode: "INDIVIDUAL" | "GROUP";
  allowLateSubmission: boolean;
  acceptedFileTypesText: string;
  maxFileSizeMb: number;
  externalLinksAllowed: boolean;
  notifyByEmail: boolean;
};

const defaultActivityForm: ActivityFormState = {
  title: "",
  instructions: "",
  deadline: "",
  openAt: "",
  closeAt: "",
  submissionMode: "INDIVIDUAL",
  allowLateSubmission: false,
  acceptedFileTypesText: "pdf",
  maxFileSizeMb: 10,
  externalLinksAllowed: true,
  notifyByEmail: false,
};

const teacherModalFieldClassName =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

const teacherModalToggleClassName =
  "flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200";

export default function TeacherSubjectView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const subjectId = id ?? "";
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get("back") || "/teacher/subjects";
  const requestedTab = searchParams.get("tab");
  const initialTab = tabs.includes(requestedTab as TabKey) ? (requestedTab as TabKey) : "Overview";

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [banner, setBanner] = useState<string | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(defaultActivityForm);
  const [notifyForm, setNotifyForm] = useState({ title: "", message: "" });

  const { data, loading, error, reload } = useAsyncData(
    () => (subjectId ? teacherSubjectService.getSubject(subjectId) : Promise.reject(new Error("Subject ID is required."))),
    [subjectId],
  );

  const showBanner = (message: string) => {
    setBanner(message);
    window.setTimeout(() => setBanner(null), 2800);
  };

  useEffect(() => {
    if (tabs.includes(requestedTab as TabKey)) {
      setTab(requestedTab as TabKey);
    }
  }, [requestedTab]);

  const openCreateModal = () => {
    setEditingActivityId(null);
    setActivityForm(defaultActivityForm);
    setActivityModalOpen(true);
  };

  const openEditModal = (item: TeacherSubjectSubmissionItem) => {
    setEditingActivityId(item.id ?? null);
    setActivityForm({
      title: item.title,
      instructions: item.instructions || "",
      deadline: toDateInputValue(item.closeAt || item.openAt || item.due),
      openAt: toDateInputValue(item.openAt),
      closeAt: toDateInputValue(item.closeAt),
      submissionMode: item.mode === "Group" ? "GROUP" : "INDIVIDUAL",
      allowLateSubmission: item.allowLateSubmission ?? item.window === "Reopened",
      acceptedFileTypesText: (item.acceptedFileTypes || []).join(", ") || "pdf",
      maxFileSizeMb: item.maxFileSizeMb || 10,
      externalLinksAllowed: item.externalLinksAllowed !== false,
      notifyByEmail: Boolean(item.notifyByEmail),
    });
    setActivityModalOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!subjectId) {
      showBanner("Subject is missing.");
      return;
    }
    if (!activityForm.title.trim() || !activityForm.deadline) {
      showBanner("Add a title and deadline before saving the activity.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...activityForm,
        acceptedFileTypes: activityForm.acceptedFileTypesText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };

      if (editingActivityId) {
        await teacherSubjectService.updateActivity(subjectId, editingActivityId, payload);
        showBanner("Submission activity updated.");
      } else {
        const result = await teacherSubjectService.createActivity(subjectId, payload);
        showBanner(
          activityForm.notifyByEmail
            ? `Submission activity created. ${summarizeClassroomNotification(result)}`
            : "Submission activity created and in-app notifications were created.",
        );
      }

      setActivityModalOpen(false);
      setTab("Submissions");
      reload();
    } catch (err) {
      showBanner(err instanceof Error ? err.message : "Unable to save the activity.");
    } finally {
      setSaving(false);
    }
  };

  const handleNotifyStudents = async () => {
    if (!subjectId) {
      showBanner("Subject is missing.");
      return;
    }
    if (!notifyForm.title.trim() || !notifyForm.message.trim()) {
      showBanner("Add a title and message before notifying students.");
      return;
    }

    setSaving(true);
    try {
      const result = await teacherSubjectService.notifyStudents(subjectId, notifyForm);
      setNotifyModalOpen(false);
      setNotifyForm({ title: "", message: "" });
      showBanner(`Students notification completed. ${summarizeClassroomNotification(result)}`);
    } catch (err) {
      showBanner(err instanceof Error ? err.message : "Unable to notify students.");
    } finally {
      setSaving(false);
    }
  };

  const handleReopenSubject = async () => {
    if (!subjectId) {
      showBanner("Subject is missing.");
      return;
    }

    setSaving(true);
    try {
      const result = await teacherSubjectService.reopenSubject(subjectId);
      setTab("Submissions");
      showBanner(`Subject reopened. ${summarizeClassroomNotification(result)}`);
      reload();
    } catch (err) {
      showBanner(err instanceof Error ? err.message : "Unable to reopen the subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleReopenActivity = async (activityId?: string) => {
    if (!subjectId || !activityId) return;

    setSaving(true);
    try {
      const result = await teacherSubjectService.reopenActivity(subjectId, activityId);
      showBanner(`Submission activity reopened. ${summarizeClassroomNotification(result)}`);
      reload();
    } catch (err) {
      showBanner(err instanceof Error ? err.message : "Unable to reopen the activity.");
    } finally {
      setSaving(false);
    }
  };

  const runGroupAction = async (groupId: string, action: () => Promise<unknown>, successMessage: string) => {
    setGroupBusyId(groupId);
    try {
      await action();
      await reload();
      showBanner(successMessage);
    } catch (err) {
      showBanner(err instanceof Error ? err.message : "Unable to update this group.");
    } finally {
      setGroupBusyId(null);
    }
  };

  const subjectNameForLink = data?.name ?? "All Subjects";
  const activeOverview = useMemo(() => data?.overview ?? [], [data]);
  const backLabel = backTarget.includes("/teacher/dashboard")
    ? "Back to Dashboard"
    : backTarget.includes("/teacher/submissions")
      ? "Back to Submissions"
      : "Back to Subjects";
  const subjectBackLink = `/teacher/subjects/${encodeURIComponent(subjectId)}?tab=${encodeURIComponent(tab)}&back=${encodeURIComponent(backTarget)}`;
  const viewSubmissionsTarget = `/teacher/submissions?subject=${encodeURIComponent(subjectNameForLink)}&subjectId=${encodeURIComponent(subjectId)}&back=${encodeURIComponent(subjectBackLink)}`;

  if (!data && loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 max-w-7xl mx-auto text-sm text-rose-600">{error || "Unable to load this subject."}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <button onClick={() => navigate(backTarget)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm transition-colors">
        <ChevronLeft size={15} /> {backLabel}
      </button>

      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-700 flex items-center justify-center shrink-0">
            <BookOpen size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold px-2 py-0.5 rounded-full uppercase">{data.code}</span>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">{data.status}</span>
            </div>
            <h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
              {data.name}
            </h1>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Users size={13} /> {data.section} · {data.studentsCount} students
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} /> {data.term}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800">
            <Plus size={14} /> Add Submission
          </button>
          <button onClick={() => setTab("Restrictions")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <Shield size={14} /> Update Restrictions
          </button>
          <button onClick={handleReopenSubject} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60">
            <RefreshCw size={14} /> Reopen Subject
          </button>
          <button onClick={() => setNotifyModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <Bell size={14} /> Notify Students
          </button>
          <button onClick={() => navigate(viewSubmissionsTarget)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <FileEdit size={14} /> View Submissions
          </button>
        </div>
      </div>

      {banner && <div className="rounded-xl border border-teal-200 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 text-xs font-medium text-teal-700 dark:text-teal-300">{banner}</div>}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === item ? "border-teal-700 text-teal-700 dark:text-teal-300" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeOverview.map((item) => (
            <div key={item.l} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
              <p className="text-slate-400 dark:text-slate-300 text-xs">{item.l}</p>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-2xl mt-1">{item.v}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "Submissions" && (
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-700/70">
                {["Activity", "Mode", "Due Date", "Window", "Status", "Progress", "Action"].map((heading) => (
                  <th key={heading} className="text-left px-5 py-3 text-[11px] text-slate-400 dark:text-slate-300 font-semibold uppercase">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
              {data.submissions.map((submission) => (
                <tr key={submission.id || submission.title} className="hover:bg-slate-50 dark:hover:bg-slate-800/70">
                  <td className="px-5 py-3.5">
                    <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs">{submission.title}</p>
                    <p className="text-slate-400 dark:text-slate-300 text-[10px] mt-1">
                      {submission.submitted}/{submission.total} submitted · {submission.late > 0 ? `${submission.late} late` : "No late submissions"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{submission.mode}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{submission.due}</td>
                  <td className="px-5 py-3.5">
                    <StatusChip status={submission.window} size="xs" />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusChip status={submission.status} size="xs" />
                  </td>
                  <td className="px-5 py-3.5 w-36">
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${submission.total ? (submission.submitted / submission.total) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openEditModal(submission)} className="text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline">
                        Edit
                      </button>
                      <button onClick={() => (submission.window === "Reopened" ? setNotifyModalOpen(true) : handleReopenActivity(submission.id))} className="text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline">
                        {submission.window === "Reopened" ? "Notify" : "Reopen"}
                      </button>
                      <button onClick={() => navigate(viewSubmissionsTarget)} className="text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline">
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Students" && (
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-700/70">
                {["Student", "ID", "Status", "Submitted", "Graded"].map((heading) => (
                  <th key={heading} className="text-left px-5 py-3 text-[11px] text-slate-400 dark:text-slate-300 font-semibold uppercase">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
              {data.students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70">
                  <td className="px-5 py-3.5 text-slate-800 dark:text-slate-100 font-semibold text-xs">{student.name}</td>
                  <td className="px-5 py-3.5 text-slate-400 dark:text-slate-300 text-xs">{student.id}</td>
                  <td className="px-5 py-3.5">
                    <StatusChip status={student.status} size="xs" />
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 font-bold text-xs">{student.submitted}</td>
                  <td className="px-5 py-3.5 text-emerald-600 font-bold text-xs">{student.graded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Groups" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
              <p className="text-slate-400 dark:text-slate-300 text-xs">Groups</p>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-2xl mt-1">{data.groups.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
              <p className="text-slate-400 dark:text-slate-300 text-xs">Active</p>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-2xl mt-1">
                {data.groups.filter((group) => group.status === "Active").length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
              <p className="text-slate-400 dark:text-slate-300 text-xs">Pending Review</p>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-2xl mt-1">
                {data.groups.filter((group) => group.status === "Pending Review").length}
              </p>
            </div>
          </div>

          {data.groups.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-400 dark:text-slate-300">
              No student groups have been formed for this subject yet.
            </div>
          ) : (
            data.groups.map((group) => {
              const groupLocked = group.status === "Locked";
              const pendingReview = group.status === "Pending Review";
              return (
                <div key={group.id} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-slate-900 dark:text-slate-100 font-bold text-lg">{group.name}</span>
                        <StatusChip status={group.status} size="xs" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Invite code <span className="font-semibold text-slate-700 dark:text-slate-200">{group.code}</span> · {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.section}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={groupBusyId === group.id || !pendingReview}
                        onClick={() => runGroupAction(group.id, () => teacherSubjectService.approveGroup(subjectId, group.id), "Group approved.")}
                        className="px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={groupBusyId === group.id || groupLocked}
                        onClick={() => runGroupAction(group.id, () => teacherSubjectService.lockGroup(subjectId, group.id), "Group locked.")}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                      >
                        Lock
                      </button>
                      <button
                        type="button"
                        disabled={groupBusyId === group.id || !groupLocked}
                        onClick={() => runGroupAction(group.id, () => teacherSubjectService.unlockGroup(subjectId, group.id), "Group unlocked.")}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                      >
                        Unlock
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(viewSubmissionsTarget)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      >
                        Open Submissions
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[0.9fr,1.1fr] gap-4">
                    <div className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/70 p-4 space-y-3">
                      <div>
                        <p className="text-slate-400 dark:text-slate-300 text-[11px] font-semibold uppercase tracking-wide">Teacher Control</p>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mt-2">
                          Approve pending groups, lock or unlock collaboration, reassign leadership, and remove members directly from this subject workspace.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-3 py-3">
                          <p className="text-slate-400 dark:text-slate-300 text-[11px] uppercase tracking-wide">Leader</p>
                          <p className="text-slate-800 dark:text-slate-100 font-semibold mt-1">{group.leader}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-3 py-3">
                          <p className="text-slate-400 dark:text-slate-300 text-[11px] uppercase tracking-wide">Section</p>
                          <p className="text-slate-800 dark:text-slate-100 font-semibold mt-1">{group.section}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-900/85 p-4">
                      <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">Members</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.memberDetails.map((member) => (
                          <GroupMemberCard
                            key={member.id}
                            group={group}
                            member={member}
                            busy={groupBusyId === group.id}
                            subjectId={subjectId}
                            onAction={(action, successMessage) => runGroupAction(group.id, action, successMessage)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "Restrictions" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5 space-y-4">
            <h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold">Current Subject Restrictions</h2>
            {data.rules.map((rule) => (
              <div key={rule.label} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700/70 last:border-b-0">
                <div>
                  <p className="text-slate-800 dark:text-slate-100 text-sm font-semibold">{rule.label}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{rule.value}</p>
                </div>
                <button onClick={() => setNotifyModalOpen(true)} className="text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline">
                  Notify
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-teal-50 dark:bg-teal-500/15 border border-teal-100 rounded-xl p-5">
              <h3 className="text-teal-800 dark:text-teal-200 text-sm font-bold mb-2">Notification behavior</h3>
              <p className="text-teal-700 dark:text-teal-300 text-xs leading-relaxed">
                New submission activities can now carry real delivery settings such as open and close windows, accepted
                file types, link permissions, and optional queued email delivery.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={15} className="text-slate-500 dark:text-slate-400" />
                <h3 className="text-slate-800 dark:text-slate-100 text-sm font-bold">Teacher authority</h3>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                Manage activities for this subject directly from this page. Add new work, reopen tasks, and notify
                students without leaving the subject workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "Announcements" && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr,1.1fr] gap-6">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-teal-700 dark:text-teal-300" />
              <h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold">Post Update</h2>
            </div>
            <input
              value={notifyForm.title}
              onChange={(e) => setNotifyForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Announcement title"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm outline-none"
            />
            <textarea
              rows={5}
              value={notifyForm.message}
              onChange={(e) => setNotifyForm((current) => ({ ...current, message: e.target.value }))}
              placeholder="Write an update for students…"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm outline-none resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={handleNotifyStudents} disabled={saving || !notifyForm.title.trim() || !notifyForm.message.trim()} className="px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? "Posting..." : "Post & Notify"}
              </button>
              <button onClick={() => setNotifyForm({ title: "", message: "" })} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60">
                Clear Draft
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <h3 className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">What students will receive</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              A subject notification will be created for every enrolled student. This keeps your communication inside
              the official workflow and matches the subject activity history.
            </p>
          </div>
        </div>
      )}

      {tab === "Activity Log" && (
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Recent teacher actions for this subject appear here when activity history is available.</p>
        </div>
      )}

      <AppModal
        open={activityModalOpen}
        onOpenChange={setActivityModalOpen}
        title={editingActivityId ? "Edit Submission" : "Add Submission"}
        description="Set the availability window, submission mode, and optional email delivery rules for this activity."
        size="xl"
        footer={
          <>
            <button
              onClick={() => setActivityModalOpen(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button onClick={handleSaveActivity} disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60">
              {editingActivityId ? "Save Changes" : "Create Submission"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <input
            id="teacher-activity-title"
            value={activityForm.title}
            onChange={(e) => setActivityForm((current) => ({ ...current, title: e.target.value }))}
            placeholder="Submission title"
            className={teacherModalFieldClassName}
            aria-label="Submission title"
          />
          <textarea
            id="teacher-activity-instructions"
            value={activityForm.instructions}
            onChange={(e) => setActivityForm((current) => ({ ...current, instructions: e.target.value }))}
            rows={4}
            placeholder="Instructions"
            className={`${teacherModalFieldClassName} resize-none`}
            aria-label="Submission instructions"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-open-at" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Open date</label>
              <input
                id="teacher-activity-open-at"
                type="date"
                value={activityForm.openAt}
                onChange={(e) => setActivityForm((current) => ({ ...current, openAt: e.target.value }))}
                className={teacherModalFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-deadline" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Deadline</label>
              <input
                id="teacher-activity-deadline"
                type="date"
                value={activityForm.deadline}
                onChange={(e) => setActivityForm((current) => ({ ...current, deadline: e.target.value }))}
                className={teacherModalFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-close-at" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Close date</label>
              <input
                id="teacher-activity-close-at"
                type="date"
                value={activityForm.closeAt}
                onChange={(e) => setActivityForm((current) => ({ ...current, closeAt: e.target.value }))}
                className={teacherModalFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-submission-mode" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Submission mode</label>
              <select
                id="teacher-activity-submission-mode"
                value={activityForm.submissionMode}
                onChange={(e) => setActivityForm((current) => ({ ...current, submissionMode: e.target.value as ActivityFormState["submissionMode"] }))}
                className={teacherModalFieldClassName}
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Group</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,120px]">
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-file-types" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Accepted file types</label>
              <input
                id="teacher-activity-file-types"
                value={activityForm.acceptedFileTypesText}
                onChange={(e) => setActivityForm((current) => ({ ...current, acceptedFileTypesText: e.target.value }))}
                placeholder="pdf, docx, pptx"
                className={teacherModalFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="teacher-activity-max-size" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300 dark:text-slate-500">Max MB</label>
              <input
                id="teacher-activity-max-size"
                type="number"
                min={1}
                value={activityForm.maxFileSizeMb}
                onChange={(e) => setActivityForm((current) => ({ ...current, maxFileSizeMb: Number(e.target.value || 10) }))}
                className={teacherModalFieldClassName}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={teacherModalToggleClassName}>
              <input
                type="checkbox"
                checked={activityForm.allowLateSubmission}
                onChange={(e) => setActivityForm((current) => ({ ...current, allowLateSubmission: e.target.checked }))}
              />
              Allow late submission
            </label>
            <label className={teacherModalToggleClassName}>
              <input
                type="checkbox"
                checked={activityForm.externalLinksAllowed}
                onChange={(e) => setActivityForm((current) => ({ ...current, externalLinksAllowed: e.target.checked }))}
              />
              Allow external links
            </label>
            <label className={`${teacherModalToggleClassName} sm:col-span-2`}>
              <input
                type="checkbox"
                checked={activityForm.notifyByEmail}
                onChange={(e) => setActivityForm((current) => ({ ...current, notifyByEmail: e.target.checked }))}
              />
              Queue email alerts in addition to in-app notifications
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            Students still receive in-app notifications automatically. Email jobs are queued only when the extra
            delivery option is turned on.
          </div>
        </div>
      </AppModal>

      <AppModal
        open={notifyModalOpen}
        onOpenChange={setNotifyModalOpen}
        title="Notify Students"
        description="Send a focused update to every enrolled student for this subject."
        size="lg"
        footer={
          <>
            <button
              onClick={() => setNotifyModalOpen(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button onClick={handleNotifyStudents} disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60">
              Send Notification
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            id="teacher-notify-title"
            value={notifyForm.title}
            onChange={(e) => setNotifyForm((current) => ({ ...current, title: e.target.value }))}
            placeholder="Notification title"
            className={teacherModalFieldClassName}
            aria-label="Notification title"
          />
          <textarea
            id="teacher-notify-message"
            rows={4}
            value={notifyForm.message}
            onChange={(e) => setNotifyForm((current) => ({ ...current, message: e.target.value }))}
            placeholder="What should students know?"
            className={`${teacherModalFieldClassName} resize-none`}
            aria-label="Notification message"
          />
        </div>
      </AppModal>
    </div>
  );
}

function GroupMemberCard({
  group,
  member,
  busy,
  subjectId,
  onAction,
}: {
  group: TeacherSubjectGroupItem;
  member: TeacherSubjectGroupItem["memberDetails"][number];
  busy: boolean;
  subjectId: string;
  onAction: (action: () => Promise<unknown>, successMessage: string) => void;
}) {
  const groupLocked = group.status === "Locked";

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/70 px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{member.name}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-300">{member.isLeader ? "Current leader" : "Member"}</p>
        </div>
        {member.isLeader ? (
          <span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-2 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300">Leader</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || member.isLeader || groupLocked}
          onClick={() =>
            onAction(
              () => teacherSubjectService.assignGroupLeader(subjectId, group.id, member.id),
              "Group leader updated.",
            )
          }
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-50"
        >
          Assign Leader
        </button>
        <button
          type="button"
          disabled={busy || group.memberDetails.length <= 1}
          onClick={() =>
            onAction(
              () => teacherSubjectService.removeGroupMember(subjectId, group.id, member.id),
              "Group member removed.",
            )
          }
          className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
