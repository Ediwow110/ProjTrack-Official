import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, HardDrive, RefreshCw, Activity, Trash2, RefreshCcw, FileText } from "lucide-react";
import { AppModal } from "../../components/ui/app-modal";
import { adminOpsService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { SystemToolRecord, SystemToolRunResult } from "../../lib/api/contracts";

const iconMap: Record<string, typeof Database> = {
  backup: Database,
  restore: RefreshCw,
  cache: HardDrive,
  purge: Trash2,
  diag: Activity,
  export: Download,
};

const toneMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AdminSystemTools() {
  const { data, loading, error, setData, reload } = useAsyncData(() => adminOpsService.getSystemTools(), []);
  const tools = data ?? [];
  const [confirmTool, setConfirmTool] = useState<SystemToolRecord | null>(null);
  const [lastResult, setLastResult] = useState<SystemToolRunResult | null>(null);
  const [runState, setRunState] = useState<{ running: boolean; error: string | null }>({ running: false, error: null });
  const [importState, setImportState] = useState<{ importing: boolean; error: string | null }>({ importing: false, error: null });
  const [artifactBusy, setArtifactBusy] = useState(false);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);

  const handleRun = async () => {
    if (!confirmTool || runState.running) return;
    setLastResult(null);
    setRunState({ running: true, error: null });
    try {
      const response = await adminOpsService.runSystemTool(confirmTool.id);
      setData(response.tools);
      setLastResult(response.result);
      setConfirmTool(null);
      setRunState({ running: false, error: null });
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to run the selected system tool.";
      setRunState({ running: false, error: message });
    }
  };

  const handleDownloadArtifact = async (artifactPath?: string) => {
    if (!artifactPath || artifactBusy) return;
    setArtifactBusy(true);
    try {
      await adminOpsService.downloadSystemToolArtifact(artifactPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to download the generated artifact.";
      setRunState((current) => ({ ...current, error: message }));
    } finally {
      setArtifactBusy(false);
    }
  };

  const handleImportBackup = async (file?: File | null) => {
    if (!file || importState.importing) return;
    setImportState({ importing: true, error: null });
    setRunState({ running: false, error: null });
    try {
      const result = await adminOpsService.importBackupPackage(file);
      setLastResult(result);
      await reload();
      setImportState({ importing: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to import the backup package.";
      setImportState({ importing: false, error: message });
    } finally {
      if (backupImportInputRef.current) {
        backupImportInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-slate-900 font-bold ${loading || runState.running ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            System Tools
          </h1>
          <p className={`text-slate-400 text-sm mt-0.5 ${loading || runState.running ? "opacity-80" : ""}`}>
            Operational tools for backup, maintenance, diagnostics, and exports.
          </p>
          <p className={`text-slate-400 text-xs mt-1 ${loading || runState.running ? "opacity-80" : ""}`}>
            {loading ? "Refreshing system tool status…" : `${tools.length} tool${tools.length === 1 ? "" : "s"} available` }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={backupImportInputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => handleImportBackup(event.target.files?.[0])}
          />
          <button
            disabled={loading || runState.running || importState.importing}
            onClick={() => backupImportInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileText size={14} /> {importState.importing ? "Importing…" : "Import Backup"}
          </button>
          <button
            disabled={loading || runState.running || importState.importing}
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {runState.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{runState.error}</div>}
      {importState.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{importState.error}</div>}

      {lastResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-emerald-800 text-sm font-bold">{lastResult.title}</p>
              <p className="text-emerald-700 text-sm mt-1">{lastResult.summary}</p>
              <p className="text-emerald-700/80 text-xs mt-1">Run at {new Date(lastResult.ranAt).toLocaleString()}</p>
            </div>
          </div>
          {lastResult.details.length > 0 && (
            <ul className="space-y-1 text-sm text-emerald-800 pl-6 list-disc">
              {lastResult.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          {lastResult.artifactPath && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                <FileText size={14} /> Artifact: {lastResult.artifactPath}
              </div>
              <button
                type="button"
                disabled={artifactBusy}
                onClick={() => handleDownloadArtifact(lastResult.artifactPath)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Download size={14} /> {artifactBusy ? "Downloading…" : "Download Artifact"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">Backup and restore flow</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <p>Run Backup to generate a JSON snapshot package and download it for safekeeping.</p>
          <p>Use Import Backup to place a downloaded package back into the server backup library.</p>
          <p>Restore Backup always targets the newest package stored in <span className="font-semibold text-slate-700">backend/data/system-tools/backups</span>.</p>
        </div>
      </div>

      {runState.running && <div className="text-xs text-slate-400">Running selected action…</div>}
      {loading && tools.length > 0 && <div className="text-xs text-slate-400">Refreshing tool status…</div>}

      {loading && tools.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-sm text-slate-400">Loading system tools…</div>
      ) : tools.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">No system tools are configured right now.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {tools.map((tool) => {
            const Icon = iconMap[tool.id] ?? Database;
            const tone = toneMap[tool.tone] ?? toneMap.slate;
            const borderClass = tone.split(" ").find((cls) => cls.startsWith("border-")) ?? "border-slate-200";
            return (
              <div key={tool.id} className={`rounded-2xl border bg-white shadow-sm p-5 ${borderClass}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tone}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-slate-900 text-sm font-bold">{tool.title}</h2>
                        <p className="text-slate-500 text-sm mt-1">{tool.desc}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${tool.danger ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                        {tool.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4 gap-3">
                      <p className="text-[11px] text-slate-400">Last run: {tool.lastRun}</p>
                      <button
                        onClick={() => setConfirmTool(tool)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold ${tool.danger ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-blue-800 text-white hover:bg-blue-900"}`}
                      >
                        {tool.btn}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AppModal
        open={Boolean(confirmTool)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setConfirmTool(null);
          }
        }}
        title="Confirm Action"
        description="Make sure the selected maintenance action is intentional before continuing."
        size="md"
        footer={
          <>
            <button
              onClick={() => setConfirmTool(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleRun}
              disabled={runState.running}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${confirmTool?.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-800 hover:bg-blue-900"}`}
            >
              {runState.running ? "Running…" : "Confirm"}
            </button>
          </>
        }
      >
        {confirmTool ? (
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${confirmTool.danger ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"}`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Run <span className="font-semibold text-slate-700 dark:text-slate-100">{confirmTool.title}</span> now?
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">
                {confirmTool.danger
                  ? "This tool can change or remove stored data. Confirm only if you intend to perform the operation immediately."
                  : "This tool will run immediately and update the latest system state when it completes."}
              </p>
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}
