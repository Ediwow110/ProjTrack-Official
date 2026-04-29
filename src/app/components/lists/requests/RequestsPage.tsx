import { useMemo, useState } from "react";
import { CheckCircle2, Inbox, RefreshCcw, XCircle } from "lucide-react";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PortalNotice } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import { RequestReviewDrawer } from "./RequestReviewDrawer";
import { RequestsTable } from "./RequestsTable";
import { adminCatalogService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import type { AdminRequestRecord } from "../../../lib/api/contracts";

type RequestSortKey = "type" | "requester" | "date" | "status";
type QueueDecision = "Approved" | "Rejected";

function normalizeRequestValue(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    request: AdminRequestRecord;
    status: QueueDecision;
  } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AdminRequestRecord["status"]>>({});
  const [actionState, setActionState] = useState<{
    busy: boolean;
    error: string | null;
  }>({ busy: false, error: null });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: RequestSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "date", direction: "desc" });

  const { data, loading, error, reload } = useAsyncData(
    () => adminCatalogService.getRequests({ status: statusFilter }),
    [statusFilter],
  );

  const requestRows = data ?? [];
  const withOverrides = useMemo<AdminRequestRecord[]>(
    () =>
      requestRows.map((request) => ({
        ...request,
        status: overrides[request.id] ?? request.status,
      })),
    [requestRows, overrides],
  );
  const filteredRequests = withOverrides.filter((request) => {
    const q = normalizeRequestValue(search.trim());
    if (!q) return true;

    return (
      normalizeRequestValue(request.requester).includes(q) ||
      normalizeRequestValue(request.type).includes(q) ||
      normalizeRequestValue(request.subject).includes(q) ||
      normalizeRequestValue(request.details).includes(q)
    );
  });
  const requests = [...filteredRequests].sort((left, right) => {
    if (!sortState) return 0;
    const direction = sortState.direction === "asc" ? 1 : -1;
    const pickValue = (request: AdminRequestRecord) => {
      switch (sortState.columnKey) {
        case "type":
          return normalizeRequestValue(request.type);
        case "requester":
          return normalizeRequestValue(request.requester);
        case "status":
          return normalizeRequestValue(request.status);
        case "date":
        default:
          return normalizeRequestValue(request.date);
      }
    };

    return pickValue(left).localeCompare(pickValue(right)) * direction;
  });
  const selectedRequest = requests.find((request) => request.id === selectedId) ?? null;
  const pendingCount = requests.filter((request) => request.status === "Pending").length;
  const approvedCount = requests.filter((request) => request.status === "Approved").length;
  const rejectedCount = requests.filter((request) => request.status === "Rejected").length;
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "All";
  const activeFilterItems = [
    search.trim()
      ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }
      : null,
    statusFilter !== "All"
      ? { key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("All") }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function showFeedback(tone: "success" | "error", message: string) {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function handleDecision() {
    if (!decisionTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      if (decisionTarget.status === "Approved") {
        await adminCatalogService.approveRequest(decisionTarget.request.id);
      } else {
        await adminCatalogService.rejectRequest(decisionTarget.request.id);
      }
      setOverrides((current) => ({
        ...current,
        [decisionTarget.request.id]: decisionTarget.status,
      }));
      await reload();
      showFeedback(
        "success",
        `${decisionTarget.request.type} was marked ${decisionTarget.status.toLowerCase()}.`,
      );
      setSelectedId(decisionTarget.request.id);
      setDecisionTarget(null);
      setActionState({ busy: false, error: null });
    } catch {
      const message = "Unable to update the selected request.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  return (
    <>
      <RoleListShell
        tone="slate"
        eyebrow="Approval Queue"
        title="Requests"
        subtitle="Review incoming queue items, inspect full request context, and take safe approval decisions."
        icon={Inbox}
        meta={[
          { label: "Status filter", value: statusFilter === "All" ? "All statuses" : statusFilter },
          { label: "Current queue", value: "Admin requests" },
        ]}
        stats={[
          {
            label: "Visible requests",
            value: loading ? "..." : String(requests.length),
            hint: "Current result set after queue filtering and search.",
          },
          {
            label: "Pending",
            value: loading ? "..." : String(pendingCount),
            hint: "Requests still waiting for a queue decision.",
          },
          {
            label: "Approved",
            value: loading ? "..." : String(approvedCount),
            hint: "Requests already moved forward.",
          },
          {
            label: "Rejected",
            value: loading ? "..." : String(rejectedCount),
            hint: "Requests that were explicitly declined.",
          },
        ]}
        actions={(
          <Button
            type="button"
            disabled={loading || actionState.busy}
            onClick={reload}
            variant="outline"
            className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
          >
            <RefreshCcw size={14} />
            Refresh
          </Button>
        )}
        toolbar={(
          <FilterToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search requests by type, requester, subject, or details"
            primaryFilters={(
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "All", label: "All statuses" },
                  { value: "Pending", label: "Pending" },
                  { value: "Approved", label: "Approved" },
                  { value: "Rejected", label: "Rejected" },
                ]}
              />
            )}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("All");
            }}
          />
        )}
        activeFilters={<ActiveFilterChips items={activeFilterItems} onClearAll={() => {
          setSearch("");
          setStatusFilter("All");
        }} />}
        notices={(
          <div className="space-y-3">
            {actionState.error ? (
              <PortalNotice tone="danger" icon={<XCircle size={16} />}>
                {actionState.error}
              </PortalNotice>
            ) : null}
            {error ? (
              <PortalNotice tone="danger" icon={<XCircle size={16} />}>
                {error}
              </PortalNotice>
            ) : null}
            {feedback ? (
              <PortalNotice
                tone={feedback.tone === "success" ? "success" : "danger"}
                icon={feedback.tone === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              >
                {feedback.message}
              </PortalNotice>
            ) : null}
            {statusFilter === "Pending" ? (
              <PortalNotice tone="warning">
                Showing queue items that still need a decision from the admin team.
              </PortalNotice>
            ) : null}
          </div>
        )}
        drawer={(
          <RequestReviewDrawer
            open={Boolean(selectedRequest)}
            request={selectedRequest}
            actionBusy={actionState.busy}
            onClose={() => setSelectedId(null)}
            onApprove={(request) => setDecisionTarget({ request, status: "Approved" })}
            onReject={(request) => setDecisionTarget({ request, status: "Rejected" })}
          />
        )}
      >
        <RequestsTable
          rows={requests}
          loading={loading}
          error={error}
          onRetry={reload}
          onReview={setSelectedId}
          onApprove={(request) => setDecisionTarget({ request, status: "Approved" })}
          onReject={(request) => setDecisionTarget({ request, status: "Rejected" })}
          actionBusy={actionState.busy}
          sortState={sortState}
          onSortChange={(columnKey) =>
            setSortState((current) => {
              if (!current || current.columnKey !== columnKey) {
                return { columnKey: columnKey as RequestSortKey, direction: "asc" };
              }

              return {
                columnKey: current.columnKey,
                direction: current.direction === "asc" ? "desc" : "asc",
              };
            })
          }
        />
      </RoleListShell>

      <ConfirmDialog
        open={Boolean(decisionTarget)}
        title={
          decisionTarget?.status === "Approved"
            ? "Approve request?"
            : "Reject request?"
        }
        description={
          decisionTarget
            ? decisionTarget.status === "Approved"
              ? `${decisionTarget.request.type} will be marked approved and moved forward in the queue.`
              : `${decisionTarget.request.type} will be marked rejected for ${decisionTarget.request.requester}.`
            : "Confirm the queue decision."
        }
        confirmLabel={
          decisionTarget?.status === "Approved" ? "Approve request" : "Reject request"
        }
        tone={decisionTarget?.status === "Rejected" ? "danger" : "default"}
        loading={actionState.busy}
        onConfirm={handleDecision}
        onCancel={() => setDecisionTarget(null)}
      />
    </>
  );
}

function FilterSelect({
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
    <label className="flex min-w-[180px] flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[var(--radius-control)] border border-slate-200/80 bg-white dark:bg-slate-900/85 px-3 text-sm text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] outline-none focus:border-[var(--role-accent)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "all"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
