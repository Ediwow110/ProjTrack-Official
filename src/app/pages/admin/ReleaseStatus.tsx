import { BootstrapIcon, BootstrapIconButton, BootstrapIconTooltip } from "../../components/ui/bootstrap-icon";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function tone(status: string) {
  if (status === "done") return "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  if (status === "in_progress") return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300";
  return "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300";
}

function releaseIcon(status: string) {
  if (status === "done") return { name: "check-circle-fill" as const, tone: "success" as const, label: "Done" };
  if (status === "in_progress") return { name: "hourglass-split" as const, tone: "warning" as const, label: "In progress" };
  return { name: "shield-exclamation" as const, tone: "danger" as const, label: "Release blocker" };
}

export default function AdminReleaseStatus() {
  const { data, loading, reload } = useAsyncData(() => adminService.getReleaseStatus(), []);
  const rows = data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className={`flex items-start justify-between gap-4 ${loading ? "opacity-95" : ""}`}>
        <div>
          <h1 className={`text-slate-900 dark:text-slate-100 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>Release Status</h1>
          <p className={`text-slate-400 dark:text-slate-300 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>Current release readiness across the core system.</p>
          <p className={`text-slate-400 dark:text-slate-300 text-xs mt-1 ${loading ? "opacity-80" : ""}`}>{loading ? "Loading release status…" : `${rows.length} release area${rows.length === 1 ? "" : "s"}`}</p>
          <p className={`text-slate-400 dark:text-slate-300 text-xs mt-1 ${loading ? "opacity-80" : ""}`}>{loading ? "Updating release readiness…" : "Review the current release blockers and completed areas."}</p>
        </div>
        <BootstrapIconButton
          disabled={loading}
          onClick={reload}
          icon="arrow-clockwise"
          tone="primary"
          label="Refresh release status"
          tooltip="Refresh release readiness checks and blockers."
          size="md"
        >
          Refresh
        </BootstrapIconButton>
      </div>

      <div className={`rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 ${loading ? "opacity-80" : ""}`}>
        Review completed areas and remaining release blockers.
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${loading ? "opacity-80" : ""}`}>
        {loading && rows.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
                <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80" />
              </div>
            ))
          : rows.map((row) => {
              const icon = releaseIcon(row.status);
              return (
                <div key={row.area} className={`rounded-xl border p-4 shadow-sm ${tone(row.status)} ${loading ? "opacity-80" : ""}`}>
                  <div className="flex items-start gap-3">
                    <BootstrapIconTooltip label={icon.label}>
                      <BootstrapIcon name={icon.name} tone={icon.tone} size={18} className="mt-0.5" />
                    </BootstrapIconTooltip>
                    <div className="space-y-1">
                      <h3 className={`text-sm font-bold text-slate-800 dark:text-slate-100 ${loading ? "opacity-80" : ""}`}>{row.area}</h3>
                      <p className={`text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 ${loading ? "opacity-80" : ""}`}>{row.status.replace("_", " ")}</p>
                      <p className={`text-sm text-slate-600 dark:text-slate-300 ${loading ? "opacity-80" : ""}`}>{row.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
