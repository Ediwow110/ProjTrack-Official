import { BootstrapIcon, BootstrapIconButton, BootstrapIconTooltip } from "../../components/ui/bootstrap-icon";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function tone(status: string) {
  if (status === "ready") return "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  if (status === "action_needed") return "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300";
  return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300";
}

function stepIcon(status: string) {
  if (status === "ready") return { name: "check-circle-fill" as const, tone: "success" as const, label: "Ready" };
  if (status === "action_needed") return { name: "shield-exclamation" as const, tone: "danger" as const, label: "Action needed" };
  return { name: "hourglass-split" as const, tone: "warning" as const, label: "Pending" };
}

export default function AdminBootstrapGuide() {
  const { data, loading, reload } = useAsyncData(() => adminService.getBootstrapGuide(), []);
  const steps = data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-slate-900 dark:text-slate-100 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>Deployment Checklist</h1>
          <p className={`text-slate-400 dark:text-slate-300 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>Deployment checklist overview.</p>
          <p className="text-slate-400 dark:text-slate-300 text-xs mt-1">{loading ? "Loading deployment checklist…" : `${steps.length} deployment step${steps.length === 1 ? "" : "s"}`}</p>
        </div>
        <BootstrapIconButton
          disabled={loading}
          onClick={reload}
          icon="arrow-clockwise"
          tone="primary"
          label="Refresh deployment checklist"
          tooltip="Refresh deployment readiness and blockers."
          size="md"
        >
          Refresh
        </BootstrapIconButton>
      </div>

      <div className={`rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 ${loading ? "opacity-80" : ""}`}>
        Review current deployment requirements and blockers.
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${loading ? "opacity-80" : ""}`}>
        {loading && steps.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
                <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80" />
              </div>
            ))
          : steps.map((step) => {
              const icon = stepIcon(step.status);
              return (
                <div key={step.title} className={`rounded-xl border p-4 shadow-sm ${tone(step.status)} ${loading ? "opacity-80" : ""}`}>
                  <div className="flex items-start gap-3">
                    <BootstrapIconTooltip label={icon.label}>
                      <BootstrapIcon name={icon.name} tone={icon.tone} size={16} className="mt-0.5" />
                    </BootstrapIconTooltip>
                    <div className="space-y-1">
                      <h3 className={`text-sm font-bold text-slate-800 dark:text-slate-100 ${loading ? "opacity-80" : ""}`}>{step.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{step.status.replace("_", " ")}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{step.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
