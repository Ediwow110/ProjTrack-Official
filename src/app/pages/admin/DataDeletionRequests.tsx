import { useMemo, useState } from "react";
import { ShieldAlert, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "../../components/ui/button";
import { AppModal } from "../../components/ui/app-modal";
import { adminCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { DataDeletionRequestRecord } from "../../lib/api/contracts";

const STATUS_OPTIONS = ["All", "PENDING", "APPROVED", "DENIED", "CANCELLED"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US");
}

function statusClass(s: string) {
  const u = (s || "").toUpperCase();
  if (u === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (u === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (u === "DENIED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminDataDeletionRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [approveTarget, setApproveTarget] = useState<DataDeletionRequestRecord | null>(null);
  const [denyTarget, setDenyTarget] = useState<DataDeletionRequestRecord | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Phase 5 dry-run execution (dry-run / verify only; destructive disabled per governance skill)
  const [executionTarget, setExecutionTarget] = useState<DataDeletionRequestRecord | null>(null);
  const [executionData, setExecutionData] = useState<any>(null);
  const [backupRunIdInput, setBackupRunIdInput] = useState("");

  const { data, loading, error, reload } = useAsyncData(
    () => adminCatalogService.getDataDeletionRequests({ status: statusFilter === "All" ? undefined : statusFilter }),
    [statusFilter]
  );

  const rows: DataDeletionRequestRecord[] = data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r =>
      [r.id, r.requesterUserId, r.requester?.email, r.reason, r.reviewNote]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function doApprove() {
    if (!approveTarget) return;
    setBusy(true);
    try {
      await adminCatalogService.approveDataDeletionRequest(approveTarget.id);
      setFeedback("Approved (metadata only — no data deleted).");
      setApproveTarget(null);
      await reload();
    } catch (e: any) {
      setFeedback(e?.message || "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function doDeny() {
    if (!denyTarget) return;
    setBusy(true);
    try {
      await adminCatalogService.denyDataDeletionRequest(denyTarget.id, { reviewNote: denyNote || undefined });
      setFeedback("Denied.");
      setDenyTarget(null);
      setDenyNote("");
      await reload();
    } catch (e: any) {
      setFeedback(e?.message || "Deny failed");
    } finally {
      setBusy(false);
    }
  }

  async function openExecution(r: DataDeletionRequestRecord) {
    setExecutionTarget(r);
    setExecutionData(null);
    setBackupRunIdInput("");
    setFeedback(null);
    setBusy(true);
    try {
      const ex = await (adminCatalogService as any).getDataDeletionExecution(r.id);
      setExecutionData(ex);
    } catch (e: any) {
      setFeedback(e?.message || "Failed to load execution");
    } finally {
      setBusy(false);
    }
  }

  async function doDryRun() {
    if (!executionTarget) return;
    setBusy(true);
    try {
      const res = await (adminCatalogService as any).triggerDryRun(executionTarget.id);
      setFeedback("Dry-run triggered (no data deleted).");
      // reload execution
      const ex = await (adminCatalogService as any).getDataDeletionExecution(executionTarget.id);
      setExecutionData(ex);
      await reload();
    } catch (e: any) {
      setFeedback(e?.message || "Dry-run failed");
    } finally {
      setBusy(false);
    }
  }

  async function doVerifyBackup() {
    if (!executionTarget || !backupRunIdInput) return;
    setBusy(true);
    try {
      const res = await (adminCatalogService as any).verifyBackup(executionTarget.id, { backupRunId: backupRunIdInput });
      setFeedback("Backup verified for execution (dry-run only).");
      const ex = await (adminCatalogService as any).getDataDeletionExecution(executionTarget.id);
      setExecutionData(ex);
      await reload();
    } catch (e: any) {
      setFeedback(e?.message || "Verify backup failed");
    } finally {
      setBusy(false);
    }
  }

  function closeExecution() {
    if (!busy) {
      setExecutionTarget(null);
      setExecutionData(null);
      setBackupRunIdInput("");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-slate-600" />
        <div>
          <div className="text-xl font-semibold">Data Deletion Requests</div>
          <div className="text-sm text-slate-500">Admin review — metadata only. Dry-run execution supported. Destructive execution is disabled in this release. Dry-run does not delete, anonymize, or restore data. Backup verification does not execute deletion.</div>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}><RefreshCcw size={14} /> Refresh</Button>
      </div>

      <div className="flex gap-2">
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-3 py-1 text-sm" />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="border rounded px-2 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {feedback && <div className="text-sm p-2 bg-emerald-50 border border-emerald-200 rounded">{feedback}</div>}
      {error && <div className="text-sm p-2 bg-rose-50 border border-rose-200 rounded">{String(error)}</div>}

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Requester</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
              <th className="p-2">Reviewed</th>
              <th className="p-2">Execution</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-4">Loading…</td></tr> :
             filtered.length === 0 ? <tr><td colSpan={7} className="p-4 text-slate-500">No requests.</td></tr> :
             filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.id.slice(0,10)}…</td>
                <td className="p-2">{r.requester?.email || r.requesterUserId}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded border text-xs ${statusClass(r.status)}`}>{r.status}</span></td>
                <td className="p-2 text-xs">{formatDate(r.createdAt)}</td>
                <td className="p-2 text-xs">{formatDate(r.reviewedAt)}</td>
                <td className="p-2 text-xs">
                  {r.status === "APPROVED" ? "Ready (dry-run)" : "—"}
                </td>
                <td className="p-2">
                  {r.status === "PENDING" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>setApproveTarget(r)} className="mr-1">Approve</Button>
                      <Button size="sm" variant="outline" onClick={()=>{setDenyTarget(r); setDenyNote("");}}>Deny</Button>
                    </>
                  ) : r.status === "APPROVED" ? (
                    <Button size="sm" variant="outline" onClick={() => openExecution(r)}>Execution (dry-run)</Button>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AppModal open={!!approveTarget} onOpenChange={o=>!busy && setApproveTarget(o?approveTarget:null)} title="Approve?" size="lg"
        footer={<>
          <Button variant="outline" onClick={()=>setApproveTarget(null)} disabled={busy}>Cancel</Button>
          <Button onClick={doApprove} disabled={busy}>{busy?"...":"Confirm Approve (no delete)"}</Button>
        </>}>
        <div className="text-sm space-y-2">
          <div className="font-semibold">This action is metadata-only.</div>
          <ul className="list-disc pl-4">
            <li>Approving this request does not delete data yet.</li>
            <li>Deletion execution is not implemented in this release.</li>
            <li>This only records admin approval for a future deletion workflow.</li>
          </ul>
          <div>Requester: {approveTarget?.requester?.email || approveTarget?.requesterUserId}</div>
        </div>
      </AppModal>

      <AppModal open={!!denyTarget} onOpenChange={o=>{ if(!busy){ setDenyTarget(o?denyTarget:null); if(!o) setDenyNote(""); } }} title="Deny?" size="lg"
        footer={<>
          <Button variant="outline" onClick={()=>{setDenyTarget(null);setDenyNote("");}} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={doDeny} disabled={busy}>{busy?"...":"Confirm Deny"}</Button>
        </>}>
        <div>
          <div className="mb-2 text-sm">Metadata only. No data affected.</div>
          <textarea value={denyNote} onChange={e=>setDenyNote(e.target.value)} placeholder="Review note (optional)" className="w-full border rounded p-2 text-sm" rows={3} />
        </div>
      </AppModal>

      {/* Phase 5: Execution modal - dry-run and backup verify only. Strict safety copy per prompt. */}
      <AppModal open={!!executionTarget} onOpenChange={o => { if (!busy) closeExecution(); }} title="Execution (Dry-Run)" size="lg"
        footer={<>
          <Button variant="outline" onClick={closeExecution} disabled={busy}>Close</Button>
          {executionTarget?.status === "APPROVED" && (
            <>
              <Button onClick={doDryRun} disabled={busy || !!executionData?.status && executionData.status !== 'DRY_RUN_PENDING'}>Run Dry-Run</Button>
              <div className="flex items-center gap-2">
                <input placeholder="backupRunId for verify" value={backupRunIdInput} onChange={e=>setBackupRunIdInput(e.target.value)} className="border rounded px-2 py-1 text-sm w-48" />
                <Button onClick={doVerifyBackup} disabled={busy || !backupRunIdInput}>Verify Backup</Button>
              </div>
            </>
          )}
        </>}>
        <div className="text-sm space-y-3">
          <div className="font-semibold text-amber-700">Dry-run does not delete, anonymize, or restore data. Destructive execution is disabled in this release. Backup verification does not execute deletion. Production activation requires a separate approved PR.</div>
          <div>Request: {executionTarget?.id} — Status: {executionTarget?.status}</div>
          {busy && <div>Loading...</div>}
          {executionData && (
            <div className="space-y-2 border p-2 rounded bg-slate-50">
              <div>Execution ID: {executionData.id} | Status: <span className="font-mono">{executionData.status}</span> | Dry-run: {String(executionData.dryRun)}</div>
              {executionData.backupRunId && <div>Backup: {executionData.backupRunId} verified at {formatDate(executionData.backupVerifiedAt)}</div>}
              {executionData.executionPlanJson && (
                <div>
                  <div className="font-medium">Plan:</div>
                  <pre className="text-xs overflow-auto max-h-48 bg-white p-1 border">{JSON.stringify(executionData.executionPlanJson, null, 2)}</pre>
                </div>
              )}
              {executionData.executionResultJson && (
                <div>
                  <div className="font-medium">Result:</div>
                  <pre className="text-xs overflow-auto max-h-48 bg-white p-1 border">{JSON.stringify(executionData.executionResultJson, null, 2)}</pre>
                </div>
              )}
              {executionData.executionError && <div className="text-rose-600">Error: {executionData.executionError}</div>}
            </div>
          )}
          {!executionData && !busy && <div>No execution record yet. Use actions below for APPROVED requests.</div>}
        </div>
      </AppModal>
    </div>
  );
}
