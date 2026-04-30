import { Download, FileJson, Lock, RefreshCcw, ShieldCheck, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { BackupRunRecord } from "../../lib/api/contracts";

function formatBytes(value?: number | null) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "RUNNING") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "FAILED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function AdminBackups() {
  const { data, loading, reload } = useAsyncData(() => adminService.getBackupHistory(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = data?.rows ?? [];
  const latestId = data?.latestSuccessful?.id;

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage("Backup action completed.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup action failed.");
    } finally {
      setBusy(null);
    }
  };

  const canDelete = (row: BackupRunRecord) =>
    row.status !== "RUNNING" && !row.isProtected && row.id !== latestId;

  return (
    <div className="portal-surface p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: "1.3rem" }}>Backup History</h1>
          <p className="text-slate-400 text-sm mt-0.5">Run, validate, protect, download, and retire production backup artifacts.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={loading || Boolean(busy)} onClick={reload} className="portal-input inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold">
            <RefreshCcw size={14} /> Refresh
          </button>
          <button disabled={Boolean(busy)} onClick={() => runAction("run", () => adminService.runBackupNow())} className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <ShieldCheck size={14} /> {busy === "run" ? "Running..." : "Run Backup Now"}
          </button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ["Latest", data?.latestSuccessful?.completedAt ? new Date(data.latestSuccessful.completedAt).toLocaleString() : "None"],
          ["Oldest", data?.oldestAvailable?.startedAt ? new Date(data.oldestAvailable.startedAt).toLocaleDateString() : "None"],
          ["Total", String(data?.totalBackups ?? 0)],
          ["Failed", String(data?.failedBackups ?? 0)],
          ["Storage", formatBytes(data?.storageUsedBytes)],
        ].map(([label, value]) => (
          <div key={label} className="portal-card rounded-xl border p-4">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="portal-card overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="portal-border portal-table-header border-b">
              {["Status", "Trigger", "Type", "Created", "Size", "Storage", "Protected", "Actions"].map((header) => (
                <th key={header} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {loading && rows.length === 0 ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index}><td colSpan={8} className="px-5 py-4"><div className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">No backups have been recorded yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="portal-table-row">
                <td className="px-5 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.status)}`}>{row.status}</span></td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{row.trigger}</td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{row.backupType}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(row.startedAt).toLocaleString()}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{formatBytes(row.sizeBytes)}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{row.storage}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{row.isProtected ? "Protected" : "No"}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => runAction(`download-${row.id}`, () => adminService.downloadBackup(row.id, row.fileName || undefined))} className="portal-input rounded-lg border p-2" title="Download"><Download size={14} /></button>
                    <button onClick={() => runAction(`validate-${row.id}`, () => adminService.validateBackup(row.id))} className="portal-input rounded-lg border p-2" title="Validate"><FileJson size={14} /></button>
                    <button onClick={() => runAction(`protect-${row.id}`, () => adminService.protectBackup(row.id, !row.isProtected))} className="portal-input rounded-lg border p-2" title={row.isProtected ? "Unprotect" : "Protect"}>{row.isProtected ? <Unlock size={14} /> : <Lock size={14} />}</button>
                    <button disabled={!canDelete(row)} onClick={() => runAction(`delete-${row.id}`, () => adminService.deleteBackup(row.id))} className="rounded-lg border border-rose-200 p-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40" title="Delete old backup"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
