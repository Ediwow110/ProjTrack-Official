import { Mail, RefreshCcw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function statusClasses(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "processing") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "dead" || status === "cancelled") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function AdminMailJobs() {
  const { data, loading, reload } = useAsyncData(() => adminService.getMailJobs(), []);
  const rows = data ?? [];
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      await adminService.retryMailJob(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retry the selected mail job.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-slate-900 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>Mail Jobs</h1>
          <p className={`text-slate-400 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>Monitor queued and delivered emails.</p>
          <p className="text-slate-400 text-xs mt-1">{loading ? "Loading mail jobs…" : `${rows.length} mail job${rows.length === 1 ? "" : "s"}`}</p>
        </div>
        <button disabled={loading} onClick={reload} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 ${loading ? "opacity-80" : ""}`}>
        {[
          { label: "Queued", value: rows.filter((r) => r.status === "queued").length, tone: "text-amber-700" },
          { label: "Processing", value: rows.filter((r) => r.status === "processing").length, tone: "text-blue-700" },
          { label: "Sent", value: rows.filter((r) => r.status === "sent").length, tone: "text-emerald-700" },
          { label: "Failed", value: rows.filter((r) => r.status === "failed").length, tone: "text-rose-700" },
          { label: "Dead / Cancelled", value: rows.filter((r) => r.status === "dead" || r.status === "cancelled").length, tone: "text-rose-700" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className={`overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm ${loading ? "opacity-80" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {[
                "Recipient", "Template", "Status", "Attempts", "Timeline", "Provider", "Action",
              ].map((header) => (
                <th key={header} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td className="px-5 py-4" colSpan={7}><div className="h-7 animate-pulse rounded-lg bg-slate-100" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No queued emails yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className={loading ? "opacity-80" : "hover:bg-slate-50"}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><Mail size={14} className="text-slate-600" /></div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-800">{row.deliveryRecipient ?? row.to}</div>
                      {row.routedToTestmail && (
                        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          Routed to testmail
                        </div>
                      )}
                      {row.deliveryRecipient && row.deliveryRecipient !== row.to && (
                        <div className="text-[10px] text-slate-400">Stored user email: {row.to}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{row.template}</td>
                <td className="px-5 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>{row.status}</span></td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  <div className="font-semibold text-slate-700">{`${row.attempts ?? 0}/${row.maxAttempts ?? "—"}`}</div>
                  <div className="text-[10px] text-slate-400">{row.lastError ? "Has error" : "No error"}</div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  <div>Created: {row.createdAt}</div>
                  <div>Last try: {row.lastAttemptAt ?? "—"}</div>
                  <div>Next try: {row.nextAttemptAt ?? "—"}</div>
                  <div>Sent: {row.sentAt ?? "—"}</div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  <div className="font-medium text-slate-700">{row.provider ?? "—"}</div>
                  {row.fromEmail && <div className="text-[10px] text-slate-400">From: {row.fromEmail}</div>}
                  <div className="max-w-[220px] truncate text-[10px] text-slate-400" title={row.providerMessageId || row.id}>{row.providerMessageId ?? row.id}</div>
                  {row.lastError && <div className="mt-1 max-w-[240px] text-[10px] text-rose-600" title={row.lastError}>{row.lastError}</div>}
                  {row.failureHint && <div className="mt-1 max-w-[240px] text-[10px] text-amber-700">{row.failureHint}</div>}
                </td>
                <td className="px-5 py-3.5 text-xs">
                  {row.status === "failed" || row.status === "dead" ? (
                    <button disabled={retryingId === row.id} onClick={() => handleRetry(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      <RotateCcw size={12} /> {retryingId === row.id ? 'Retrying…' : 'Retry'}
                    </button>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
