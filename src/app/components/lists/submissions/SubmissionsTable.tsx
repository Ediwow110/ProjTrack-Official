import { BoxArrowUpRight, Eye, FileEarmarkText } from "react-bootstrap-icons";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import type { AdminSubmissionRecord } from "../../../lib/api/contracts";

type SubmissionSortKey = "title" | "student" | "subject" | "status" | "submitted";

type SubmissionsTableProps = {
  rows: AdminSubmissionRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPreview: (id: string) => void;
  onView: (id: string) => void;
  sortState?: {
    columnKey: SubmissionSortKey;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

export function SubmissionsTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  onPreview,
  onView,
  sortState,
  onSortChange,
}: SubmissionsTableProps) {
  return (
    <DataTableCard
      title="Submission records"
      description="Track submission status, student ownership, and grading state through a shared operational table."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading submissions...</span> : null}
      columns={[
        {
          key: "title",
          header: "Title",
          sortable: true,
          renderCell: (submission) => (
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{submission.title}</span>
          ),
        },
        {
          key: "student",
          header: "Student",
          sortable: true,
          renderCell: (submission) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{submission.student}</span>
          ),
        },
        {
          key: "subject",
          header: "Subject",
          sortable: true,
          renderCell: (submission) => (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-300">{submission.subject}</p>
              <p className="mt-1 text-[10px] text-slate-400">{submission.section}</p>
            </div>
          ),
        },
        {
          key: "submitted",
          header: "Submitted",
          sortable: true,
          renderCell: (submission) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{submission.submitted}</span>
          ),
        },
        {
          key: "status",
          header: "Status",
          sortable: true,
          renderCell: (submission) => <StatusChip status={submission.status} size="xs" />,
        },
        {
          key: "grade",
          header: "Grade",
          renderCell: (submission) => (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              {submission.grade !== "—" ? `${submission.grade}/100` : "—"}
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(submission) => submission.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(submission) => onPreview(submission.id)}
      sortState={sortState}
      onSortChange={onSortChange}
      rowActions={[
        {
          key: "preview",
          label: "Preview",
          icon: <Eye size={15} />,
          ariaLabel: (submission) => `Preview ${submission.title}`,
          onClick: (submission) => onPreview(submission.id),
        },
        {
          key: "view",
          label: "View",
          icon: <BoxArrowUpRight size={15} />,
          ariaLabel: (submission) => `Open full record for ${submission.title}`,
          onClick: (submission) => onView(submission.id),
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={FileEarmarkText}
          title="No submissions match this view"
          description="Try clearing the search or status filter to widen the current result set."
        />
      )}
    />
  );
}
