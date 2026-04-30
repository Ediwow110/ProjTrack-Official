import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { CopyableIdChip } from "../../components/lists/shared/CopyableIdChip";
import type { MailJobRecord } from "../../lib/api/contracts";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

function statusClasses(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "processing") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "dead" || status === "cancelled") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "failed") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function alertClasses(severity: "info" | "warning" | "error") {
  if (severity === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
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

function workerLabel(status: any) {
  if (status?.workerHealthy) return "Healthy";
  if (status?.workerEnabled) return "Worker stale";
  return "Disabled here";
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

  const summaryCards = [
    { label: "Active provider", value: status?.provider ?? "—", tone: "text-slate-700" },
    {
      label: "Worker status",
      value: workerLabel(status),
      tone: status?.workerHealthy ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: "Heartbeat age",
      value:
        typeof status?.workerHeartbeatAgeSeconds === "number"
          ? `${status.workerHeartbeatAgeSeconds}s`
          : "—",
      tone: status?.workerHealthy ? "text-slate-700" : "text-rose-700",
    },
    { label: "Queue depth", value: String(status?.queueDepth ?? 0), tone: "text-amber-700" },
    { label: "Queued too long", value: String(status?.queuedTooLongCount ?? 0), tone: "text-amber-700" },
    { label: "Processing too long", value: String(status?.processingTooLongCount ?? 0), tone: "text-rose-700" },
    { label: "Sent (24h)", value: String(status?.sent24h ?? 0), tone: "text-emerald-700" },
    { label: "Failed", value: String(status?.failedCount ?? 0), tone: "text-amber-700" },
    { label: "Dead", value: String(status?.deadCount ?? 0), tone: "text-rose-700" },
  ];

  const handleRetry = async (row: MailJobRecord) => {
    const force = needsForceRetry(row);
    if (force) {
      const confirmed = window.confirm(
        "This job is marked non-retryable. Confirm the provider or recipient issue is fixed before forcing a retry.",
      );
      if (!confirmed) return;
    }

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

  const handleRetrySelected = async () => {
    if (!selectedIds.length) return;
    if (selectedNeedForce) {
      const confirmed = window.confirm(
        "At least one selected job is marked non-retryable. Confirm the provider or recipient issue is fixed before forcing these retries.",
      );
      if (!confirmed) return;
    }

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

  const handleCancel = async (row: MailJobRecord) => {
    const confirmed = window.confirm("Cancel this queued mail job?");
    if (!confirmed) return;
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

  const handleArchiveOld = async () => {
    const confirmed = window.confirm("Archive sent/dead/cancelled mail jobs older than 30 days?");
    if (!confirmed) return;
    setError(null);
    try {
      await adminService.archiveOldMailJobs(30);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive older mail jobs.");
    }
  };

  const handleSendTest = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setTestResult(null);
    try {
      const result = await adminService.sendTestMail(testEmail);
      setTestResult(`${result.detail || "Queued. Waiting for mail worker."} Provider: ${result.provider}; job ${result.jobId}.`);
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
    <div className="portal-surface p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={`text-slate-900 dark:text-slate-100 font-bold ${loading ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem" }}>
            Mail Jobs
          </h1>
          <p className={`text-slate-400 text-sm mt-0.5 ${loading ? "opacity-80" : ""}`}>
            Mailrelay-backed queue visibility, worker health, and safe recovery actions.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{pageVisible ? "Live" : "Paused"}</span>
            <span>Last updated: {lastUpdatedAt ? formatStatusTime(lastUpdatedAt.toISOString()) : "—"}</span>
            <span>{loading ? "Refreshing…" : `${rows.length} visible job${rows.length === 1 ? "" : "s"}`}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show archived
          </label>
          <button
            type="button"
            onClick={handleArchiveOld}
            className="portal-input inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
          >
            <Archive size={14} /> Archive old
          </button>
          <button
            disabled={loading}
            onClick={reload}
            className="portal-input inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{loadError}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {testResult && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{testResult}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(status?.alerts ?? []).map((alert) => (
          <div key={`${alert.code}-${alert.message}`} className={`rounded-xl border px-4 py-3 text-sm ${alertClasses(alert.severity)}`}>
            <div className="flex items-start gap-2">
              {alert.severity === "error" ? (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              ) : alert.severity === "warning" ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              )}
              <span>{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${loading ? "opacity-80" : ""}`}>
        {summaryCards.map((item) => (
          <div key={item.label} className="portal-card rounded-xl border p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-400">{item.label}</p>
            <p className={`mt-1 break-words text-sm font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="portal-card rounded-lg border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mailrelay Sender Checklist</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              SENT means Mailrelay accepted the email. QUEUED and PROCESSING should stay temporary.
            </p>
          </div>
          {status?.senderConfigIssues?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {status.senderConfigIssues[0]}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Active provider", value: status?.provider ?? "—" },
            { label: "Worker status", value: workerLabel(status) },
            { label: "Worker heartbeat", value: formatStatusTime(status?.workerLastHeartbeatAt ?? null) },
            { label: "Account/reset sender", value: senderConfig?.noreply ?? "—" },
            { label: "Notification sender", value: senderConfig?.notification ?? "—" },
            { label: "Invite sender", value: senderConfig?.invite ?? "—" },
            { label: "Admin sender", value: senderConfig?.admin ?? "—" },
            { label: "Support sender", value: senderConfig?.support ?? "—" },
            { label: "Latest sent", value: formatStatusTime(status?.latestSentAt ?? null) },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="font-medium text-slate-400">{item.label}</div>
              <div className="mt-0.5 break-words font-semibold text-slate-700 dark:text-slate-100">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-200">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>If SENDER_NOT_CONFIRMED appears, confirm the sender in Mailrelay or temporarily route all MAIL_FROM_* values to admin@projtrack.codes.</span>
        </div>
      </div>

      <form onSubmit={handleSendTest} className="portal-card flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="min-w-[18rem] flex-1 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Send Mailrelay Test</span>
          <input
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            type="email"
            required
            placeholder="recipient@example.com"
            className="portal-input h-10 w-full rounded-xl border px-3 text-sm"
          />
        </label>
        <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white">
          <Mail size={14} /> Send Test
        </button>
      </form>

      <div className="portal-card rounded-xl border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Selected retryable jobs: <span className="font-semibold text-slate-700 dark:text-slate-100">{selectedIds.length}</span>
          </div>
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={handleRetrySelected}
            className="portal-input inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
          >
            <RotateCcw size={14} /> Retry selected
          </button>
        </div>
      </div>

      <div className={`portal-card overflow-x-auto rounded-xl border shadow-sm ${loading ? "opacity-80" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="portal-border portal-table-header border-b">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <input
                  type="checkbox"
                  checked={retryableRows.length > 0 && selectedIds.length === retryableRows.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              {["Recipient", "Template", "Status", "Attempts", "Timing", "Provider / Failure", "Actions"].map((header) => (
                <th key={header} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4" colSpan={8}>
                    <div className="h-7 animate-pulse rounded-lg bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80">
                          <Mail size={14} className="text-slate-600 dark:text-slate-200" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{recipientLabel(row)}</div>
                          {recipientIdLabel(row) && (
                            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-300">{recipientIdLabel(row)}</div>
                          )}
                          {row.recipient?.role && (
                            <div className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
                              {row.recipient.role}
                            </div>
                          )}
                          <div className="break-all text-[10px] text-slate-400">{row.recipient?.email || row.to}</div>
                          <CopyableIdChip value={row.id} label="Copy Mail Job ID" className="bg-transparent px-0" />
                          {row.routedToTestmail && (
                            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              Routed to testmail
                            </div>
                          )}
                          {row.deliveryRecipient && row.deliveryRecipient !== row.to && (
                            <div className="break-all text-[10px] text-slate-400">Delivery recipient: {row.deliveryRecipient}</div>
                          )}
                          {row.archivedAt && (
                            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Archived {row.archivedAt}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-300">{row.template}</td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>{row.status}</span>
                        {needsForceRetry(row) ? (
                          <div className="text-[10px] text-rose-600">Needs confirmation</div>
                        ) : row.retryableFailure ? (
                          <div className="text-[10px] text-amber-700">Retryable failure</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-300">
                      <div className="font-semibold text-slate-700 dark:text-slate-100">{`${row.attempts ?? 0}/${row.maxAttempts ?? "—"}`}</div>
                      <div className="text-[10px] text-slate-400">{row.failureReason || "No failure reason"}</div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-300">
                      <div>Created: {row.createdAt}</div>
                      <div>Last try: {row.lastAttemptAt ?? "—"}</div>
                      <div>Next try: {row.nextAttemptAt ?? "—"}</div>
                      <div>Sent: {row.sentAt ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs text-slate-500 dark:text-slate-300">
                      <div className="font-medium text-slate-700 dark:text-slate-100">{row.provider ?? "—"}</div>
                      {row.fromEmail && <div className="text-[10px] text-slate-400">From: {row.fromEmail}</div>}
                      {row.providerMessageId ? (
                        <div className="mt-1">
                          <CopyableIdChip value={row.providerMessageId} label="Copy Provider Message ID" className="bg-transparent px-0" />
                        </div>
                      ) : null}
                      {row.lastError && <div className="mt-1 max-w-[260px] text-[10px] text-rose-600" title={row.lastError}>{row.lastError}</div>}
                      {row.failureHint ? <div className="mt-1 max-w-[260px] text-[10px] text-amber-700">{row.failureHint}</div> : null}
                    </td>
                    <td className="px-5 py-3.5 align-top text-xs">
                      <div className="flex flex-wrap gap-2">
                        {canRetry(row) ? (
                          <button
                            disabled={retryingId === row.id}
                            onClick={() => handleRetry(row)}
                            className="portal-input inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
                          >
                            <RotateCcw size={12} /> {retryingId === row.id ? "Retrying…" : needsForceRetry(row) ? "Force Retry" : "Retry"}
                          </button>
                        ) : null}
                        {canCancel(row) ? (
                          <button
                            disabled={actingId === row.id}
                            onClick={() => handleCancel(row)}
                            className="portal-input inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
                          >
                            <PauseCircle size={12} /> Cancel
                          </button>
                        ) : null}
                        {canArchive(row) ? (
                          <button
                            disabled={actingId === row.id}
                            onClick={() => handleArchive(row)}
                            className="portal-input inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
                          >
                            <Archive size={12} /> Archive
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          className="portal-input inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/85"
                        >
                          {expanded ? <EyeOff size={12} /> : <Eye size={12} />} {expanded ? "Hide" : "Details"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-slate-50/70 dark:bg-slate-900/30">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-200 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <div className="font-semibold text-slate-500">Recipient</div>
                            <div className="mt-1 break-all">{row.to}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Sender</div>
                            <div className="mt-1 break-all">{row.fromEmail ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Failure reason</div>
                            <div className="mt-1">{row.failureReason ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Safe provider message</div>
                            <div className="mt-1">{row.lastError ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Provider</div>
                            <div className="mt-1">{row.provider ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Attempts</div>
                            <div className="mt-1">{`${row.attempts ?? 0}/${row.maxAttempts ?? "—"}`}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Next try</div>
                            <div className="mt-1">{row.nextAttemptAt ?? "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-500">Archived</div>
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
    </div>
  );
}
