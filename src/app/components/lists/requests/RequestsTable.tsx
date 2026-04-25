import { Check2Circle, Eye, Inbox, XCircle } from "react-bootstrap-icons";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import type { AdminRequestRecord } from "../../../lib/api/contracts";

type RequestSortKey = "type" | "requester" | "date" | "status";

type RequestsTableProps = {
  rows: AdminRequestRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onReview: (id: string) => void;
  onApprove: (request: AdminRequestRecord) => void;
  onReject: (request: AdminRequestRecord) => void;
  actionBusy?: boolean;
  sortState?: {
    columnKey: RequestSortKey;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

export function RequestsTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  onReview,
  onApprove,
  onReject,
  actionBusy = false,
  sortState,
  onSortChange,
}: RequestsTableProps) {
  return (
    <DataTableCard
      title="Request queue"
      description="Review request context quickly, then approve or reject through standardized confirmation steps."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading queue...</span> : null}
      columns={[
        {
          key: "type",
          header: "Request type",
          sortable: true,
          renderCell: (request) => (
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{request.type}</p>
              <p className="mt-1 text-[10px] text-slate-400">{request.subject}</p>
            </div>
          ),
        },
        {
          key: "requester",
          header: "Requester",
          sortable: true,
          renderCell: (request) => (
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-100">{request.requester}</p>
              <p className="mt-1 text-[10px] text-slate-400">{request.role}</p>
            </div>
          ),
        },
        {
          key: "date",
          header: "Submitted",
          sortable: true,
          renderCell: (request) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{request.date}</span>
          ),
        },
        {
          key: "status",
          header: "Status",
          sortable: true,
          renderCell: (request) => <StatusChip status={request.status} size="xs" />,
        },
      ]}
      rows={rows}
      rowKey={(request) => request.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(request) => onReview(request.id)}
      sortState={sortState}
      onSortChange={onSortChange}
      rowActions={(request) => [
        {
          key: "review",
          label: "Review",
          icon: <Eye size={15} />,
          ariaLabel: `Review ${request.type} request from ${request.requester}`,
          onClick: () => onReview(request.id),
          disabled: () => actionBusy,
        },
        {
          key: "approve",
          label: "Approve",
          icon: <Check2Circle size={15} />,
          ariaLabel: `Approve ${request.type} request from ${request.requester}`,
          onClick: () => onApprove(request),
          hidden: () => request.status !== "Pending",
          disabled: () => actionBusy,
        },
        {
          key: "reject",
          label: "Reject",
          icon: <XCircle size={15} />,
          ariaLabel: `Reject ${request.type} request from ${request.requester}`,
          onClick: () => onReject(request),
          tone: "danger",
          hidden: () => request.status !== "Pending",
          disabled: () => actionBusy,
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={Inbox}
          title="No requests match this view"
          description="Try clearing the filters or search to widen the current queue."
        />
      )}
    />
  );
}
