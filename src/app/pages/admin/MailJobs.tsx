import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { CopyableIdChip } from "../../components/lists/shared/CopyableIdChip";
import { PortalPage } from "../../components/portal/PortalPage";
import { AppModal } from "../../components/ui/app-modal";
import type { MailJobRecord, MailRuntimeStatus } from "../../lib/api/contracts";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { BootstrapIcon, BootstrapIconButton, BootstrapIconTooltip, type BootstrapIconName, type BootstrapIconTone } from "../../components/ui/bootstrap-icon";

function statusClasses(status: string) {
  if (status === "sent") return "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "processing") return "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 dark:border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300";
  if (status === "dead" || status === "cancelled") return "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300";
  if (status === "failed") return "bg-amber-50 dark:bg-amber-500/15 text-amber-800 border-amber-200 dark:border-amber-500/30 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 dark:border-slate-600/40 dark:bg-slate-800/70 dark:text-slate-200";
}

function alertClasses(severity: "info" | "warning" | "error") {
  if (severity === "error") {
    return "border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300";
  }
  if (severity === "warning") {
    return "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300";
}

function statusIcon(status: string): { icon: BootstrapIconName; tone: BootstrapIconTone; label: string } {
  if (status === "sent") return { icon: "envelope-check-fill", tone: "success", label: "Sent: provider accepted this email" };
  if (status === "processing") return { icon: "hourglass-split", tone: "info", label: "Processing: the worker is sending this job" };
  if (status === "queued") return { icon: "envelope-fill", tone: "info", label: "Queued: waiting for the mail worker" };
  if (status === "failed") return { icon: "exclamation-triangle-fill", tone: "warning", label: "Failed: retry may be available after checking the diagnostic" };
  if (status === "dead" || status === "cancelled") return { icon: "x-circle-fill", tone: "danger", label: `${status}: this job will not send unless recovered` };
  if (status === "archived") return { icon: "archive-fill", tone: "muted", label: "Archived mail job" };
  return { icon: "info-circle-fill", tone: "secondary", label: `${status || "Unknown"} mail job status` };
}

function alertIcon(severity: "info" | "warning" | "error"): { icon: BootstrapIconName; tone: BootstrapIconTone; label: string } {
  if (severity === "error") return { icon: "x-circle-fill", tone: "danger", label: "Mail system error" };
  if (severity === "warning") return { icon: "exclamation-triangle-fill", tone: "warning", label: "Mail system warning" };
  return { icon: "info-circle-fill", tone: "info", label: "Mail system information" };
}

function formatStatusTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dedicatedWorkerLabel(status: MailRuntimeStatus | null) {
  if (status?.dedicatedWorkerHealthy ?? status?.workerHealthy) return "Dedicated worker fresh";
  if (status?.heartbeatProviderMatches === false) return "Provider mismatch";
  if (typeof status?.workerHeartbeatAgeSeconds === "number") return "Dedicated worker stale";
  return "Dedicated worker not running";
}

function apiWorkerLabel(status: MailRuntimeStatus | null) {
  if (status?.apiProcessWorkerEnabled ?? status?.workerEnabled) {
    return status?.apiProcessWorkerRunning ?? status?.workerRunning ? "Enabled in API process" : "Enabled but idle";
  }
  return "Disabled in API process";
}

function deliveryLabel(status: MailRuntimeStatus | null) {
  if (status?.realDeliveryActive) return "Real delivery active";
  if (status?.provider === "stub") return "Local stub only";
  if (status?.provider === "mailrelay") return "Mailrelay waiting on readiness";
  return "Not ready";
}

function recipientLabel(row: MailJobRecord) {
  if (row.recipient?.isExternal) return "External recipient";
  return row.recipient?.fullName || row.recipient?.email || row.to;
}

function recipientIdLabel(row: MailJobRecord) {
  const role = String(row.recipient?.role ?? "").toUpperCase();
  if (role === "STUDENT" && row.recipient?.studentId) {
    return `Student ID: ${row.recipient.studentId}`;
  }
  const teacherId = row.recipient?.teacherId || row.recipient?.employeeId;
  if (role === "TEACHER" && teacherId) {
    return `Teacher ID: ${teacherId}`;
  }
  return null;
}

function canRetry(row: MailJobRecord) {
  return row.status === "failed" || row.status === "dead";
}

function canCancel(row: MailJobRecord) {
  return row.status === "queued";
}

function canArchive(row: MailJobRecord) {
  return row.status === "sent" || row.status === "dead" || row.status === "cancelled";
}

function needsForceRetry(row: MailJobRecord) {
  return row.status === "dead" && row.retryableFailure !== true;
}

export default function AdminMailJobs() {
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [pageVisible, setPageVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  const { data, loading, error: loadError, reload } = useAsyncData(async () => {
    const [jobs, status] = await Promise.all([
      adminService.getMailJobs(showArchived),
      adminService.getMailRuntimeStatus(),
    ]);
    return { jobs, status };
  }, [showArchived]);

  useEffect(() => {
    if (!data) return;
    setLastUpdatedAt(new Date());
  }, [data]);

  useEffect(() => {
    const handleVisibility = () => {
      setPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    const timer = window.setInterval(() => {
      reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pageVisible, reload]);

  const rows = data?.jobs ?? [];
  const status = data?.status ?? null;
  const senderConfig = status?.senderConfig;
  const retryableRows = useMemo(
    () => rows.filter((row) => canRetry(row)).map((row) => row.id),
    [rows],
  );

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => retryableRows.includes(id)));
  }, [retryableRows]);

  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const selectedNeedForce = selectedRows.some((row) => needsForceRetry(row));
  const dedicatedWorkerHealthy = Boolean(status?.dedicatedWorkerHealthy ?? status?.workerHealthy);
  const providerNotice =
    status?.provider === "stub"
      ? "Local stub provider active; no real email delivery. SENT means the stub provider accepted and logged the job locally."
      : status?.provider === "mailrelay"
        ? "Mailrelay provider active. SENT means Mailrelay accepted the job after the dedicated worker sent it."
        : "Mail provider is not ready for production delivery.";

  const summaryCards = [
    { label: "Active provider", value: status?.provider ?? "—", tone: "text-slate-700 dark:text-slate-200" },
    {
      label: "API worker flag",
      value: apiWorkerLabel(status),
      tone: (status?.apiProcessWorkerEnabled ?? status?.workerEnabled) ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-200",
    },
    {
      label: "Dedicated worker",
      value: dedicatedWorkerLabel(status),
      tone: dedicatedWorkerHealthy ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
    },
    {
      label: "Heartbeat age",
      value:
        typeof status?.workerHeartbeatAgeSeconds === "number"
          ? `${status.workerHeartbeatAgeSeconds}s`
          : "—",
      tone: dedicatedWorkerHealthy ? "text-slate-700 dark:text-slate-200" : "text-rose-700 dark:text-rose-300",
    },
    {
      label: "Real delivery",
      value: deliveryLabel(status),
      tone: status?.realDeliveryActive ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
    },
    { label: "Queue depth", value: String(status?.queueDepth ?? 0), tone: "text-amber-700 dark:text-amber-300" },
    { label: "Queued too long", value: String(status?.queuedTooLongCount ?? 0), tone: "text-amber-700 dark:text-amber-300" },
    { label: "Processing too long", value: String(status?.processingTooLongCount ?? 0), tone: "text-rose-700 dark:text-rose-300" },
    { label: "Sent (24h)", value: String(status?.sent24h ?? 0), tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Failed", value: String(status?.failedCount ?? 0), tone: "text-amber-700 dark:text-amber-300" },
    { label: "Dead", value: String(status?.deadCount ?? 0), tone: "text-rose-700 dark:text-rose-300" },
    { label: "Latest safe error", value: status?.latestSafeProviderError || status?.recentFailureSafeMessage || "None", tone: status?.latestSafeProviderError || status?.recentFailureSafeMessage ? "text-rose-700 dark:text-rose-300" : "text-slate-700 dark:text-slate-200" },
  ];

  const handleRetry = (row: MailJobRecord) => {
    const force = needsForceRetry(row);
    const execute = async () => {
      setRetryingId(row.id);
      setError(null);
      try {
        await adminService.retryMailJob(row.id, force);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to retry the selected mail job.");
      } finally {
        setRetryingId(null);
      }
    };
    if (force) {
      setPendingConfirm({
        title: "Confirm Force Retry",
        message: "This job is marked non-retryable. Confirm the provider or recipient issue is fixed before forcing a retry.",
        onConfirm: () => { void execute(); },
      });
      return;
    }
    void execute();
  };

  const handleRetrySelected = () => {
    if (!selectedIds.length) return;
    const execute = async () => {
      setError(null);
      try {
        const result = (await adminService.retryMailJobs(selectedIds, selectedNeedForce)) as {
          blockedCount: number;
        };
        if (result.blockedCount) {
          setError(`${result.blockedCount} selected job(s) were blocked from retrying.`);
        } else {
          setSelectedIds([]);
        }
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to retry the selected mail jobs.");
      }
    };
    if (selectedNeedForce) {
      setPendingConfirm({
        title: "Confirm Force Retry",
        message: "At least one selected job is marked non-retryable. Confirm the provider or recipient issue is fixed before forcing these retries.",
        onConfirm: () => { void execute(); },
      });
      return;
    }
    void execute();
  };

  const handleCancel = (row: MailJobRecord) => {
    setPendingConfirm({
      title: "Cancel Mail Job",
      message: "Cancel this queued mail job?",
      onConfirm: () => {
        void (async () => {
          setActingId(row.id);
          setError(null);
          try {
            await adminService.cancelMailJob(row.id);
            await reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to cancel the selected mail job.");
          } finally {
            setActingId(null);
          }
        })();
      },
    });
  };

  const handleArchive = async (row: MailJobRecord) => {
    setActingId(row.id);
    setError(null);
    try {
      await adminService.archiveMailJob(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive the selected mail job.");
    } finally {
      setActingId(null);
    }
  };

  const handleArchiveOld = () => {
    setPendingConfirm({
      title: "Archive Old Mail Jobs",
      message: "Archive sent, dead, and cancelled mail jobs older than 30 days? This only hides jobs from the default view; it does not remove recipients from Mailrelay bounce or suppression lists.",
      onConfirm: () => {
        void (async () => {
          setError(null);
          try {
            await adminService.archiveOldMailJobs(30);
            await reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to archive older mail jobs.");
          }
        })();
      },
    });
  };

  const handleSendTest = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setTestResult(null);
    try {
      const result = await adminService.sendTestMail(testEmail);
      if (!result.jobId) {
        throw new Error("Mail queue did not return a confirmed MailJob ID. No success message was shown.");
      }
      setTestResult(`${result.detail || "Queued. Waiting for mail worker."} Provider: ${result.provider}; MailJob ${result.jobId}.`);
      setTestEmail("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue the test email.");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === retryableRows.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(retryableRows);
  };

  return (
    <PortalPage className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={`text-slate-900 dark:text-slate-100 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem" }}>
            Mail Jobs
          </h1>
          <p className={`text-slate-400 dark:text-slate-300 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>
            Mailrelay-backed queue visibility, worker health, and safe recovery actions.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-300">
            <span>{pageVisible ? "Live" : "Paused"}</span>
            <span>Last updated: {lastUpdatedAt ? formatStatusTime(lastUpdatedAt.toISOString()) : "—"}</span>
            <span>{loading ? "Refreshing…" : `${rows.length} visible job${rows.length === 1 ? "" : "s"}`}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 dark:border-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show archived
          </label>
          <BootstrapIconButton
            type="button"
            onClick={handleArchiveOld}
            icon="archive-fill"
            tone="muted"
            label="Archive old completed mail jobs"
            tooltip="Archive sent, dead, and cancelled jobs older than 30 days. This does not remove recipients from Mailrelay bounce or suppression lists."
            size="md"
          >
            Archive old
          </BootstrapIconButton>
          <BootstrapIconButton
            disabled={loading}
            onClick={reload}
            icon="arrow-clockwise"
            tone="primary"
            label="Refresh mail jobs"
            tooltip="Refresh queue status, worker health, and visible mail jobs."
            size="md"
          >
            Refresh
          </BootstrapIconButton>
        </div>
      </div>

      {loadError && <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"><BootstrapIcon name="x-circle-fill" tone="danger" size={16} className="mt-0.5 shrink-0" /> <span>{loadError}</span></div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"><BootstrapIcon name="x-circle-fill" tone="danger" size={16} className="mt-0.5 shrink-0" /> <span>{error}</span></div>}
      {testResult && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"><BootstrapIcon name="envelope-check-fill" tone="success" size={16} className="mt-0.5 shrink-0" /> <span>{testResult}</span></div>}
      {status && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${status.provider === "stub" ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>
          <BootstrapIcon name={status.provider === "stub" ? "info-circle-fill" : "shield-check"} tone={status.provider === "stub" ? "info" : "success"} size={16} className="mt-0.5 shrink-0" />
          <span>{providerNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(status?.alerts ?? []).map((alert) => (
          <div key={`${alert.code}-${alert.message}`} className={`rounded-xl border px-4 py-3 text-sm ${alertClasses(alert.severity)}`}>
            <div className="flex items-start gap-2">
              {(() => {
                const semantic = alertIcon(alert.severity);
                return (
                  <BootstrapIconTooltip label={semantic.label}>
                    <BootstrapIcon name={semantic.icon} tone={semantic.tone} size={16} className="mt-0.5" />
                  </BootstrapIconTooltip>
                );
              })()}
              <span>{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${loading ? "opacity-80" : ""}`}>
        {summaryCards.map((item) => (
          <div key={item.label} className="portal-card rounded-xl border p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-300">{item.label}</p>
            <p className={`mt-1 break-words text-sm font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="portal-card rounded-lg border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">Mailrelay Sender Checklist</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
              In stub mode, SENT means local acceptance/logging only. In Mailrelay mode, SENT means Mailrelay accepted the email after the dedicated worker sent it.
            </p>
          </div>
          {status?.senderConfigIssues?.length ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {status.senderConfigIssues[0]}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Active provider", value: status?.provider ?? "—" },
            { label: "API process worker flag", value: apiWorkerLabel(status) },
            { label: "Dedicated worker heartbeat", value: dedicatedWorkerLabel(status) },
            { label: "Dedicated worker provider", value: status?.dedicatedWorkerProvider ?? "—" },
            { label: "Worker heartbeat", value: formatStatusTime(status?.workerLastHeartbeatAt ?? null) },
            { label: "Real delivery", value: deliveryLabel(status) },
            { label: "Delivery mode", value: status?.deliveryMode ?? (status?.provider === "stub" ? "local_stub" : "—") },
            { label: "Account/reset sender", value: senderConfig?.noreply ?? "—" },
            { label: "Notification sender", value: senderConfig?.notification ?? "—" },
            { label: "Invite sender", value: senderConfig?.invite ?? "—" },
            { label: "Admin sender", value: senderConfig?.admin ?? "—" },
            { label: "Support sender", value: senderConfig?.support ?? "—" },
            { label: "Latest sent", value: formatStatusTime(status?.latestSentAt ?? null) },
            { label: "Latest safe error", value: status?.latestSafeProviderError || status?.recentFailureSafeMessage || "—" },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="font-medium text-slate-400 dark:text-slate-300">{item.label}</div>
              <div className="mt-0.5 break-words font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 dark:text-amber-200">
          <BootstrapIconTooltip label="Sender configuration hint"><BootstrapIcon name="shield-exclamation" tone="warning" size={14} className="mt-0.5" /></BootstrapIconTooltip>
          <span>If SENDER_NOT_CONFIRMED appears, confirm the sender in Mailrelay. Keep account mail on support@projtrack.codes, classroom notifications on notification@projtrack.codes, and admin/system mail on admin@projtrack.codes.</span>
        </div>
      </div>

      <form onSubmit={handleSendTest} className="portal-card flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="min-w-[18rem] flex-1 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">Queue Test Email</span>
          <input
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            type="email"
            required
            placeholder="recipient@example.com"
            className="portal-input h-10 w-full rounded-xl border px-3 text-sm"
          />
        </label>
        <BootstrapIconButton
          type="submit"
          icon="send-fill"
          tone="primary"
          label="Queue test email"
          tooltip="Queues a test MailJob. The UI only shows success after the backend returns a confirmed MailJob ID."
          size="md"
          className="h-10 border-blue-800 bg-blue-800 text-white hover:bg-blue-900 dark:border-blue-600 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
        >
          Send Test
        </BootstrapIconButton>
      </form>

      <div className="portal-card rounded-xl border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
            Selected retryable jobs: <span className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">{selectedIds.length}</span>
          </div>
          <BootstrapIconButton
            type="button"
            disabled={!selectedIds.length}
            onClick={handleRetrySelected}
            icon="arrow-counterclockwise"
            tone={selectedNeedForce ? "warning" : "primary"}
            label="Retry selected mail jobs"
            tooltip={!selectedIds.length ? "Select retryable failed or dead jobs first." : selectedNeedForce ? "One or more selected jobs need explicit force retry confirmation." : "Retry the selected failed mail jobs."}
            size="md"
          >
            Retry selected
          </BootstrapIconButton>
        </div>
      </div>

      <div className={`portal-card overflow-x-auto rounded-xl border shadow-sm ${loading ? "opacity-80" : ""}`}>
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="portal-border portal-table-header border-b">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={retryableRows.length > 0 && selectedIds.length === retryableRows.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              {["Recipient", "Template", "Status", "Attempts", "Timing", "Provider / Failure", "Actions"].map((header) => (
                <th key={header} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 dark:divide-slate-800/70">
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4" colSpan={8}>
                    <div className="h-7 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-300">
                  No mail jobs for the current view.
                </td>
              </tr>
            ) : rows.map((row) => {
              const selected = selectedIds.includes(row.id);
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className={loading ? "opacity-80" : "portal-table-row"}>
                    <td className="px-5 py-3.5 align-top">
                      {canRetry(row) ? (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(row.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex items-center gap-2">
                        <BootstrapIconTooltip label="Mail job recipient">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80">
                            <BootstrapIcon name="envelope-fill" tone="secondary" size={14} />
                          </div>
                        </BootstrapIconTooltip>
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{recipientLabel(row)}</div>
                          {recipientIdLabel(row) && (
                            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-300">{recipientIdLabel(row)}</div>
                          )}
                          {row.recipient?.role && (
                            <div className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:text-slate-300">
                              {row.recipient.role}
                            </div>
                          )}
                          <div className="break-all text-[10px] text-slate-400 dark:text-slate-300">{row.recipient?.email || row.to}</div>
                          <CopyableIdChip value={row.id} label="Copy Mail Job ID" className="bg-transparent px-0" />
                          {row.routedToTestmail && (
                            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300">
                              Routed to testmail
                            </div>
                          )}
                          {row.deliveryRecipient && row.deliveryRecipient !== row.to && (
                            <div className="break-all text-[10px] text-slate-400 dark:text-slate-300">Delivery recipient: {row.deliveryRecipient}</div>
                          )}
                          {row.archivedAt && (
                            <div className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                              Archived {row.archivedAt}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{row.template}</td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="space-y-1">
                        {(() => {
                          const semantic = statusIcon(row.status);
                          return (
                            <BootstrapIconTooltip label={semantic.label}>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
                                <BootstrapIcon name={semantic.icon} tone={semantic.tone} size={11} />
                                {row.status}
                              </span>
                            </BootstrapIconTooltip>
                          );
                        })()}
                        {needsForceRetry(row) ? (
                          <div className="text-[10px] text-rose-600">Needs confirmation</div>
                        ) : row.retryableFailure ? (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300">Retryable failure</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <div className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">{`${row.attempts ?? 0}/${row.maxAttempts ?? "—"}`}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-300">{row.failureReason || "No failure reason"}</div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <div>Created: {row.createdAt}</div>
                      <div>Last try: {row.lastAttemptAt ?? "—"}</div>
                      <div>Next try: {row.nextAttemptAt ?? "—"}</div>
                      <div>Sent: {row.sentAt ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <div className="font-medium text-slate-700 dark:text-slate-200 dark:text-slate-100">{row.provider ?? "—"}</div>
                      {row.fromEmail && <div className="text-[10px] text-slate-400 dark:text-slate-300">From: {row.fromEmail}</div>}
                      {row.providerMessageId ? (
                        <div className="mt-1">
                          <CopyableIdChip value={row.providerMessageId} label="Copy Provider Message ID" className="bg-transparent px-0" />
                        </div>
                      ) : null}
                      {row.lastError ? (
                        <div className="mt-1 flex max-w-[280px] items-start gap-1.5 text-[10px] text-rose-600 dark:text-rose-300">
                          <BootstrapIconTooltip label="Safe provider error diagnostic. Secrets and raw payloads are hidden.">
                            <BootstrapIcon name="x-circle-fill" tone="danger" size={11} className="mt-0.5" />
                          </BootstrapIconTooltip>
                          <span title={row.lastError}>{row.lastError}</span>
                        </div>
                      ) : null}
                      {row.failureHint ? (
                        <div className="mt-1 flex max-w-[280px] items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                          <BootstrapIconTooltip label="Recommended recovery hint">
                            <BootstrapIcon name="info-circle-fill" tone="warning" size={11} className="mt-0.5" />
                          </BootstrapIconTooltip>
                          <span>{row.failureHint}</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs">
                      <div className="flex flex-wrap gap-2">
                        {canRetry(row) ? (
                          <BootstrapIconButton
                            disabled={retryingId === row.id}
                            onClick={() => handleRetry(row)}
                            icon="arrow-counterclockwise"
                            tone={needsForceRetry(row) ? "warning" : "primary"}
                            label={needsForceRetry(row) ? "Force retry mail job" : "Retry mail job"}
                            tooltip={needsForceRetry(row) ? "This job is marked non-retryable. Confirm the provider issue is fixed before forcing retry." : "Retry this failed mail job."}
                            size="sm"
                          >
                            {retryingId === row.id ? "Retrying…" : needsForceRetry(row) ? "Force Retry" : "Retry"}
                          </BootstrapIconButton>
                        ) : null}
                        {canCancel(row) ? (
                          <BootstrapIconButton
                            disabled={actingId === row.id}
                            onClick={() => handleCancel(row)}
                            icon="pause-circle-fill"
                            tone="warning"
                            label="Cancel queued mail job"
                            tooltip="Cancel this job while it is still queued. Sent jobs cannot be cancelled."
                            size="sm"
                          >
                            Cancel
                          </BootstrapIconButton>
                        ) : null}
                        {canArchive(row) ? (
                          <BootstrapIconButton
                            disabled={actingId === row.id}
                            onClick={() => handleArchive(row)}
                            icon="archive-fill"
                            tone="muted"
                            label="Archive mail job"
                            tooltip="Hide this completed job from the default queue view. Mailrelay bounce or suppression status is unchanged."
                            size="sm"
                          >
                            Archive
                          </BootstrapIconButton>
                        ) : null}
                        <BootstrapIconButton
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          icon={expanded ? "eye-slash-fill" : "eye-fill"}
                          tone="info"
                          label={expanded ? "Hide mail job details" : "Show mail job details"}
                          tooltip={expanded ? "Collapse the safe mail job diagnostic details." : "Show safe diagnostics only. Secrets and raw provider payloads are not displayed."}
                          size="sm"
                        >
                          {expanded ? "Hide" : "Details"}
                        </BootstrapIconButton>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-slate-50/70 dark:bg-slate-900/30">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-300 dark:text-slate-200 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Recipient</div>
                            <div className="mt-1 break-all">{row.to}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Sender</div>
                            <div className="mt-1 break-all">{row.fromEmail ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Failure reason</div>
                            <div className="mt-1">{row.failureReason ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Safe provider message</div>
                            <div className="mt-1">{row.lastError ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Provider</div>
                            <div className="mt-1">{row.provider ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Attempts</div>
                            <div className="mt-1">{`${row.attempts ?? 0}/${row.maxAttempts ?? "—"}`}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Next try</div>
                            <div className="mt-1">{row.nextAttemptAt ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500 dark:text-slate-400">Archived</div>
                            <div className="mt-1">{row.archivedAt ?? "No"}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <AppModal
        open={Boolean(pendingConfirm)}
        onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}
        title={pendingConfirm?.title ?? "Confirm"}
        description={pendingConfirm?.message ?? ""}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="portal-action-secondary rounded-xl px-4 py-2.5 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                pendingConfirm?.onConfirm();
                setPendingConfirm(null);
              }}
              className="rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900"
            >
              Confirm
            </button>
          </>
        }
      >
        <></>
      </AppModal>
    </PortalPage>
  );
}
