import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Clock, FileCheck2 } from "lucide-react";
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatusChip } from "../../components/ui/StatusChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { teacherDashboardService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type {
  TeacherDeadlineItem,
  TeacherPendingReviewItem,
} from "../../lib/api/contracts";

function buildDeadlineTarget(item: TeacherDeadlineItem) {
  if (item.subjectId) {
    return `/teacher/subjects/${encodeURIComponent(String(item.subjectId))}?tab=Submissions&activityId=${encodeURIComponent(String(item.activityId || ""))}&back=${encodeURIComponent("/teacher/dashboard")}`;
  }
  return "/teacher/subjects";
}

function buildPendingTarget(_item: TeacherPendingReviewItem) {
  return "/teacher/submissions?status=Pending%20Review";
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [pendingPage, setPendingPage] = useState(1);
  const { data, loading, error } = useAsyncData(
    () => teacherDashboardService.getDashboard(),
    [],
  );
  const pendingRows = data?.pending ?? [];
  const pendingPageSize = 6;
  const pendingTotalPages = Math.max(1, Math.ceil(pendingRows.length / pendingPageSize));
  const visiblePendingRows = pendingRows.slice(
    (pendingPage - 1) * pendingPageSize,
    pendingPage * pendingPageSize,
  );

  useEffect(() => {
    if (pendingPage > pendingTotalPages) {
      setPendingPage(pendingTotalPages);
    }
  }, [pendingPage, pendingTotalPages]);

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="teal"
        eyebrow="Teaching Overview"
        title={data?.greeting ?? "Loading dashboard..."}
        description={
          data?.subtext ??
          "Track subject momentum, prioritize reviews, and keep every activity moving on time."
        }
        icon={BookOpen}
        meta={[
          { label: "Portal", value: "Teacher workspace" },
          { label: "Pending", value: String(data?.pending.length ?? 0) },
          {
            label: "Deadlines",
            value: String(data?.upcomingDeadlines.length ?? 0),
          },
        ]}
        stats={(data?.kpis ?? []).map((kpi) => ({
          label: kpi.label,
          value: kpi.value,
          hint: "Updated from live submission and class activity data.",
        }))}
        actions={
          <>
            <button
              onClick={() => navigate("/teacher/submissions")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900/85 px-4 py-3 text-sm font-semibold text-teal-800 dark:text-teal-200 shadow-lg shadow-slate-950/10 transition hover:bg-teal-50"
            >
              <FileCheck2 size={16} />
              Review Submissions
            </button>
            <button
              onClick={() => navigate("/teacher/subjects")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              <BookOpen size={16} />
              Open Subjects
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PortalPanel
          title="Submission Status Overview"
          description="A quick view of where the review queue and class progress stand."
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.chartData ?? []}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 16,
                  color: "#f8fafc",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {(data?.chartData ?? []).map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PortalPanel>

        <PortalPanel
          title="Upcoming Deadlines"
          description="Classes that are about to require a follow-up."
        >
          {(data?.upcomingDeadlines ?? []).length ? (
            <div className="space-y-3">
              {(data?.upcomingDeadlines ?? []).map((deadline) => (
                <button
                  key={`${deadline.subjectId || deadline.subject}-${deadline.activityId || deadline.activity}`}
                  type="button"
                  onClick={() => navigate(buildDeadlineTarget(deadline))}
                  className="w-full rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-800/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/70 dark:hover:bg-teal-500/15 hover:shadow-[0_18px_45px_-34px_rgba(13,148,136,0.35)]"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {deadline.activity}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {deadline.subject}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold ${
                        deadline.daysLeft <= 1 ? "text-rose-600" : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {deadline.daysLeft} day{deadline.daysLeft === 1 ? "" : "s"} left
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {deadline.submitted}/{deadline.total} submitted
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <PortalEmptyState
              title="No deadlines to chase"
              description="Upcoming assignment windows will appear here when they need your attention."
              icon={Clock}
              className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
            />
          )}
        </PortalPanel>
      </div>

      <PortalPanel
        title="Pending Review Queue"
        description="Learner work that still needs teacher feedback or grading."
      >
        {pendingRows.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/70">
                  {["Title", "Student", "Subject", "Submitted", "Status"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {visiblePendingRows.map((row) => (
                  <tr
                    key={`${row.title}-${row.student}-${row.submitted}`}
                    className="cursor-pointer bg-white/70 dark:bg-slate-900/70 transition hover:bg-teal-50/45 dark:hover:bg-teal-500/15"
                    onClick={() => navigate(buildPendingTarget(row))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(buildPendingTarget(row));
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open pending review ${row.title}`}
                  >
                    <td className="px-5 py-4 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {row.title}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                      {row.student}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {row.subject}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 dark:text-slate-300">
                      {row.submitted}
                    </td>
                    <td className="px-5 py-4">
                      <StatusChip status={row.status} size="xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {pendingTotalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/60 pt-4">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                  Showing {(pendingPage - 1) * pendingPageSize + 1}-{Math.min(pendingPage * pendingPageSize, pendingRows.length)} of {pendingRows.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingPage === 1}
                    onClick={() => setPendingPage((page) => Math.max(1, page - 1))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Page {pendingPage} of {pendingTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={pendingPage === pendingTotalPages}
                    onClick={() => setPendingPage((page) => Math.min(pendingTotalPages, page + 1))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <PortalEmptyState
            title="Queue is clear"
            description="No submissions are currently waiting for a review in this view."
            icon={FileCheck2}
            className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
          />
        )}
      </PortalPanel>
    </PortalPage>
  );
}
