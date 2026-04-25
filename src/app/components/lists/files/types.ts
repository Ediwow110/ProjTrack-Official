export type FileInventoryRecord = {
  storedName: string;
  fileName: string;
  scope: string;
  sizeBytes?: number;
  uploadedAt?: string;
  uploadedByUserId?: string;
  submissionId?: string;
  subjectId?: string;
  relativePath?: string;
  href?: string;
};

export type FileLinkState = "Healthy" | "Warning";

export function normalizeInventoryValue(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function getFileLinkState(file: FileInventoryRecord): FileLinkState {
  return file.submissionId || file.subjectId ? "Healthy" : "Warning";
}

export function formatInventorySize(sizeBytes?: number) {
  if (!sizeBytes || Number.isNaN(sizeBytes)) return "—";
  if (sizeBytes < 1024) return `${Math.max(1, Math.round(sizeBytes))} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatInventoryDate(uploadedAt?: string) {
  if (!uploadedAt) return "—";
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
