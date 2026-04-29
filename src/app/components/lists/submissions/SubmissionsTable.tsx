import { FileText } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { GradeChip } from "../../ui/GradeChip";
import { DataTableCard } from "../shared/DataTableCard";
import { CopyableIdChip } from "../shared/CopyableIdChip";
import type { AdminSubmissionRecord } from "../../../lib/api/contracts";

type SubmissionSortKey = "title" | "student" | "subject" | "status" | "submitted";

type SubmissionsTableProps = {
  rows: AdminSubmissionRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  actionBusy?: boolean;
  onPreview: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (submission: AdminSubmissionRecord) => void;
  onDelete: (submission: AdminSubmissionRecord) => void;
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
  actionBusy = false,
  onPreview,
  onView,
  onEdit,
  onDelete,
  sortState,
  onSortChange,
}: SubmissionsTableProps) {
  return (
    <DataTableCard
      title="Submission records"
      description="Track submission status, student ownership, and grading state through a shared operational table."
      action={loading ? <span className="text-xs font-medium text-slate-400 dark:text-slate-300">Loading submissions...</span> : null}
      columns={[
        {
          key: "id",
          header: "Submission ID",
          renderCell: (submission) => (
            <CopyableIdChip value={submission.id} label="Copy Submission ID" />
          ),
        },
        {
          key: "title",
          header: "Title",
          sortable: true,
          renderCell: (submission) => (
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{submission.title}</span>
              {submission.taskId ? (
                <div className="mt-1">
                  <CopyableIdChip value={submission.taskId} label="Copy Task ID" className="bg-transparent px-0" />
                </div>
              ) : null}
            </div>
          ),
        },
        {
          key: "student",
          header: "Student",
          sortable: true,
          renderCell: (submission) => (
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{submission.student}</span>
              {submission.groupId ? (
                <div className="mt-1">
                  <CopyableIdChip value={submission.groupId} label="Copy Group ID" className="bg-transparent px-0" />
                </div>
              ) : null}
            </div>
          ),
        },
        {
          key: "subject",
          header: "Subject",
          sortable: true,
          renderCell: (submission) => (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                {submission.subjectCode ? `${submission.subjectCode} · ${submission.subject}` : submission.subject}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[10px] text-slate-400 dark:text-slate-300">{submission.section}</p>
                {submission.subjectId ? (
                  <CopyableIdChip value={submission.subjectId} label="Copy Subject ID" className="bg-transparent px-0" />
                ) : null}
              </div>
            </div>
          ),
        },
        {
          key: "submitted",
          header: "Submitted",
          sortable: true,
          renderCell: (submission) => (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">{submission.submitted}</span>
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
          renderCell: (submission) => <GradeChip grade={submission.grade} status={submission.status} size="xs" />,
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
          icon: true,
          ariaLabel: (submission) => `Preview ${submission.title}`,
          onClick: (submission) => onPreview(submission.id),
        },
        {
          key: "view",
          label: "View",
          icon: true,
          ariaLabel: (submission) => `Open full record for ${submission.title}`,
          onClick: (submission) => onView(submission.id),
          disabled: () => actionBusy,
        },
        {
          key: "edit",
          label: "Edit",
          icon: true,
          ariaLabel: (submission) => `Edit ${submission.title}`,
          onClick: (submission) => onEdit(submission),
          disabled: () => actionBusy,
        },
        {
          key: "delete",
          label: "Delete",
          icon: true,
          ariaLabel: (submission) => `Delete ${submission.title}`,
          onClick: (submission) => onDelete(submission),
          tone: "danger",
          disabled: () => actionBusy,
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={FileText}
          title="No submissions match this view"
          description="Try clearing the search or status filter to widen the current result set."
        />
      )}
    />
  );
}
