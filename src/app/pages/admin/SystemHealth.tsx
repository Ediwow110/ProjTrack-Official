import { Activity, RefreshCcw } from "lucide-react";
import { adminService } from "../../lib/api/services";
import { featureFlags } from "../../lib/flags";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function AdminSystemHealth() {
  const { data, loading, reload } = useAsyncData(() => adminService.getSystemHealth(), []);
  const {
    data: clientErrors,
    loading: loadingClientErrors,
    reload: reloadClientErrors,
  } = useAsyncData(() => adminService.getClientErrorTelemetry(), []);
  const rows = data ?? [];
  const recentClientErrors = clientErrors?.items ?? [];
  const runtimeControls = [
    { label: "Client Error Reporting", enabled: featureFlags.clientErrorReporting },
    { label: "Offline Banner", enabled: featureFlags.globalOfflineBanner },
    { label: "Network Overlay", enabled: featureFlags.globalNetworkOverlay },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-[var(--text-body)]">
      <div className={`flex items-start justify-between gap-4 ${loading || loadingClientErrors ? "opacity-95" : ""}`}>
        <div>
          <h1 className={`text-[var(--text-strong)] font-bold ${loading || loadingClientErrors ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            System Health
          </h1>
          <p className={`mt-0.5 text-sm text-[var(--text-muted)] ${loading || loadingClientErrors ? "opacity-80" : ""}`}>
            Monitor backend connectivity, storage, mail delivery, and database readiness.
          </p>
          {!loading && !loadingClientErrors && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {rows.length} checks available · {clientErrors?.count ?? 0} recent client errors captured.
            </p>
          )}
        </div>
        <button
          disabled={loading || loadingClientErrors}
          onClick={() => {
            reload();
            reloadClientErrors();
          }}
          className="portal-action-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
        <div className="portal-card rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">Frontend Runtime Controls</p>
              <p className="mt-2 text-lg font-bold text-[var(--text-strong)]">
                {runtimeControls.filter((item) => item.enabled).length}/{runtimeControls.length} enabled
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {runtimeControls.map((item) => (
              <div key={item.label} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <p className="text-xs font-medium text-[var(--text-muted)]">{item.label}</p>
                <p className={`mt-1 text-sm font-semibold ${item.enabled ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
                  {item.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="portal-card rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">Recent Client Error Reports</p>
              <p className="mt-2 text-lg font-bold text-[var(--text-strong)]">
                {loadingClientErrors ? "Loading..." : `${clientErrors?.count ?? 0} captured`}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Latest reports submitted by the global error boundary.
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {recentClientErrors.length ? recentClientErrors.slice(0, 4).map((item) => (
              <div key={`${item.errorId}-${item.receivedAt}`} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel-muted)] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{item.message}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {item.route || "Unknown route"} · {item.online === false ? "offline" : "online"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                    {new Date(item.receivedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">Error ID: {item.errorId}</p>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--surface-panel-muted)] px-3 py-6 text-sm text-[var(--text-muted)]">
                {loadingClientErrors ? "Loading client error telemetry..." : "No recent client errors have been reported."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-80" : ""}`}>
        {loading && rows.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="portal-card rounded-xl p-4 shadow-sm">
                <div className="h-20 animate-pulse rounded-lg bg-[var(--surface-panel-muted)]" />
              </div>
            ))
          : rows.map((row) => (
              <div key={row.key} className="portal-card rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-medium text-[var(--text-muted)] ${loading ? "opacity-80" : ""}`}>{row.label}</p>
                    <p className={`mt-2 text-lg font-bold ${row.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"} ${loading ? "opacity-80" : ""}`}>
                      {row.ok ? "Healthy" : "Needs attention"}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${row.ok ? "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"} ${loading ? "opacity-80" : ""}`}>
                    <Activity size={18} />
                  </div>
                </div>
                <p className={`mt-3 text-xs text-[var(--text-muted)] ${loading ? "opacity-80" : ""}`}>{row.detail}</p>
                <p className={`mt-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)] ${loading ? "opacity-80" : ""}`}>
                  Checked {new Date(row.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
}
