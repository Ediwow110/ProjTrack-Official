import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  Database,
  Download,
  FileText,
  HardDrive,
  RefreshCcw,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { AppModal } from "../../components/ui/app-modal";
import { adminOpsService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { SeedCleanupPreview, SystemToolRecord, SystemToolRunResult } from "../../lib/api/contracts";
import { BootstrapIcon } from "../../components/ui/bootstrap-icon";

const iconMap: Record<string, typeof Database> = {
  backup: Database,
  restore: RefreshCw,
  cache: HardDrive,
  purge: Trash2,
  diag: Activity,
  export: Download,
  "seed-cleanup": Trash2,
};

const toneMap: Record<string, string> = {
  blue: "border-blue-200/70 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-500/25 dark:bg-blue-500/12 dark:text-blue-200",
  teal: "border-teal-200/70 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 dark:border-teal-500/25 dark:bg-teal-500/12 dark:text-teal-200",
  amber: "border-amber-200/70 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200",
  rose: "border-rose-200/70 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200",
  indigo: "border-indigo-200/70 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500/25 dark:bg-indigo-500/12 dark:text-indigo-200",
  slate: "border-slate-200/70 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 dark:border-slate-600/40 dark:bg-slate-800/70 dark:text-slate-200",
};

const secondaryButtonClassName =
  "portal-action-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";

function isSeedPreviewResult(result: SystemToolRunResult | null) {
  return result?.toolId === "seed-cleanup" && result?.executed !== true;
}

function isSeedExecutionResult(result: SystemToolRunResult | null) {
  return result?.toolId === "seed-cleanup" && result?.executed === true;
}

function resultCardClassName(result: SystemToolRunResult) {
  if (isSeedExecutionResult(result)) {
    return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100";
  }

  if (isSeedPreviewResult(result)) {
    return result.preview?.safeToExecute
      ? "portal-warning-card"
      : "portal-danger-card";
  }

  if (/failed|blocked|restricted/i.test(result.status)) {
    return "portal-danger-card";
  }

  return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100";
}

function blockedReasons(preview: SeedCleanupPreview | null) {
  if (!preview) return [];
  return [
    ...(preview.blockedReasons ?? []),
    ...(preview.envWarnings ?? []),
    ...(preview.totalRecords === 0 ? ["No safely identifiable seed/demo records were found."] : []),
  ];
}

export default function AdminSystemTools() {
  const navigate = useNavigate();
  const { data, loading, error, setData, reload } = useAsyncData(() => adminOpsService.getSystemTools(), []);
  const tools = data ?? [];
  const [confirmTool, setConfirmTool] = useState<SystemToolRecord | null>(null);
  const [lastResult, setLastResult] = useState<SystemToolRunResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [runState, setRunState] = useState<{ running: boolean; error: string | null }>({ running: false, error: null });
  const [importState, setImportState] = useState<{ importing: boolean; error: string | null }>({ importing: false, error: null });
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [seedCleanupPreview, setSeedCleanupPreview] = useState<SeedCleanupPreview | null>(null);
  const [seedCleanupConfirmation, setSeedCleanupConfirmation] = useState("");
  const [seedCleanupBackupConfirmed, setSeedCleanupBackupConfirmed] = useState(false);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);
  const isSeedCleanupTool = confirmTool?.id === "seed-cleanup";
  const seedBlockedReasons = blockedReasons(seedCleanupPreview);
  const seedCleanupCanExecute = Boolean(seedCleanupPreview?.safeToExecute);
  const seedCleanupConfirmationValid =
    seedCleanupConfirmation.trim().toUpperCase() === seedCleanupPreview?.confirmationWord;
  const seedCleanupExecuteDisabledReason = !seedCleanupPreview
    ? null
    : !seedCleanupPreview.safeToExecute
      ? "Execution is blocked. No records can be deleted until all blockers are resolved."
      : !seedCleanupBackupConfirmed
        ? "Confirm that a fresh backup has been created and verified before executing cleanup."
        : !seedCleanupConfirmationValid
          ? `Type ${seedCleanupPreview.confirmationWord} to unlock the destructive action.`
          : null;

  useEffect(() => {
    if (!isSeedCleanupTool) {
      setSeedCleanupPreview(null);
      setSeedCleanupConfirmation("");
      setSeedCleanupBackupConfirmed(false);
    }
  }, [isSeedCleanupTool]);

  const closeConfirmModal = () => {
    setConfirmTool(null);
    setSeedCleanupPreview(null);
    setSeedCleanupConfirmation("");
    setSeedCleanupBackupConfirmed(false);
  };

  const handleRun = async () => {
    if (!confirmTool || runState.running) return;
    setLastResult(null);
    setResultModalOpen(false);
    setRunState({ running: true, error: null });
    try {
      const response = await adminOpsService.runSystemTool(
        confirmTool.id,
        isSeedCleanupTool
          ? seedCleanupPreview
            ? {
                mode: "execute",
                confirmation: seedCleanupConfirmation,
                backupConfirmed: seedCleanupBackupConfirmed,
              }
            : { mode: "preview" }
          : {},
      );
      setData(response.tools);
      setLastResult(response.result);
      if (confirmTool.id === "seed-cleanup") {
        setSeedCleanupPreview(response.result.preview ?? null);
        if (response.result.executed === true || response.result.status === "Completed") {
          setResultModalOpen(true);
          closeConfirmModal();
        }
      } else {
        setResultModalOpen(true);
        closeConfirmModal();
      }
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
      setResultModalOpen(true);
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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`font-bold text-[var(--text-strong)] ${loading || runState.running ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            System Tools
          </h1>
          <p className={`mt-0.5 text-sm text-[var(--text-muted)] ${loading || runState.running ? "opacity-80" : ""}`}>
            Operational tools for backup, maintenance, diagnostics, and exports.
          </p>
          <p className={`mt-1 text-xs text-[var(--text-subtle)] ${loading || runState.running ? "opacity-80" : ""}`}>
            {loading ? "Refreshing system tool status…" : `${tools.length} tool${tools.length === 1 ? "" : "s"} available`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            className={secondaryButtonClassName}
          >
            <FileText size={14} /> {importState.importing ? "Importing…" : "Import Backup"}
          </button>
          <button
            disabled={loading || runState.running || importState.importing}
            onClick={reload}
            className={secondaryButtonClassName}
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="portal-danger-card rounded-xl border px-4 py-3 text-sm font-medium">{error}</div>}
      {runState.error && <div className="portal-danger-card rounded-xl border px-4 py-3 text-sm font-medium">{runState.error}</div>}
      {importState.error && <div className="portal-danger-card rounded-xl border px-4 py-3 text-sm font-medium">{importState.error}</div>}


      <div className="portal-card rounded-2xl border p-5">
        <h2 className="text-sm font-bold text-[var(--text-strong)]">Backup and restore flow</h2>
        <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
          <p>Run Backup to generate a JSON snapshot package and download it for safekeeping.</p>
          <p>Use Import Backup to place a downloaded package back into the server backup library.</p>
          <p>
            Restore Backup always targets the newest package stored in{" "}
            <span className="font-semibold text-[var(--text-strong)]">backend/data/system-tools/backups</span>.
          </p>
        </div>
      </div>

      {runState.running && <div className="text-xs text-[var(--text-subtle)]">Running selected action…</div>}
      {loading && tools.length > 0 && <div className="text-xs text-[var(--text-subtle)]">Refreshing tool status…</div>}

      {loading && tools.length === 0 ? (
        <div className="portal-card rounded-xl border p-6 text-sm text-[var(--text-subtle)] shadow-[var(--shadow-soft)]">Loading system tools…</div>
      ) : tools.length === 0 ? (
        <div className="portal-card rounded-xl border border-dashed p-6 text-sm text-[var(--text-subtle)]">No system tools are configured right now.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {tools.map((tool) => {
            const Icon = iconMap[tool.id] ?? Database;
            const tone = toneMap[tool.tone] ?? toneMap.slate;
            return (
              <div key={tool.id} className="portal-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-[var(--text-strong)]">{tool.title}</h2>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{tool.desc}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tool.danger ? "border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200" : "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 dark:border-slate-600/40 dark:bg-slate-800/70 dark:text-slate-200"}`}>
                        {tool.status}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-[var(--text-subtle)]">Last run: {tool.lastRun}</p>
                      <button
                        onClick={() => setConfirmTool(tool)}
                        className={`rounded-xl px-3.5 py-2 text-xs font-bold text-white transition ${tool.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-800 hover:bg-blue-900"}`}
                      >
                        {tool.id === "seed-cleanup" ? "Preview Seed Cleanup" : tool.btn}
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
            closeConfirmModal();
          }
        }}
        title={isSeedCleanupTool ? "Seed Data Cleanup" : "Confirm Action"}
        description={isSeedCleanupTool ? "Preview first. Destructive execution stays locked until blockers are clear, a backup is verified, and the confirmation phrase is typed." : "Make sure the selected maintenance action is intentional before continuing."}
        size={isSeedCleanupTool ? "xl" : "md"}
        bodyClassName="space-y-4"
        footerClassName="items-stretch sm:items-center sm:justify-between"
        footer={
          <>
            <div className="min-h-5 text-xs text-[var(--text-muted)]">
              {isSeedCleanupTool && seedCleanupExecuteDisabledReason ? seedCleanupExecuteDisabledReason : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={closeConfirmModal}
                className="portal-action-secondary rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={
                  runState.running ||
                  (isSeedCleanupTool &&
                    Boolean(seedCleanupPreview) &&
                    (!seedCleanupCanExecute ||
                      !seedCleanupBackupConfirmed ||
                      !seedCleanupConfirmationValid))
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmTool?.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-800 hover:bg-blue-900"}`}
              >
                {runState.running
                  ? "Running…"
                  : isSeedCleanupTool
                    ? seedCleanupPreview
                      ? seedCleanupCanExecute
                        ? "Execute Seed Cleanup"
                        : "Execution Blocked"
                      : "Preview Seed Cleanup"
                    : "Confirm"}
              </button>
            </div>
          </>
        }
      >
        {confirmTool ? (
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${confirmTool.danger ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"}`}>
              <BootstrapIcon name="exclamation-triangle-fill" tone={confirmTool.danger ? "danger" : "primary"} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--text-muted)]">
                {isSeedCleanupTool ? "Seed cleanup is a guarded two-step operation." : "Run"}{" "}
                <span className="font-semibold text-[var(--text-strong)]">{confirmTool.title}</span>
                {!isSeedCleanupTool ? " now?" : null}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-subtle)]">
                {isSeedCleanupTool
                  ? "Preview Seed Cleanup only scans candidate seed/demo records. Execute Seed Cleanup is disabled until the preview is safe, a fresh backup is confirmed, and the exact phrase is typed."
                  : confirmTool.danger
                    ? "This tool can change or remove stored data. Confirm only if you intend to perform the operation immediately."
                    : "This tool will run immediately and update the latest system state when it completes."}
              </p>

              {isSeedCleanupTool && seedCleanupPreview ? (
                <div className={`mt-4 space-y-4 rounded-2xl border p-4 text-xs ${seedCleanupPreview.safeToExecute ? "portal-warning-card" : "portal-danger-card"}`}>
                  <div className="space-y-2">
                    <p className="text-sm font-bold">Seed Data Cleanup Preview</p>
                    <p className="font-semibold">
                      Status: {seedCleanupPreview.safeToExecute ? "Preview ready — no records deleted" : "Blocked — no records deleted"}
                    </p>
                    <p>
                      Cleanup has not been executed. The system only scanned candidate seed/demo data{seedCleanupPreview.safeToExecute ? "." : " and found blockers."}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <PreviewLine label="Last scan" value={new Date().toLocaleString()} />
                      <PreviewLine label="Cleanup executed" value="No" />
                      <PreviewLine label="Records deleted" value="0" />
                      <PreviewLine label="Backup required" value={seedCleanupPreview.backupRequired ? "Yes" : "No"} />
                    </div>
                  </div>

                  {seedBlockedReasons.length > 0 ? (
                    <div className="rounded-xl border border-current/20 bg-white/55 p-3 dark:bg-slate-950/25">
                      <p className="font-semibold">Blocked reason{seedBlockedReasons.length === 1 ? "" : "s"}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {seedBlockedReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <PreviewStat label="Users" value={seedCleanupPreview.counts.users} />
                    <PreviewStat label="Student Profiles" value={seedCleanupPreview.counts.studentProfiles} />
                    <PreviewStat label="Teacher Profiles" value={seedCleanupPreview.counts.teacherProfiles} />
                    <PreviewStat label="Subjects" value={seedCleanupPreview.counts.subjects} />
                    <PreviewStat label="Activities" value={seedCleanupPreview.counts.activities} />
                    <PreviewStat label="Groups" value={seedCleanupPreview.counts.groups} />
                    <PreviewStat label="Submissions" value={seedCleanupPreview.counts.submissions} />
                    <PreviewStat label="Notifications" value={seedCleanupPreview.counts.notifications} />
                    <PreviewStat label="Mail Jobs" value={seedCleanupPreview.counts.mailJobs} />
                  </div>

                  <PreviewList
                    label="User IDs"
                    values={seedCleanupPreview.users.map((user) =>
                      user.studentNumber
                        ? `${user.id} · ${user.studentNumber}`
                        : user.employeeId
                          ? `${user.id} · ${user.employeeId}`
                          : user.id,
                    )}
                  />
                  <PreviewList
                    label="Subject IDs"
                    values={seedCleanupPreview.subjects.map((subject) => `${subject.id} · ${subject.code}`)}
                  />
                  <PreviewList
                    label="Group IDs"
                    values={seedCleanupPreview.groups.map((group) => `${group.id} · ${group.name}`)}
                  />
                  <PreviewList
                    label="Submission IDs"
                    values={seedCleanupPreview.submissions.map((submission) => submission.id)}
                  />
                  <PreviewList
                    label="Notification IDs"
                    values={seedCleanupPreview.notifications.map((notification) => notification.id)}
                  />
                  <PreviewList
                    label="Mail Job IDs"
                    values={seedCleanupPreview.mailJobs.map((job) => job.id)}
                  />

                  <label className="flex items-start gap-3 rounded-xl border border-current/20 bg-white/55 px-3 py-3 text-xs dark:bg-slate-950/25">
                    <input
                      type="checkbox"
                      checked={seedCleanupBackupConfirmed}
                      disabled={!seedCleanupPreview.safeToExecute}
                      onChange={(event) => setSeedCleanupBackupConfirmed(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I created and verified a fresh backup before running this destructive cleanup.
                    </span>
                  </label>
                  <label className="block space-y-2">
                    <span className="font-semibold">
                      Type {seedCleanupPreview.confirmationWord} to confirm
                    </span>
                    <input
                      value={seedCleanupConfirmation}
                      disabled={!seedCleanupPreview.safeToExecute}
                      onChange={(event) => setSeedCleanupConfirmation(event.target.value)}
                      className="portal-input h-10 w-full rounded-xl px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </AppModal>

      <AppModal
        open={Boolean(lastResult) && resultModalOpen}
        onOpenChange={(open) => setResultModalOpen(open)}
        title={lastResult?.title || "System Tool Result"}
        description={lastResult?.summary || "The selected system tool completed."}
        size="lg"
        footer={(
          <>
            {lastResult?.toolId === "backup" ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  navigate("/admin/backups");
                }}
              >
                <Database size={14} /> View Backup History
              </button>
            ) : null}
            {lastResult?.artifactPath ? (
              <button
                type="button"
                disabled={artifactBusy}
                className={secondaryButtonClassName}
                onClick={() => handleDownloadArtifact(lastResult.artifactPath)}
              >
                <Download size={14} /> {artifactBusy ? "Downloading..." : "Download"}
              </button>
            ) : null}
            <button type="button" className={secondaryButtonClassName} onClick={() => setResultModalOpen(false)}>
              Close
            </button>
          </>
        )}
      >
        {lastResult ? (
          <div className={`max-h-[65vh] overflow-auto rounded-xl border p-4 text-sm ${resultCardClassName(lastResult)}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Status</p>
                <p className="mt-1 text-base font-bold">{lastResult.status}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Completed</p>
                <p className="mt-1 font-semibold">{new Date(lastResult.ranAt).toLocaleString()}</p>
              </div>
            </div>
            <p className="mt-4 font-semibold">{lastResult.summary}</p>
            {lastResult.details.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {lastResult.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {lastResult.artifactPath ? (
              <p className="mt-4 break-all font-mono text-xs opacity-80">{lastResult.artifactPath}</p>
            ) : null}
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

function SeedCleanupResultSummary({ result }: { result: SystemToolRunResult }) {
  const preview = result.preview;
  if (!preview) return null;
  const reasons = blockedReasons(preview);

  return (
    <div className="grid gap-2 rounded-xl border border-current/20 bg-white/45 p-3 text-xs dark:bg-slate-950/20 sm:grid-cols-2">
      <PreviewLine label="Last scan" value={new Date(result.ranAt).toLocaleString()} />
      <PreviewLine label="Cleanup executed" value={result.executed ? "Yes" : "No"} />
      <PreviewLine label="Records deleted" value={String(result.recordsDeleted ?? 0)} />
      {result.executedAt ? <PreviewLine label="Executed at" value={new Date(result.executedAt).toLocaleString()} /> : null}
      {result.executedBy ? <PreviewLine label="Executed by" value={result.executedBy} /> : null}
      {!result.executed && reasons.length > 0 ? (
        <div className="sm:col-span-2">
          <span className="font-semibold">Blocked reason:</span> {reasons.join(" | ")}
        </div>
      ) : null}
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-current/15 bg-white/45 px-3 py-2 dark:bg-slate-950/20">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-current/15 bg-white/45 px-3 py-2 dark:bg-slate-950/20">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function PreviewList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="font-semibold">{label}</p>
      <div className="max-h-32 overflow-auto rounded-xl border border-current/15 bg-white/55 px-3 py-2 font-mono text-[11px] dark:bg-slate-950/25">
        {values.slice(0, 30).map((value) => (
          <div key={value} className="break-all leading-5">
            {value}
          </div>
        ))}
        {values.length > 30 ? <div className="break-all leading-5">...and {values.length - 30} more</div> : null}
      </div>
    </div>
  );
}
