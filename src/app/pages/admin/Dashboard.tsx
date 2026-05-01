import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  BarChart3,
  RefreshCcw,
} from "lucide-react";
import { BootstrapIcon } from "../../components/ui/bootstrap-icon";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

const AdminDashboardCharts = lazy(() => import("./components/AdminDashboardCharts"));

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activityPage, setActivityPage] = useState(1);
  const { data, loading, reload } = useAsyncData(() => adminService.getDashboard(), []);
  const healthySystems = data?.systemStatus.filter((item) => item.good).length ?? 0;
  const totalSystems = data?.systemStatus.length ?? 0;
  const recentActivity = data?.recentActivity ?? [];
  const activityPageSize = 5;
  const activityTotalPages = Math.max(1, Math.ceil(recentActivity.length / activityPageSize));
  const visibleRecentActivity = recentActivity.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize,
  );
  const term = data?.currentTerm ?? {
    schoolYear: "Not configured",
    semester: "Not configured",
    detail: "Use Academic Settings to configure the current term.",
  };

  useEffect(() => {
    if (activityPage > activityTotalPages) {
      setActivityPage(activityTotalPages);
    }
  }, [activityPage, activityTotalPages]);

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="slate"
        eyebrow="Operations Overview"
        title={data?.title ?? "System Dashboard"}
        description={
          data?.subtitle ??
          "Monitor readiness, keep operational queues visible, and move quickly between the parts of the platform that need action."
        }
        icon={BarChart3}
        meta={[
          { label: "Systems", value: totalSystems ? `${healthySystems}/${totalSystems} healthy` : "Checking" },
          { label: "Term", value: term.semester },
          { label: "School Year", value: term.schoolYear },
        ]}
        stats={(data?.kpis ?? []).slice(0, 4).map((kpi) => ({
          label: kpi.label,
          value: kpi.value,
          hint: kpi.delta,
        }))}
        actions={
          <>
            <button
              disabled={loading}
              onClick={reload}
              className="portal-action-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCcw size={16} />
              Refresh Snapshot
            </button>
            <button
              onClick={() => navigate("/admin/system-health")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              <Activity size={16} />
              System Health
            </button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Suspense
            fallback={
              <div className="grid gap-6 lg:grid-cols-2">
                {["Submission Trend", "Status Distribution"].map((title) => (
                  <PortalPanel
                    key={title}
                    title={title}
                    description="Loading chart module..."
                  >
                    <div className="h-[220px] animate-pulse rounded-[22px] bg-[var(--surface-panel-muted)]" />
                  </PortalPanel>
                ))}
              </div>
            }
          >
            <AdminDashboardCharts
              submissionTrend={data?.submissionTrend ?? []}
              statusDist={data?.statusDist ?? []}
            />
          </Suspense>

          <PortalPanel
            title="Recent Activity"
            description="Platform events and operational updates happening right now."
          >
            {recentActivity.length ? (
              <div className="space-y-4">
                {visibleRecentActivity.map((activity, index) => (
                  <div
                    key={`${activity.action}-${activity.target}-${index}`}
                    className="flex items-center gap-3 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 py-4"
                  >
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        activity.type === "create"
                          ? "bg-blue-500"
                          : activity.type === "approve"
                            ? "bg-emerald-500"
                            : activity.type === "reset"
                              ? "bg-amber-500"
                              : "bg-teal-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-body)]">
                        <span className="font-semibold">{activity.action}</span> ·{" "}
                        {activity.target}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">{activity.time}</span>
                  </div>
                ))}
                {activityTotalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                    <p className="text-xs font-medium text-[var(--text-muted)]">
                      Showing {(activityPage - 1) * activityPageSize + 1}-{Math.min(activityPage * activityPageSize, recentActivity.length)} of {recentActivity.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={activityPage === 1}
                        onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                        className="portal-action-secondary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        Page {activityPage} of {activityTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={activityPage === activityTotalPages}
                        onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))}
                        className="portal-action-secondary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <PortalEmptyState
                title="No activity to show"
                description="Recent actions and system events will appear here once they are recorded."
                icon={Activity}
                className="border-[var(--border-subtle)] bg-[var(--surface-panel-muted)]"
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Quick Actions"
            description="Jump directly into the main admin workflows."
          >
            <div className="space-y-3">
              {[
                { label: "Students", to: "/admin/students", primary: true },
                { label: "Teachers", to: "/admin/teachers" },
                { label: "Departments", to: "/admin/departments" },
                { label: "View Requests", to: "/admin/requests" },
                { label: "Academic Settings", to: "/admin/academic-settings" },
                { label: "Reports", to: "/admin/reports" },
                { label: "Announcements", to: "/admin/announcements" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.to)}
                  className={`w-full rounded-[22px] px-4 py-3 text-left text-sm font-semibold transition ${
                    action.primary
                      ? "bg-slate-900 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] hover:bg-slate-950 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                      : "border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[var(--text-body)] hover:bg-[var(--surface-panel-strong)]"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="System Status"
            description="Operational health snapshot across major services."
          >
            <div className="space-y-3">
              {(data?.systemStatus ?? []).map((status) => (
                <div
                  key={status.label}
                  className="flex items-center justify-between rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 py-3"
                >
                  <span className="text-sm text-[var(--text-muted)]">{status.label}</span>
                  <div className="flex items-center gap-2">
                    {status.good ? (
                      <BootstrapIcon name="check-circle-fill" tone="success" size={14} />
                    ) : (
                      <BootstrapIcon name="exclamation-triangle-fill" tone="warning" size={14} />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        status.good ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {status.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel className="border-slate-700/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(30,41,59,0.95)_100%)]">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Current Academic Term
              </p>
              <p className="font-display text-3xl font-semibold tracking-[-0.04em] text-white">
                {term.schoolYear}
              </p>
              <p className="text-sm text-slate-300">{term.semester}</p>
              <p className="pt-2 text-sm leading-6 text-slate-400 dark:text-slate-300">{term.detail}</p>
            </div>
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
