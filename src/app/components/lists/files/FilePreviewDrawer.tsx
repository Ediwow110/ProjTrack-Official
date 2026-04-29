import type { ReactNode } from "react";
import { Download, FileText, FolderTree, HardDrive, Link2, UploadCloud } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import {
  formatInventoryDate,
  formatInventorySize,
  getFileLinkState,
  type FileInventoryRecord,
} from "./types";

type FilePreviewDrawerProps = {
  open: boolean;
  file?: FileInventoryRecord | null;
  downloadingPath?: string | null;
  deletingPath?: string | null;
  onClose: () => void;
  onDownload: (file: FileInventoryRecord) => void;
  onDelete: (file: FileInventoryRecord) => void;
};

export function FilePreviewDrawer({
  open,
  file,
  downloadingPath,
  deletingPath,
  onClose,
  onDownload,
  onDelete,
}: FilePreviewDrawerProps) {
  const linkState = file ? getFileLinkState(file) : "Warning";

  return (
    <DetailDrawer
      open={open}
      title={file?.fileName ?? "File details"}
      subtitle={file?.storedName ?? "Inspect stored file metadata and linked submission details."}
      onClose={onClose}
      widthPreset="md"
      footer={
        file ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            {file.relativePath ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(file)}
                disabled={deletingPath === file.relativePath}
              >
                {deletingPath === file.relativePath ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
            {file.relativePath ? (
              <Button
                type="button"
                onClick={() => onDownload(file)}
                disabled={downloadingPath === file.relativePath}
                className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
              >
                <Download size={14} />
                {downloadingPath === file.relativePath ? "Downloading..." : "Download"}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {file ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Inventory item</Eyebrow>
                <SectionTitle className="mt-2">{file.fileName}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review storage metadata, attachment links, and download the original file without leaving the shared list workflow.
                </BodyText>
              </div>
              <StatusChip status={linkState} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard
              label="Scope"
              value={file.scope || "—"}
              icon={<FolderTree size={14} />}
            />
            <MetadataCard
              label="Size"
              value={formatInventorySize(file.sizeBytes)}
              icon={<HardDrive size={14} />}
            />
            <MetadataCard
              label="Uploaded"
              value={formatInventoryDate(file.uploadedAt)}
              icon={<UploadCloud size={14} />}
            />
            <MetadataCard
              label="Link state"
              value={linkState === "Healthy" ? "Linked to portal context" : "Missing portal link"}
              icon={<Link2 size={14} />}
            />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <Eyebrow>Stored reference</Eyebrow>
            <div className="mt-3 space-y-3">
              <DetailRow label="Stored name" value={file.storedName || "—"} />
              <DetailRow label="Relative path" value={file.relativePath || "—"} />
              <DetailRow label="Submission" value={file.submissionId || "—"} />
              <DetailRow label="Subject" value={file.subjectId || "—"} />
              <DetailRow label="Uploaded by" value={file.uploadedByUserId || "—"} />
            </div>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <FileText size={16} />
              <Eyebrow>Download availability</Eyebrow>
            </div>
            <BodyText className="mt-3 text-sm leading-6" tone="default">
              {file.relativePath
                ? "This stored file is ready for secure download from the inventory."
                : "This inventory row does not currently expose a downloadable stored path."}
            </BodyText>
          </div>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function MetadataCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-slate-200/75 bg-white/90 p-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-slate-400 dark:text-slate-300 dark:text-slate-500">
        {icon}
        <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-700/70 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800">
      <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      <p className="break-all text-sm font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
