import { useMemo, useState } from "react";
import { ShieldAlert, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";

import { RoleListShell } from "../components/lists/shared/RoleListShell";
import { FilterToolbar } from "../components/lists/shared/FilterToolbar";
import { ActiveFilterChips } from "../components/lists/shared/ActiveFilterChips";
import { AppModal } from "../components/ui/app-modal";
import { Button } from "../components/ui/button";
import { adminCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { DataDeletionRequestRecord } from "../../lib/api/contracts";

const STATUS_OPTIONS = ["All", "PENDING", "APPROVED", "DENIED", "CANCELLED"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadgeClass(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200";
  if (s === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200";
  if (s === "DENIED") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200";
  if (s === "CANCELLED") return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/12 dark:text-slate-200";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function DataDeletionRequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<DataDeletionRequestRecord | null>(null);
  const [denyTarget, setDenyTarget] = useState<DataDeletionRequestRecord | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => adminCatalogService.getDataDeletionRequests({ status: statusFilter === "All" ? undefined : statusFilter }),
    [statusFilter],
  );

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.id,
        r.requesterUserId,
        r.requester?.email,
        r.requester?.firstName,
        r.requester?.lastName,
        r.reason,
        r.reviewNote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "All";

  function showFeedback(tone: "success" | "error", message: string) {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 4000);
  }

  async function handleApprove() {
    if (!approveTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await adminCatalogService.approveDataDeletionRequest(approveTarget.id);
      showFeedback("success", "Request approved. This is metadata-only; no data deleted yet.");
      setApproveTarget(null);
      await reload();
      setSelectedId(approveTarget.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to approve request.";
      setActionState({ busy: false, error: msg });
      showFeedback("error", msg);
    } finally {
      setActionState({ busy: false, error: null });
    }
  }

  async function handleDeny() {
    if (!denyTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await adminCatalogService.denyDataDeletionRequest(denyTarget.id, { reviewNote: denyNote.trim() || undefined });
      showFeedback("success", "Request denied.");
      setDenyTarget(null);
      setDenyNote("");
      await reload();
      setSelectedId(denyTarget.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to deny request.";
      setActionState({ busy: false, error: msg });
      showFeedback("error", msg);
    } finally {
      setActionState({ busy: false, error: null });
    }
  }

  const visibleRows = [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return (
    <>
      <RoleListShell
        tone="slate"
        eyebrow="Governance"
        title="Data Deletion Requests"
        subtitle="Review user deletion requests. Approvals are recorded only; deletion execution is not implemented in this release."
        icon={ShieldAlert}
        meta={[
          { label: "Status filter", value: statusFilter },
          { label: "Pending", value: String(pendingCount) },
        ]}
        stats={[
          { label: "Visible", value: String(visibleRows.length) },
          { label: "Pending", value: String(pendingCount) },
        ]}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setStatusFilter(v as StatusFilter)}
            statusOptions={STATUS_OPTIONS as unknown as string[]}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
            <RefreshCcw size={14} />
            Refresh
          </Button>
        </div>

        <ActiveFilterChips
          items={[
            search.trim() ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") } : null,
            statusFilter !== "All" ? { key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("All") } : null,
          ].filter(Boolean) as any}
          onClearAll={() => {
            setSearch("");
            setStatusFilter("All");
          }}
        />

        {feedback && (
          <div className={`mb-3 rounded-[20px] border px-4 py-2 text-sm ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {feedback.message}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{String(error)}</div>
        )}

        <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Reviewed</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[var(--text-body)] dark:divide-slate-800">
              {loading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">No requests found.</td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const isPending = row.status === "PENDING";
                  const reqName = row.requester ? `${row.requester.firstName || ""} ${row.requester.lastName || ""}`.trim() || row.requester.email : row.requesterUserId;
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{reqName}</div>
                        <div className="text-xs text-slate-500">{row.requester?.email || row.requesterUserId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[28ch] truncate" title={row.reason || ""}>
                        {row.reason || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(row.reviewedAt)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {row.reviewer ? `${row.reviewer.firstName || ""} ${row.reviewer.lastName || ""}`.trim() || row.reviewer.email : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[24ch] truncate" title={row.reviewNote || ""}>
                        {row.reviewNote || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setApproveTarget(row)}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDenyTarget(row);
                                setDenyNote("");
                              }}
                            >
                              <XCircle size={14} /> Deny
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Approve modal with strict safety copy (metadata-only) */}
        <AppModal
          open={!!approveTarget}
          onOpenChange={(open) => !actionState.busy && setApproveTarget(open ? approveTarget : null)}
          title="Approve data deletion request?"
          description="This action records approval only. No data is deleted."
          size="lg"
          footer={(
            <>
              <Button type="button" variant="outline" disabled={actionState.busy} onClick={() => setApproveTarget(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={actionState.busy} onClick={handleApprove}>
                {actionState.busy ? "Approving..." : "Confirm Approve (metadata only)"}
              </Button>
            </>
          )}
        >
          <div className="space-y-3 text-sm leading-6 text-[var(--text-body)]">
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200">
              <p className="font-semibold">This action is metadata-only.</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Approving this request does not delete data yet.</li>
                <li>Deletion execution is not implemented in this release.</li>
                <li>This only records admin approval for a future deletion workflow.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500">Requester: {approveTarget?.requester?.email || approveTarget?.requesterUserId}</p>
          </div>
        </AppModal>

        {/* Deny modal with optional note */}
        <AppModal
          open={!!denyTarget}
          onOpenChange={(open) => {
            if (!actionState.busy) {
              setDenyTarget(open ? denyTarget : null);
              if (!open) setDenyNote("");
            }
          }}
          title="Deny data deletion request?"
          description="This marks the request as DENIED. No data is affected."
          size="lg"
          footer={(
            <>
              <Button type="button" variant="outline" disabled={actionState.busy} onClick={() => { setDenyTarget(null); setDenyNote(""); }}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={actionState.busy} onClick={handleDeny}>
                {actionState.busy ? "Denying..." : "Confirm Deny"}
              </Button>
            </>
          )}
        >
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-body)]">This is a metadata-only state change.</p>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review note (optional)</label>
            <textarea
              className="w-full rounded-[16px] border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
              rows={3}
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              placeholder="Reason for denial (optional)"
              disabled={actionState.busy}
            />
          </div>
        </AppModal>
      </RoleListShell>
    </>
  );
}
