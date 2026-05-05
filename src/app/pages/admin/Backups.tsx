import {
  AlertTriangle,
  CalendarClock,
  Download,
  HardDriveDownload,
  History,
  Info,
  Lock,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PortalEmptyState, PortalHero, PortalPage, PortalPanel } from "../../components/portal/PortalPage";
import { AppModal } from "../../components/ui/app-modal";
import { Button } from "../../components/ui/button";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { BackupDetailResponse, BackupRunRecord, BackupSettingsResponse } from "../../lib/api/contracts";

type ConfirmAction =
  | { kind: "unprotect"; backup: BackupRunRecord }
  | { kind: "delete"; backup: BackupRunRecord }
  | { kind: "restore"; backup: BackupRunRecord };

type ManualBackupModal =
  | { state: "confirm" }
  | { state: "running" }
  | { state: "success"; backup: BackupRunRecord }
  | { state: "error"; message: string };

const defaultBackupSettings: BackupSettingsResponse = {
  enabled: false,
  frequency: "daily",
  timeOfDay: "02:00",
  timezone: "Asia/Manila",
  weeklyDay: 1,
  monthlyDay: 1,
  customIntervalHours: 24,
  retentionDays: 30,
  retentionCount: 10,
};

const weekDays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function formatBytes(value?: number | null) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString("en-US", { timeZoneName: "short" });
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200";
  }
  if (normalized === "RUNNING") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/12 dark:text-blue-200";
  }
  if (normalized === "FAILED") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600/40 dark:bg-slate-800/70 dark:text-slate-200";
}

function availabilityClass(available?: boolean) {
  if (available) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200";
}

function actionConfirmationWord(kind: ConfirmAction["kind"]) {
  if (kind === "unprotect") return "UNPROTECT BACKUP";
  if (kind === "delete") return "DELETE BACKUP";
  return "RESTORE BACKUP";
}

function actionDescription(action: ConfirmAction | null) {
  if (!action) return "";
  if (action.kind === "unprotect") {
    return "Removing protection allows later destructive actions on this backup. Type the confirmation phrase to continue.";
  }
  if (action.kind === "delete") {
    return "This retires the selected backup from history and removes its artifact from storage when present. Type the confirmation phrase to continue.";
  }
  return "Restore is destructive and is never started automatically. Type the confirmation phrase to continue. Before destructive recovery, take a database snapshot or pg_dump.";
}

function recordCountEntries(detail: BackupDetailResponse | null) {
  const manifestCounts = detail?.manifest && typeof detail.manifest === "object"
    ? (detail.manifest as { recordCounts?: Record<string, number> }).recordCounts
    : undefined;
  const counts = manifestCounts || detail?.recordCounts || {};
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
}

