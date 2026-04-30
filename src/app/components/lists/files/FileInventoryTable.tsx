import { Download, Eye, FileText, Trash2 } from "lucide-react";

import { PortalEmptyState } from "../../portal/PortalPage";
import { StatusChip } from "../../ui/StatusChip";
import { DataTableCard } from "../shared/DataTableCard";
import {
  formatInventoryDate,
  formatInventorySize,
  getFileLinkState,
  type FileInventoryRecord,
} from "./types";

type FileSortKey = "fileName" | "scope" | "sizeBytes" | "uploadedAt" | "linkState";

type FileInventoryTableProps = {
  rows: FileInventoryRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPreview: (id: string) => void;
  onDownload: (file: FileInventoryRecord) => void;
  onDelete: (file: FileInventoryRecord) => void;
  downloadingPath?: string | null;
  deletingPath?: string | null;
  sortState?: {
    columnKey: FileSortKey;
    direction: "asc" | "desc";
  } | null;
  onSortChange?: (columnKey: string) => void;
};

export function FileInventoryTable({
  rows,
  loading = false,
  error = null,
  onRetry,
  onPreview,
  onDownload,
  onDelete,
  downloadingPath,
  deletingPath,
  sortState,
  onSortChange,
}: FileInventoryTableProps) {
  return (
    <DataTableCard
      title="Stored files"
      description="Review uploaded files, linked submission metadata, and download references from one shared inventory table."
      action={loading ? <span className="text-xs font-medium text-slate-400">Loading files...</span> : null}
      columns={[
        {
          key: "fileName",
          header: "File",
          sortable: true,
          renderCell: (file) => (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/70">
                <FileText size={16} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{file.fileName}</p>
                <p className="mt-1 text-[10px] text-slate-400">{file.storedName}</p>
              </div>
            </div>
          ),
        },
        {
          key: "scope",
          header: "Scope",
          sortable: true,
          renderCell: (file) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">{file.scope || "—"}</span>
          ),
        },
        {
          key: "sizeBytes",
          header: "Size",
          sortable: true,
          align: "right",
          renderCell: (file) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {formatInventorySize(file.sizeBytes)}
            </span>
          ),
        },
        {
          key: "uploadedAt",
          header: "Uploaded",
          sortable: true,
          renderCell: (file) => (
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {formatInventoryDate(file.uploadedAt)}
            </span>
          ),
        },
        {
          key: "linkState",
          header: "Link state",
          sortable: true,
          renderCell: (file) => <StatusChip status={getFileLinkState(file)} size="xs" />,
        },
      ]}
      rows={rows}
      rowKey={(file) => file.relativePath || file.storedName || file.fileName}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(file) => onPreview(file.relativePath || file.storedName || file.fileName)}
      sortState={sortState}
      onSortChange={onSortChange}
      rowActions={(file) => [
        {
          key: "preview",
          label: "Preview",
          icon: <Eye size={15} />,
          ariaLabel: `Preview ${file.fileName}`,
          onClick: () => onPreview(file.relativePath || file.storedName || file.fileName),
        },
        {
          key: "download",
          label:
            file.relativePath && downloadingPath === file.relativePath
              ? "Downloading..."
              : "Download",
          icon: <Download size={15} />,
          ariaLabel: `Download ${file.fileName}`,
          onClick: () => onDownload(file),
          hidden: () => !file.relativePath,
          disabled: () => Boolean(file.relativePath && downloadingPath === file.relativePath),
        },
        {
          key: "delete",
          label:
            file.relativePath && deletingPath === file.relativePath
              ? "Deleting..."
              : "Delete",
          icon: <Trash2 size={15} />,
          ariaLabel: `Delete ${file.fileName}`,
          onClick: () => onDelete(file),
          tone: "danger",
          hidden: () => !file.relativePath,
          disabled: () => Boolean(file.relativePath && deletingPath === file.relativePath),
        },
      ]}
      emptyState={(
        <PortalEmptyState
          icon={Download}
          title="No files match this view"
          description="Try clearing the search or filters to widen the current inventory scope."
        />
      )}
    />
  );
}
