import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  RefreshCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

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
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-950/10 transition hover:bg-slate-100 disabled:opacity-60"
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
          <div className="grid gap-6 lg:grid-cols-2">
            <PortalPanel
              title="Submission Trend"
              description="Recent volume across the platform."
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.submissionTrend ?? []} barCategoryGap="36%">
                  <XAxis
                    dataKey="month"
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
                    cursor={{ fill: "#e2e8f0" }}
                  />
                  <Bar dataKey="count" fill="#1f2937" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PortalPanel>

            <PortalPanel
              title="Status Distribution"
              description="How platform outcomes are currently spread."
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data?.statusDist ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(data?.statusDist ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </PortalPanel>
          </div>

          <PortalPanel
            title="Recent Activity"
            description="Platform events and operational updates happening right now."
          >
            {recentActivity.length ? (
              <div className="space-y-4">
                {visibleRecentActivity.map((activity, index) => (
                  <div
                    key={`${activity.action}-${activity.target}-${index}`}
                    className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4"
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
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">{activity.action}</span> ·{" "}
                        {activity.target}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400">{activity.time}</span>
                  </div>
                ))}
                {activityTotalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-slate-200/70 pt-4">
                    <p className="text-xs font-medium text-slate-400">
                      Showing {(activityPage - 1) * activityPageSize + 1}-{Math.min(activityPage * activityPageSize, recentActivity.length)} of {recentActivity.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={activityPage === 1}
                        onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-semibold text-slate-500">
                        Page {activityPage} of {activityTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={activityPage === activityTotalPages}
                        onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
                className="border-slate-200 bg-slate-50/80"
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
                      ? "bg-slate-900 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] hover:bg-slate-950"
                      : "border border-slate-200 bg-slate-50/90 text-slate-700 hover:bg-slate-100"
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
                  className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3"
                >
                  <span className="text-sm text-slate-600">{status.label}</span>
                  <div className="flex items-center gap-2">
                    {status.good ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-500" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        status.good ? "text-emerald-700" : "text-amber-700"
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
              <p className="pt-2 text-sm leading-6 text-slate-400">{term.detail}</p>
            </div>
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
