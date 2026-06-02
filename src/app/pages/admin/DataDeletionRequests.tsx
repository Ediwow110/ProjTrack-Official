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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-slate-600" />
        <div>
          <div className="text-xl font-semibold">Data Deletion Requests</div>
          <div className="text-sm text-slate-500">Admin review — metadata only. Deletion not implemented.</div>
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
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Requester</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
              <th className="p-2">Reviewed</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-4">Loading…</td></tr> :
             filtered.length === 0 ? <tr><td colSpan={6} className="p-4 text-slate-500">No requests.</td></tr> :
             filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.id.slice(0,10)}…</td>
                <td className="p-2">{r.requester?.email || r.requesterUserId}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded border text-xs ${statusClass(r.status)}`}>{r.status}</span></td>
                <td className="p-2 text-xs">{formatDate(r.createdAt)}</td>
                <td className="p-2 text-xs">{formatDate(r.reviewedAt)}</td>
                <td className="p-2">
                  {r.status === "PENDING" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>setApproveTarget(r)} className="mr-1">Approve</Button>
                      <Button size="sm" variant="outline" onClick={()=>{setDenyTarget(r); setDenyNote("");}}>Deny</Button>
                    </>
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
    </div>
  );
}