export default function AdminBackups() {
  const { data, loading, error, reload } = useAsyncData(() => adminService.getBackupHistory(), []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BackupDetailResponse | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [manualModal, setManualModal] = useState<ManualBackupModal | null>(null);
  const [settingsForm, setSettingsForm] = useState<BackupSettingsResponse>(defaultBackupSettings);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const rows = data?.rows ?? [];
  const backupSettings = data?.automaticSettings ?? settingsForm;
  const latestSuccessfulId = data?.latestSuccessful?.id ?? null;
  const selectedConfirmationWord = confirmAction ? actionConfirmationWord(confirmAction.kind) : "";
  const selectedConfirmationValid =
    confirmationInput.trim().toUpperCase() === selectedConfirmationWord;

  async function refreshWithMessage(nextMessage: string) {
    setMessage(nextMessage);
    await reload();
  }

  useEffect(() => {
    if (data?.automaticSettings) {
      setSettingsForm(data.automaticSettings);
    }
  }, [data?.automaticSettings]);

  async function handleRunBackup() {
    setBusyKey("run");
    setManualModal({ state: "running" });
    setMessage(null);
    setActionError(null);
    try {
      const created = await adminService.runBackupNow();
      setManualModal({ state: "success", backup: created });
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Backup creation failed.";
      setActionError(message);
      setManualModal({ state: "error", message });
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveSettings() {
    setSettingsBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const saved = await adminService.updateBackupSettings(settingsForm);
      setSettingsForm(saved);
      await refreshWithMessage("Automatic backup settings were saved.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to save automatic backup settings.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function openBackupDetail(row: BackupRunRecord) {
    setDetailOpen(true);
    setDetailBusy(true);
    setActionError(null);
    try {
      setDetail(await adminService.getBackupDetail(row.id));
    } catch (err) {
      setDetail(null);
      setActionError(err instanceof Error ? err.message : "Unable to load backup details.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleDownload(row: BackupRunRecord) {
    setBusyKey(`download-${row.id}`);
    setMessage(null);
    setActionError(null);
    try {
      await adminService.downloadBackup(row.id, row.fileName || undefined);
      setMessage(`Download started for ${row.fileName || row.id}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to download the selected backup.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProtect(row: BackupRunRecord, protectedValue: boolean) {
    if (!protectedValue) {
      setConfirmAction({ kind: "unprotect", backup: row });
      setConfirmationInput("");
      return;
    }
    setBusyKey(`protect-${row.id}`);
    setMessage(null);
    setActionError(null);
    try {
      await adminService.protectBackup(row.id, true);
      await refreshWithMessage(`${row.fileName || row.id} is now protected.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update backup protection.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitConfirmedAction() {
    if (!confirmAction || confirmBusy || !selectedConfirmationValid) return;
    setConfirmBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      if (confirmAction.kind === "unprotect") {
        await adminService.protectBackup(
          confirmAction.backup.id,
          false,
          actionConfirmationWord(confirmAction.kind),
        );
        await refreshWithMessage(`${confirmAction.backup.fileName || confirmAction.backup.id} is no longer protected.`);
      } else if (confirmAction.kind === "delete") {
        await adminService.deleteBackup(
          confirmAction.backup.id,
          actionConfirmationWord(confirmAction.kind),
        );
        await refreshWithMessage(`${confirmAction.backup.fileName || confirmAction.backup.id} was retired from Backup History.`);
      } else {
        await adminService.restoreBackup(
          confirmAction.backup.id,
          actionConfirmationWord(confirmAction.kind),
        );
        await refreshWithMessage("Restore request completed.");
      }
      setConfirmAction(null);
      setConfirmationInput("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Backup action failed.");
      await reload();
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="slate"
        eyebrow="Operations"
        title="Backups"
        description="Create and manage real application backup artifacts before destructive maintenance. App backups help with recovery, but take a database snapshot or pg_dump before cleanup or restore work."
        icon={ShieldCheck}
        meta={[
          { label: "Storage Provider", value: data?.storageProvider || "local" },
          { label: "Automatic Worker", value: data?.nextAutomaticBackup ? "Scheduled" : "Manual only" },
          { label: "Restore", value: data?.restoreSupported ? "Enabled" : "Manual-only safeguard" },
        ]}
        stats={[
          { label: "Backups", value: String(data?.totalBackups ?? 0), hint: "Visible backup records from backend metadata." },
          { label: "Failed", value: String(data?.failedBackups ?? 0), hint: "Failed runs are tracked and never shown as completed." },
          { label: "Storage Used", value: formatBytes(data?.storageUsedBytes), hint: "Total recorded artifact size from live history." },
          { label: "Latest Backup", value: data?.latestSuccessful?.completedAt ? formatDateTime(data.latestSuccessful.completedAt) : "None", hint: "Latest successful backup completion time." },
        ]}
        actions={(
          <>
            <Button type="button" variant="secondary" disabled={loading || Boolean(busyKey)} onClick={reload}>
              <RefreshCcw size={16} />
              Refresh
            </Button>
            <Button type="button" disabled={Boolean(busyKey)} onClick={() => setManualModal({ state: "confirm" })}>
              <ShieldCheck size={16} />
              {busyKey === "run" ? "Running..." : "Run Backup Now"}
            </Button>
          </>
        )}
      />

      {message ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
          {actionError}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
          {error}
        </div>
      ) : null}
      {data?.warnings?.length ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200">
          {data.warnings[0]}
        </div>
      ) : null}

      <PortalPanel
        title="Recovery Guidance"
        description="Use Backup History to confirm a fresh application backup exists before seed cleanup. The cleanup flow still requires its own manual backup acknowledgement and typed confirmation."
      >
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-[var(--text-body)] dark:border-slate-700/70 dark:bg-slate-900/70">
            <p className="font-semibold text-[var(--text-strong)]">Recommended before destructive cleanup</p>
            <p className="mt-2">1. Run Backup Now.</p>
            <p>2. Confirm the new backup is completed and downloadable.</p>
            <p>3. Take a database snapshot or pg_dump for production recovery.</p>
            <p>4. Return to Seed Data Cleanup and complete its separate backup acknowledgement.</p>
          </div>
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Restore is guarded</p>
                <p className="mt-2">
                  Automated restore remains blocked on this deployment. Download the selected artifact and use a verified database/provider recovery procedure instead of in-app restore automation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PortalPanel>

      <PortalPanel
        title="Automatic Backup Settings"
        description="Configure the persisted schedule used by the dedicated backup worker. Manual backups remain available at all times."
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm font-semibold text-[var(--text-strong)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:col-span-2">
              <span>Automatic Backups Enabled</span>
              <input
                type="checkbox"
                checked={settingsForm.enabled}
                onChange={(event) => setSettingsForm((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-5 w-5"
                aria-label="Automatic backups enabled"
              />
            </label>
            <SettingsSelect
              label="Frequency"
              value={settingsForm.frequency}
              onChange={(value) => setSettingsForm((current) => ({ ...current, frequency: value as BackupSettingsResponse["frequency"] }))}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "custom", label: "Custom interval" },
              ]}
            />
            <SettingsField
              label="Backup Time"
              type="time"
              value={settingsForm.timeOfDay}
              onChange={(value) => setSettingsForm((current) => ({ ...current, timeOfDay: value }))}
            />
            {settingsForm.frequency === "weekly" ? (
              <SettingsSelect
                label="Day of Week"
                value={String(settingsForm.weeklyDay)}
                onChange={(value) => setSettingsForm((current) => ({ ...current, weeklyDay: Number(value) }))}
                options={weekDays.map((day) => ({ value: String(day.value), label: day.label }))}
              />
            ) : null}
            {settingsForm.frequency === "monthly" ? (
              <SettingsField
                label="Day of Month"
                type="number"
                min={1}
                max={31}
                value={String(settingsForm.monthlyDay)}
                onChange={(value) => setSettingsForm((current) => ({ ...current, monthlyDay: Number(value) }))}
              />
            ) : null}
            {settingsForm.frequency === "custom" ? (
              <SettingsField
                label="Interval Hours"
                type="number"
                min={1}
                value={String(settingsForm.customIntervalHours)}
                onChange={(value) => setSettingsForm((current) => ({ ...current, customIntervalHours: Number(value) }))}
              />
            ) : null}
            <SettingsField
              label="Timezone"
              value={settingsForm.timezone}
              onChange={(value) => setSettingsForm((current) => ({ ...current, timezone: value }))}
            />
            <SettingsField
              label="Retention Days"
              type="number"
              min={1}
              value={String(settingsForm.retentionDays)}
              onChange={(value) => setSettingsForm((current) => ({ ...current, retentionDays: Number(value) }))}
            />
            <SettingsField
              label="Keep Last Backups"
              type="number"
              min={1}
              value={String(settingsForm.retentionCount)}
              onChange={(value) => setSettingsForm((current) => ({ ...current, retentionCount: Number(value) }))}
            />
            <div className="sm:col-span-2">
              <Button type="button" disabled={settingsBusy || loading} onClick={handleSaveSettings}>
                <CalendarClock size={16} />
                {settingsBusy ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-[var(--text-strong)]">Worker Status</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <StatusLine label="Worker" value={backupSettings.workerStatus || "disabled_by_environment"} />
              <StatusLine label="Next scheduled backup" value={formatDateTime(backupSettings.nextScheduledBackup)} />
              <StatusLine label="Last automatic backup" value={formatDateTime(backupSettings.lastAutomaticBackupAt)} />
              <StatusLine label="Last failure" value={backupSettings.lastAutomaticFailureReason || "None"} />
              <StatusLine label="Storage provider" value={backupSettings.storageProvider || data?.storageProvider || "local"} />
            </dl>
            <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
              The API process only schedules backups when BACKUP_WORKER_ENABLED=true. Run one dedicated worker process for automatic backups in production.
            </p>
          </div>
        </div>
      </PortalPanel>

      <PortalPanel
        title="Backup History"
        description="Live backup rows from backend metadata. New completed backups appear here immediately after a successful run and remain visible after reload."
      >
        {loading && rows.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-[20px] bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <PortalEmptyState
            title="No backups recorded yet"
            description="Run Backup Now to create the first live backup artifact and populate Backup History."
            icon={History}
            className="border-slate-200 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/70"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-700/60">
                  {["Status", "Trigger", "Type", "Created Time", "Size", "Storage", "Protected", "Actions"].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
                {rows.map((row) => {
                  const downloadDisabled = !row.artifactAvailable || row.status !== "COMPLETED";
                  const deleteDisabled =
                    row.status === "RUNNING" || row.isProtected || latestSuccessfulId === row.id;

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.status)}`}>
                            {row.status}
                          </span>
                          <div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${availabilityClass(row.artifactAvailable)}`}>
                              {row.artifactAvailable ? "Artifact Ready" : "Artifact Missing"}
                            </span>
                          </div>
                          {row.warnings?.length ? (
                            <p className="max-w-[18rem] text-xs leading-5 text-amber-700 dark:text-amber-200">
                              {row.warnings[0]}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-body)]">{row.trigger}</td>
                      <td className="px-4 py-4 text-[var(--text-body)]">{row.backupType}</td>
                      <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                        {formatDateTime(row.completedAt || row.startedAt)}
                      </td>
                      <td className="px-4 py-4 text-xs text-[var(--text-muted)]">{formatBytes(row.sizeBytes)}</td>
                      <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                        <p className="font-medium text-[var(--text-body)]">{row.storageProvider || row.storage}</p>
                        <p className="mt-1 break-all">{row.fileName || "No file name"}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${row.isProtected ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600/40 dark:bg-slate-800/70 dark:text-slate-300"}`}>
                          {row.isProtected ? "Protected" : "Unlocked"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`View backup details for ${row.fileName || row.id}`}
                            onClick={() => openBackupDetail(row)}
                          >
                            <Info size={14} />
                            Details
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={downloadDisabled || busyKey === `download-${row.id}`}
                            aria-label={`Download backup ${row.fileName || row.id}`}
                            onClick={() => handleDownload(row)}
                          >
                            <Download size={14} />
                            {busyKey === `download-${row.id}` ? "Downloading..." : "Download"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyKey === `protect-${row.id}`}
                            aria-label={`${row.isProtected ? "Unprotect" : "Protect"} backup ${row.fileName || row.id}`}
                            onClick={() => handleProtect(row, !row.isProtected)}
                          >
                            {row.isProtected ? <Unlock size={14} /> : <Lock size={14} />}
                            {row.isProtected ? "Unprotect" : "Protect"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deleteDisabled}
                            aria-label={`Delete backup ${row.fileName || row.id}`}
                            onClick={() => {
                              setConfirmAction({ kind: "delete", backup: row });
                              setConfirmationInput("");
                            }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={row.status !== "COMPLETED"}
                            aria-label={`Restore backup ${row.fileName || row.id}`}
                            onClick={() => {
                              setConfirmAction({ kind: "restore", backup: row });
                              setConfirmationInput("");
                            }}
                          >
                            <RotateCcw size={14} />
                            Restore
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PortalPanel>

      <AppModal
        open={Boolean(manualModal)}
        onOpenChange={(open) => {
          if (!open && manualModal?.state !== "running") {
            setManualModal(null);
          }
        }}
        title={
          manualModal?.state === "running"
            ? "Running backup"
            : manualModal?.state === "success"
              ? "Backup completed"
              : manualModal?.state === "error"
                ? "Backup failed"
                : "Run backup now?"
        }
        description={
          manualModal?.state === "success"
            ? "The new backup file and durable history row were created."
            : manualModal?.state === "error"
              ? "The backend recorded a safe error for this backup attempt."
              : "Create a full backup artifact and add it to Backup History."
        }
        size="lg"
        footer={(
          <>
            {manualModal?.state === "confirm" ? (
              <>
                <Button type="button" variant="outline" onClick={() => setManualModal(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleRunBackup}>
                  Confirm
                </Button>
              </>
            ) : manualModal?.state === "running" ? (
              <Button type="button" disabled>
                Running...
              </Button>
            ) : manualModal?.state === "success" ? (
              <>
                <Button type="button" variant="outline" onClick={() => setManualModal(null)}>
                  View Backup History
                </Button>
                <Button
                  type="button"
                  disabled={manualModal.backup.status !== "COMPLETED" || manualModal.backup.artifactAvailable === false}
                  onClick={() => handleDownload(manualModal.backup)}
                >
                  <Download size={16} />
                  Download
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setManualModal(null)}>
                Close
              </Button>
            )}
          </>
        )}
      >
        {manualModal?.state === "running" ? (
          <div className="space-y-3">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">Collecting live records, writing the artifact, and creating history metadata.</p>
          </div>
        ) : manualModal?.state === "success" ? (
          <div className="grid gap-3 text-sm text-[var(--text-body)]">
            <StatusLine label="Created" value={formatDateTime(manualModal.backup.completedAt || manualModal.backup.startedAt)} />
            <StatusLine label="File name" value={manualModal.backup.fileName || manualModal.backup.id} />
            <StatusLine label="Size" value={formatBytes(manualModal.backup.sizeBytes)} />
            <StatusLine label="Storage provider" value={manualModal.backup.storageProvider || manualModal.backup.storage || "local"} />
          </div>
        ) : manualModal?.state === "error" ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
            {manualModal.message}
          </div>
        ) : (
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm text-[var(--text-body)] dark:border-slate-700/70 dark:bg-slate-900/70">
            Run a full backup now? The backup will be written to the configured storage provider and immediately appear in Backup History.
          </div>
        )}
      </AppModal>

      <AppModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetail(null);
            setDetailBusy(false);
          }
        }}
        title={detail?.fileName || "Backup Details"}
        description="Real metadata from backend history and artifact manifest."
        size="wide"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            {detail ? (
              <Button
                type="button"
                onClick={() => handleDownload(detail)}
                disabled={!detail.artifactAvailable}
              >
                <HardDriveDownload size={16} />
                Download Backup
              </Button>
            ) : null}
          </>
        )}
      >
        {detailBusy ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-[20px] bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-40 animate-pulse rounded-[20px] bg-slate-100 dark:bg-slate-800/70" />
          </div>
        ) : !detail ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
            Backup details are unavailable.
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Status", value: detail.status },
                { label: "Created", value: formatDateTime(detail.completedAt || detail.startedAt) },
                { label: "Size", value: formatBytes(detail.sizeBytes) },
                { label: "Storage", value: detail.storageProvider || detail.storage },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
                <p className="text-sm font-semibold text-[var(--text-strong)]">Metadata</p>
                <dl className="mt-4 grid gap-3 text-sm text-[var(--text-body)]">
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">File Name</dt>
                    <dd className="break-all">{detail.fileName || "Unavailable"}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Artifact Path</dt>
                    <dd className="break-all">{detail.artifactPath || "Unavailable"}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">SHA-256</dt>
                    <dd className="break-all">{detail.sha256 || "Unavailable"}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Expires</dt>
                    <dd>{formatDateTime(detail.expiresAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
                <p className="text-sm font-semibold text-[var(--text-strong)]">Artifact State</p>
                <div className="mt-4 space-y-3 text-sm text-[var(--text-body)]">
                  <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${availabilityClass(detail.artifactAvailable)}`}>
                    {detail.artifactAvailable ? "Artifact available" : "Artifact unavailable"}
                  </div>
                  <p>
                    {detail.restoreSupported
                      ? "Automated restore is enabled."
                      : detail.restoreUnsupportedReason}
                  </p>
                  {detail.warnings?.length ? (
                    <ul className="space-y-2">
                      {detail.warnings.map((warning) => (
                        <li key={warning} className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-[var(--text-strong)]">Manifest Record Counts</p>
              {recordCountEntries(detail).length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-muted)]">No record count metadata is available for this backup.</p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {recordCountEntries(detail).map(([key, value]) => (
                    <div key={key} className="rounded-[18px] border border-slate-200/70 bg-white px-3 py-3 dark:border-slate-700/60 dark:bg-slate-950/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{key}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AppModal>

      <AppModal
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!confirmBusy && !open) {
            setConfirmAction(null);
            setConfirmationInput("");
          }
        }}
        title={
          confirmAction?.kind === "delete"
            ? `Delete ${confirmAction.backup.fileName || "backup"}?`
            : confirmAction?.kind === "unprotect"
              ? `Unprotect ${confirmAction.backup.fileName || "backup"}?`
              : `Restore ${confirmAction?.backup.fileName || "backup"}?`
        }
        description={actionDescription(confirmAction)}
        size="lg"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              disabled={confirmBusy}
              onClick={() => {
                setConfirmAction(null);
                setConfirmationInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmAction?.kind === "restore" || confirmAction?.kind === "delete" ? "destructive" : "default"}
              disabled={!selectedConfirmationValid || confirmBusy}
              onClick={submitConfirmedAction}
            >
              {confirmBusy ? "Working..." : confirmAction?.kind === "restore" ? "Confirm Restore" : confirmAction?.kind === "delete" ? "Confirm Delete" : "Confirm Unprotect"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-5">
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm text-[var(--text-body)] dark:border-slate-700/70 dark:bg-slate-900/70">
            <p className="font-semibold text-[var(--text-strong)]">{confirmAction?.backup.fileName || confirmAction?.backup.id}</p>
            <p className="mt-2">Status: {confirmAction?.backup.status || "Unavailable"}</p>
            <p className="mt-1">Created: {formatDateTime(confirmAction?.backup.completedAt || confirmAction?.backup.startedAt)}</p>
            {confirmAction?.kind === "restore" ? (
              <p className="mt-3 text-amber-800 dark:text-amber-200">
                Restore is destructive and remains disabled for automated execution on this deployment.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Type {selectedConfirmationWord} to continue
            </label>
            <input
              aria-label="Backup action confirmation"
              value={confirmationInput}
              onChange={(event) => setConfirmationInput(event.target.value)}
              placeholder={selectedConfirmationWord}
              className="portal-input h-12 w-full rounded-[22px] px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>
      </AppModal>
    </PortalPage>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="portal-input h-11 rounded-[18px] px-3 text-sm outline-none"
      />
    </label>
  );
}

function SettingsSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="portal-input h-11 rounded-[18px] px-3 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold text-[var(--text-strong)]">{value}</dd>
    </div>
  );
}
