import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  FileText,
  Layers3,
  Lock,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalMetricCard,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import {
  studentGroupService,
  studentService,
  studentSubjectService,
} from "../../lib/api/services";
import {
  isEditableSubmissionStatus,
  isViewOnlySubmissionStatus,
  normalizeSubmissionStatus,
} from "../../lib/submissionRules";

const allTabs = ["Overview", "Activities", "My Group"] as const;
type SubjectTab = (typeof allTabs)[number];

const tabParamMap: Record<string, SubjectTab> = {
  overview: "Overview",
  activities: "Activities",
  group: "My Group",
};

const reverseTabParamMap: Record<SubjectTab, string> = {
  Overview: "overview",
  Activities: "activities",
  "My Group": "group",
};

function normalizeWindow(value?: string) {
  return String(value || "").trim().toUpperCase();
}

function hasDisplayValue(value?: string | null) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && normalized !== "—";
}

function statusBadgeClass(status?: string) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25";
  }
  if (normalized === "INACTIVE") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/25";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700/70";
}

function describeStudentProgress(activityStatus?: string, matchedSubmission?: any) {
  const status = String(matchedSubmission?.status || activityStatus || "Draft").trim() || "Draft";
  const canonical = normalizeSubmissionStatus(status);
  const submittedLabel = hasDisplayValue(matchedSubmission?.submitted)
    ? String(matchedSubmission.submitted).trim()
    : "";
  const gradeLabel = hasDisplayValue(matchedSubmission?.grade)
    ? String(matchedSubmission.grade).trim()
    : "";

  if (canonical === "GRADED") {
    return {
      status,
      detail: gradeLabel
        ? `Grade released: ${gradeLabel}`
        : "Your score has been released.",
    };
  }

  if (canonical === "REVIEWED") {
    return {
      status,
      detail: "Feedback is ready for you to review.",
    };
  }

  if (canonical === "NEEDS_REVISION") {
    return {
      status,
      detail: "Revision requested. Update your work and resubmit.",
    };
  }

  if (canonical === "REOPENED") {
    return {
      status,
      detail: "Submission reopened. You can upload an updated version.",
    };
  }

  if (canonical === "SUBMITTED") {
    return {
      status,
      detail: submittedLabel ? `Submitted ${submittedLabel}` : "Submission received.",
    };
  }

  if (canonical === "LATE") {
    return {
      status,
      detail: submittedLabel
        ? `Submitted ${submittedLabel}`
        : "Submitted after the deadline.",
    };
  }

  if (matchedSubmission) {
    return {
      status,
      detail: submittedLabel
        ? `Draft saved ${submittedLabel}`
        : "Draft saved. You can continue before the deadline.",
    };
  }

  return {
    status: "Draft",
    detail: "Not submitted yet.",
  };
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
  const submissionStatus = normalizeSubmissionStatus(
    matchedSubmission?.status || activity.status,
  );
  const windowStatus = normalizeWindow(activity.window);
  const actionLabel = String(activity.action || "").trim();

  if (
    matchedSubmission &&
    (isEditableSubmissionStatus(submissionStatus) ||
      actionLabel === "Continue" ||
      actionLabel === "Resubmit")
  ) {
    return {
      disabled: false,
      label: actionLabel || "Continue",
      target: `/student/submit?subject=${encodeURIComponent(subjectName)}&subjectId=${encodeURIComponent(subjectId)}&activity=${encodeURIComponent(matchedSubmission.activityTitle || activity.title)}&activityId=${encodeURIComponent(String(activity.id))}&submissionId=${encodeURIComponent(String(matchedSubmission.id))}&back=${encodeURIComponent(backTarget)}`,
    };
  }

  if (
    matchedSubmission &&
    (isViewOnlySubmissionStatus(submissionStatus) ||
      actionLabel === "View" ||
      actionLabel === "View Result")
  ) {
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
  const returnTarget = searchParams.get("back") || "/student/subjects";
  const [copied, setCopied] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupActionState, setGroupActionState] = useState<{
    saving: boolean;
    error: string | null;
    success: string | null;
  }>({ saving: false, error: null, success: null });

  const { data, loading, reload } = useAsyncData(
    () =>
      id
        ? studentSubjectService.getSubject(id)
        : Promise.reject(new Error("Subject id is required.")),
    [id],
  );
  const { data: submissionRowsData } = useAsyncData(
    () => studentService.getSubmissions(),
    [],
  );

  const submissionRows = submissionRowsData ?? [];
  const tabs: readonly SubjectTab[] = data?.groupEnabled
    ? allTabs
    : ["Overview", "Activities"];
  const tab = tabs.includes(requestedTab as SubjectTab) ? requestedTab : "Overview";
  const subjectPath = `/student/subjects/${encodeURIComponent(String(id || ""))}`;
  const returnToActivities = `${subjectPath}?tab=activities`;

  const copyCode = async () => {
    if (!data?.group?.code || data.group.code === "—") return;
    try {
      await navigator.clipboard.writeText(data.group.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      return;
    }
  };

  const handleTabChange = (nextTab: SubjectTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", reverseTabParamMap[nextTab] || "overview");
    setSearchParams(next, { replace: true });
  };

  const activityRows = useMemo(() => {
    if (!data || !id) return [];
    return data.activities.map((activity: any) => {
      const matchedSubmission = submissionRows.find(
        (item) =>
          String(item.activityId || "") === String(activity.id || "") ||
          (
            String(item.subjectId || "") === String(id) &&
            String(item.activityTitle || item.title || "").trim().toLowerCase() ===
              String(activity.title || "").trim().toLowerCase()
          ),
      );
      const progress = describeStudentProgress(activity.status, matchedSubmission);
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
        progressStatus: progress.status,
        progressDetail: progress.detail,
        disabled: action.disabled,
        target: action.target,
        label: action.label,
      };
    });
  }, [data, id, returnToActivities, submissionRows]);

  const overviewStats = (data?.overview ?? []).slice(0, 4);

  const handleCreateGroup = async () => {
    if (!id || !groupName.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.createGroup(id, groupName.trim());
      await reload();
      setGroupName("");
      setGroupActionState({
        saving: false,
        error: null,
        success: "Group created successfully.",
      });
    } catch (err) {
      setGroupActionState({
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to create the group right now.",
        success: null,
      });
    }
  };

  const handleJoinGroup = async () => {
    if (!id || !joinCode.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.joinGroup(id, joinCode.trim());
      await reload();
      setJoinCode("");
      setGroupActionState({
        saving: false,
        error: null,
        success: "Group joined successfully.",
      });
    } catch (err) {
      setGroupActionState({
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to join the group with that code.",
        success: null,
      });
    }
  };

  if (!data && loading) {
    return (
      <PortalPage>
        <div className="h-[420px] animate-pulse rounded-[32px] border border-white/70 bg-white/85" />
      </PortalPage>
    );
  }

  if (!data) return null;

  return (
    <PortalPage className="space-y-6">
      <button
        onClick={() => navigate(returnTarget)}
        className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronLeft size={15} />
        Back to Subjects
      </button>

      <PortalHero
        tone="blue"
        eyebrow="Subject Workspace"
        title={data.name}
        description="Everything you need for this course lives here: overview, activities, deadlines, and your group space."
        icon={BookOpen}
        meta={[
          { label: "Code", value: data.code },
          { label: "Teacher", value: data.teacher },
          { label: "Term", value: data.term },
          { label: "Status", value: "Active" },
        ]}
        stats={[
          {
            label: "Activities",
            value: String(data.activitiesCount),
            hint: "Assignments and project windows published here.",
          },
          {
            label: "Section",
            value: data.section || "—",
            hint: "Your assigned section for this subject.",
          },
          {
            label: "Group Mode",
            value: data.groupEnabled ? "Enabled" : "Individual",
            hint: data.groupEnabled
              ? "This subject supports collaboration."
              : "Submissions stay individual for this class.",
          },
          {
            label: "Members",
            value: String(data.members.length || 0),
            hint: "Visible classmates or active group members.",
          },
        ]}
        actions={
          <button
            onClick={() => handleTabChange("Activities")}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-lg shadow-slate-950/10 transition hover:bg-blue-50"
          >
            <Clock size={16} />
            Open Activities
          </button>
        }
      />

      <PortalPanel contentClassName="px-3 py-3 sm:px-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((entry) => (
            <button
              key={entry}
              onClick={() => handleTabChange(entry)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === entry
                  ? "bg-blue-700 text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {entry}
            </button>
          ))}
        </div>
      </PortalPanel>

      {tab === "Overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewStats.map((item, index) => (
              <PortalMetricCard
                key={`${item.label}-${index}`}
                label={item.label}
                value={item.value}
                hint="Updated from the live subject record."
                icon={
                  index === 0
                    ? Users
                    : index === 1
                      ? Layers3
                      : index === 2
                        ? BookOpen
                        : ShieldCheck
                }
                tone="blue"
              />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <PortalPanel
              title="Course Snapshot"
              description="A clearer overview of how this workspace is structured."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: "Assigned Teacher", value: data.teacher },
                  { label: "Section", value: data.section || "—" },
                  { label: "Term", value: data.term },
                  {
                    label: "Collaboration",
                    value: data.groupEnabled ? "Group-enabled" : "Individual only",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </PortalPanel>

            <PortalPanel
              title="Recent Signals"
              description="Latest subject-level changes and noteworthy events."
            >
              {data.recentActivity.length ? (
                <div className="space-y-3">
                  {data.recentActivity.map((entry) => (
                    <div
                      key={entry}
                      className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-300"
                    >
                      {entry}
                    </div>
                  ))}
                </div>
              ) : (
                <PortalEmptyState
                  title="No recent updates"
                  description="This subject has not recorded any recent activity yet."
                  icon={Clock}
                  className="border-slate-200 bg-slate-50/80"
                />
              )}
            </PortalPanel>
          </div>
        </div>
      ) : null}

      {tab === "Activities" ? (
        <PortalPanel
          title="Activity Stream"
          description="Browse each activity with its deadline, current window, your progress, and the next action available to you."
        >
          {activityRows.length ? (
            <div className="space-y-4">
              {activityRows.map((activity: any) => (
                <div
                  key={activity.id}
                  className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.32)] dark:border-slate-700/60 dark:bg-slate-800/75"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                            activity.type === "Group"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                          }`}
                        >
                          {activity.type === "Group" ? (
                            <Users size={12} />
                          ) : (
                            <FileText size={12} />
                          )}
                          {activity.type}
                        </span>
                        <StatusChip status={activity.window} size="xs" />
                        <StatusChip status={activity.progressStatus} size="xs" />
                      </div>
                      <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                        {activity.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Your progress: {activity.progressDetail}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[20px] border border-white/70 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Due Date
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {activity.due}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-white/70 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            File Types
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {activity.fileTypes}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-white/70 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Your Status
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusChip status={activity.progressStatus} size="xs" />
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {activity.progressDetail}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-white/70 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Timeline
                          </p>
                          <p
                            className={`mt-2 text-sm font-semibold ${
                              activity.daysLeft < 0
                                ? "text-rose-600"
                                : activity.daysLeft <= 5
                                  ? "text-amber-700"
                                  : "text-slate-800 dark:text-slate-100"
                            }`}
                          >
                            {activity.daysLeft < 0
                              ? `Overdue by ${Math.abs(activity.daysLeft)}d`
                              : `${activity.daysLeft}d left`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() =>
                          !activity.disabled &&
                          activity.target &&
                          navigate(activity.target)
                        }
                        disabled={activity.disabled}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          activity.disabled
                            ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                            : "bg-blue-700 text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)] hover:bg-blue-800"
                        }`}
                      >
                        {activity.label}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PortalEmptyState
              title="No activities published yet"
              description="This subject does not have any active tasks right now."
              icon={Clock}
            />
          )}
        </PortalPanel>
      ) : null}

      {tab === "My Group" ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {!data.group ? (
              <PortalPanel
                title="Create or Join a Group"
                description="This subject supports collaborative work. Start a new group or join an existing one with an invite code."
              >
                {groupActionState.error ? (
                  <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-200">
                    {groupActionState.error}
                  </div>
                ) : null}
                {groupActionState.success ? (
                  <div className="mb-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-200">
                    {groupActionState.success}
                  </div>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/75">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <Plus size={16} className="text-blue-700" />
                      <p className="font-display text-lg font-semibold tracking-[-0.03em]">
                        Create a Group
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Choose a clear group name and reserve your workspace for upcoming submissions.
                    </p>
                    <input
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Enter your group name"
                      className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-blue-400/40"
                    />
                    <button
                      onClick={handleCreateGroup}
                      disabled={groupActionState.saving || !groupName.trim()}
                      className="mt-4 w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)] transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {groupActionState.saving ? "Saving..." : "Create Group"}
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/75">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <UserPlus size={16} className="text-teal-700" />
                      <p className="font-display text-lg font-semibold tracking-[-0.03em]">
                        Join by Invite Code
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Paste the invite code from your classmate to join an approved group quickly.
                    </p>
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      placeholder="Paste the invite code"
                      className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-700 outline-none focus:border-teal-300 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-teal-400/40"
                    />
                    <button
                      onClick={handleJoinGroup}
                      disabled={groupActionState.saving || !joinCode.trim()}
                      className="mt-4 w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(13,148,136,0.55)] transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {groupActionState.saving ? "Joining..." : "Join Group"}
                    </button>
                  </div>
                </div>
              </PortalPanel>
            ) : (
              <PortalPanel
                title={data.group.name || "Current Group"}
                description="Your active collaboration space for this subject."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/75">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Invite Code
                        </p>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm uppercase tracking-[0.28em] text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
                          {data.group.code}
                        </div>
                      </div>
                      <button
                        onClick={copyCode}
                        className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Copy size={13} />
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Share this code only with classmates who should join your approved team.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/75">
                    <div className="flex items-center gap-2">
                      {String(data.group.status || "").toLowerCase() === "locked" ? (
                        <Lock size={16} className="text-amber-600" />
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      )}
                      <p className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                        Group Summary
                      </p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Leader:</span>{" "}
                        {data.group.leader}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Members:</span>{" "}
                        {data.group.membersCount}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span>{" "}
                        {data.group.status}
                      </p>
                    </div>
                  </div>
                </div>
              </PortalPanel>
            )}

            <PortalPanel
              title="Visible Members"
              description="Quick view of classmates or group participants linked to this subject."
            >
              {data.members.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.members.map((member) => (
                    <div
                      key={`${member.name}-${member.role}`}
                      className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80"
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{member.name}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{member.role}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(member.status)}`}>
                          {member.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <PortalEmptyState
                  title="No member roster available"
                  description="Member details will show up here once they are available for this subject."
                  icon={Users}
                  className="border-slate-200 bg-slate-50/80"
                />
              )}
            </PortalPanel>
          </div>

          <PortalPanel
            title="Recent Group Activity"
            description="Track the latest collaboration events tied to this subject."
          >
            {data.recentActivity.length ? (
              <div className="space-y-3">
              {data.recentActivity.map((entry) => (
                <div
                  key={entry}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-300"
                >
                  {entry}
                </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No group activity yet"
                description="Group updates, invitations, and submission events will appear here."
                icon={Clock}
                className="border-slate-200 bg-slate-50/80"
              />
            )}
          </PortalPanel>
        </div>
      ) : null}
    </PortalPage>
  );
}
