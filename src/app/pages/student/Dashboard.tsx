import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  BookOpen,
  ChevronRight,
  Clock,
  FileCheck2,
  Upload,
} from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { DeadlineItem } from "../../lib/api/contracts";
import {
  isEditableSubmissionStatus,
  isViewOnlySubmissionStatus,
} from "../../lib/submissionRules";

function buildDeadlineTarget(item: DeadlineItem) {
  const back = encodeURIComponent("/student/dashboard");
  if (item.submissionId && isViewOnlySubmissionStatus(item.status)) {
    return `/student/submissions/${encodeURIComponent(String(item.submissionId))}?back=${back}`;
  }

  const params = new URLSearchParams();
  params.set("back", "/student/dashboard");
  params.set("subject", item.subject);
  if (item.subjectId) params.set("subjectId", String(item.subjectId));
  params.set("activity", item.title);
  if (item.activityId) params.set("activityId", String(item.activityId));
  if (item.submissionId && isEditableSubmissionStatus(item.status)) {
    params.set("submissionId", String(item.submissionId));
  }
  return `/student/submit?${params.toString()}`;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [submissionPage, setSubmissionPage] = useState(1);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const { data, loading, error } = useAsyncData(
    () => studentService.getDashboard(),
    [],
  );

  const heroStats = (data?.kpis ?? []).map((kpi) => ({
    label: kpi.label,
    value: kpi.value,
    hint:
      kpi.label === "Upcoming"
        ? "Deadlines that still need a response."
        : kpi.label === "Graded"
          ? "Finished work with released feedback."
        : "Live snapshot from your portal activity.",
  }));
  const recentSubmissions = data?.recentSubmissions ?? [];
  const submissionPageSize = 5;
  const submissionTotalPages = Math.max(1, Math.ceil(recentSubmissions.length / submissionPageSize));
  const visibleRecentSubmissions = recentSubmissions.slice(
    (submissionPage - 1) * submissionPageSize,
    submissionPage * submissionPageSize,
  );

  useEffect(() => {
    if (submissionPage > submissionTotalPages) {
      setSubmissionPage(submissionTotalPages);
    }
  }, [submissionPage, submissionTotalPages]);

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="blue"
        eyebrow={today}
        title={data?.greeting ?? "Loading dashboard..."}
        description={
          data?.subtext ??
          "Stay ahead of deadlines, track submissions, and keep your coursework moving."
        }
        icon={BookOpen}
        meta={[
          { label: "Portal", value: "Student workspace" },
          { label: "Deadlines", value: String(data?.deadlines.length ?? 0) },
          { label: "Notifications", value: String(data?.notifications.length ?? 0) },
        ]}
        stats={heroStats}
        actions={
          <>
            <button
              onClick={() => navigate("/student/submit?back=%2Fstudent%2Fdashboard")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-lg shadow-slate-950/10 transition hover:bg-blue-50"
            >
              <Upload size={16} />
              Submit Project
            </button>
            <button
              onClick={() => navigate("/student/calendar")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              <Clock size={16} />
              Open Calendar
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <PortalPanel
            title="Upcoming Deadlines"
            description="Prioritized work that should stay on your radar this week."
            action={
              <button
                onClick={() => navigate("/student/calendar")}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                View calendar
                <ChevronRight size={14} />
              </button>
            }
            contentClassName="px-0 py-0"
          >
            {loading && !data ? (
              <div className="space-y-3 px-5 py-5 sm:px-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : data?.deadlines.length ? (
              <div className="space-y-3 px-5 py-5 sm:px-6">
                {data.deadlines.map((deadline) => (
                  <button
                    key={deadline.id}
                    type="button"
                    onClick={() => navigate(buildDeadlineTarget(deadline))}
                    className={`flex w-full items-start justify-between rounded-[24px] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-34px_rgba(37,99,235,0.45)] ${
                      deadline.overdue
                        ? "border-rose-200 bg-rose-50/85 dark:border-rose-400/25 dark:bg-rose-500/15"
                        : deadline.daysLeft <= 3
                          ? "border-amber-200 bg-amber-50/85 dark:border-amber-400/25 dark:bg-amber-500/15"
                          : "border-slate-200 bg-slate-50/90 dark:border-slate-700/60 dark:bg-slate-800/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {deadline.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {deadline.subject}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <p
                        className={`text-xs font-semibold ${
                          deadline.overdue
                            ? "text-rose-600"
                            : deadline.daysLeft <= 3
                              ? "text-amber-700"
                              : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {deadline.overdue ? "Overdue" : deadline.due}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {deadline.overdue
                          ? `${Math.abs(deadline.daysLeft)}d late`
                          : `${deadline.daysLeft}d left`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-5 sm:px-6">
                <PortalEmptyState
                  title="No deadlines waiting right now"
                  description="You are caught up at the moment. New activities and reopening windows will appear here."
                  icon={Clock}
                  className="border-slate-200 bg-slate-50/80"
                />
              </div>
            )}
          </PortalPanel>

          <PortalPanel
            title="Recent Submissions"
            description="Latest work that has been turned in or graded."
            action={
              <button
                onClick={() => navigate("/student/submissions")}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                View all
                <ChevronRight size={14} />
              </button>
            }
            contentClassName="px-0 py-0"
          >
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/80">
                    {["Title", "Subject", "Submitted", "Status", "Grade"].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRecentSubmissions.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer bg-white/70 transition hover:bg-blue-50/45 dark:bg-slate-900/38 dark:hover:bg-blue-500/12"
                      onClick={() =>
                        navigate(
                          `/student/submissions/${encodeURIComponent(String(row.id))}?back=${encodeURIComponent("/student/dashboard")}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(
                            `/student/submissions/${encodeURIComponent(String(row.id))}?back=${encodeURIComponent("/student/dashboard")}`,
                          );
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open recent submission ${row.title}`}
                    >
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {row.title}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {row.subject}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 dark:text-slate-500">
                        {row.date}
                      </td>
                      <td className="px-6 py-4">
                        <StatusChip status={row.status} size="xs" />
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-emerald-700">
                        {row.grade !== "—" ? `${row.grade}/100` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
              {submissionTotalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-slate-200/70 px-5 pt-1 dark:border-slate-700/60 sm:px-6">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    Showing {(submissionPage - 1) * submissionPageSize + 1}-{Math.min(submissionPage * submissionPageSize, recentSubmissions.length)} of {recentSubmissions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submissionPage === 1}
                      onClick={() => setSubmissionPage((page) => Math.max(1, page - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Page {submissionPage} of {submissionTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={submissionPage === submissionTotalPages}
                      onClick={() => setSubmissionPage((page) => Math.min(submissionTotalPages, page + 1))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Momentum Actions"
            description="Quick moves for your next best step."
          >
            <div className="space-y-3">
              {[
                {
                  label: "Submit a project",
                  description: "Open the guided submission workspace.",
                  icon: Upload,
                  to: "/student/submit?back=%2Fstudent%2Fdashboard",
                  primary: true,
                },
                {
                  label: "View my subjects",
                  description: "Jump into a subject workspace.",
                  icon: BookOpen,
                  to: "/student/subjects",
                },
                {
                  label: "Track submissions",
                  description: "Review grades, notes, and current status.",
                  icon: FileCheck2,
                  to: "/student/submissions",
                },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.to)}
                    className={`flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                      action.primary
                        ? "border-blue-700 bg-blue-700 text-white shadow-[0_22px_55px_-34px_rgba(29,78,216,0.55)] hover:bg-blue-800"
                        : "border-slate-200 bg-slate-50/90 text-slate-800 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/15"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        action.primary
                          ? "bg-white/16"
                          : "bg-white dark:bg-slate-900/70 dark:text-slate-100"
                      }`}
                    >
                      <Icon size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{action.label}</p>
                      <p
                        className={`mt-1 text-xs leading-5 ${
                          action.primary
                            ? "text-white/74"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {action.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Recent Notifications"
            description="Fresh portal updates that may need your attention."
            action={
              <button
                onClick={() => navigate("/student/notifications")}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Open inbox
                <ChevronRight size={14} />
              </button>
            }
          >
            <div className="space-y-3">
              {(data?.notifications ?? []).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                      <Bell size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
                        {notification.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
