import { Activity, RefreshCcw } from "lucide-react";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function AdminSystemHealth() {
  const { data, loading, reload } = useAsyncData(() => adminService.getSystemHealth(), []);
  const rows = data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className={`flex items-start justify-between gap-4 ${loading ? "opacity-95" : ""}`}>
        <div>
          <h1 className={`text-slate-900 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            System Health
          </h1>
          <p className={`text-slate-400 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>
            Monitor backend connectivity, storage, mail delivery, and database readiness.
          </p>
          {!loading && <p className="text-slate-400 text-xs mt-1">{rows.length} checks available.</p>}
        </div>
        <button
          disabled={loading}
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 ${loading ? "opacity-80" : ""}`}>
        {loading && rows.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))
          : rows.map((row) => (
              <div key={row.key} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-medium text-slate-400 ${loading ? "opacity-80" : ""}`}>{row.label}</p>
                    <p className={`mt-2 text-lg font-bold ${row.ok ? "text-emerald-700" : "text-rose-700"} ${loading ? "opacity-80" : ""}`}>
                      {row.ok ? "Healthy" : "Needs attention"}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${row.ok ? "bg-emerald-50" : "bg-rose-50"} ${loading ? "opacity-80" : ""}`}>
                    <Activity size={18} className={row.ok ? "text-emerald-700" : "text-rose-700"} />
                  </div>
                </div>
                <p className={`mt-3 text-xs text-slate-500 ${loading ? "opacity-80" : ""}`}>{row.detail}</p>
                <p className={`mt-2 text-[10px] uppercase tracking-wide text-slate-400 ${loading ? "opacity-80" : ""}`}>
                  Checked {new Date(row.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
}
