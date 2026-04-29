import { Activity, RefreshCcw } from "lucide-react";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function AdminSystemHealth() {
  const { data, loading, reload } = useAsyncData(() => adminService.getSystemHealth(), []);
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-[var(--text-body)]">
      <div className={`flex items-start justify-between gap-4 ${loading ? "opacity-95" : ""}`}>
        <div>
          <h1 className={`text-[var(--text-strong)] font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            System Health
          </h1>
          <p className={`mt-0.5 text-sm text-[var(--text-muted)] ${loading ? "opacity-80" : ""}`}>
            Monitor backend connectivity, storage, mail delivery, and database readiness.
          </p>
          {!loading && <p className="mt-1 text-xs text-[var(--text-muted)]">{rows.length} checks available.</p>}
        </div>
        <button
          disabled={loading}
          onClick={reload}
          className="portal-action-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
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
