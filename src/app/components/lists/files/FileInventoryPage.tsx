import { useEffect, useMemo, useState } from "react";
import { Files, RefreshCcw, XCircle } from "lucide-react";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PortalNotice } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import { FilePreviewDrawer } from "./FilePreviewDrawer";
import { FileInventoryTable } from "./FileInventoryTable";
import { adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import {
  formatInventorySize,
  getFileLinkState,
  normalizeInventoryValue,
  type FileInventoryRecord,
} from "./types";

type FileSortKey = "fileName" | "scope" | "sizeBytes" | "uploadedAt" | "linkState";

function getFileKey(file: FileInventoryRecord) {
  return file.relativePath || file.storedName || file.fileName;
}

export default function FileInventoryPage() {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [linkFilter, setLinkFilter] = useState("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<{
    path: string | null;
    error: string | null;
  }>({ path: null, error: null });
  const [deleteTarget, setDeleteTarget] = useState<FileInventoryRecord | null>(null);
  const [deleteState, setDeleteState] = useState<{
    path: string | null;
    error: string | null;
  }>({ path: null, error: null });
  const [sortState, setSortState] = useState<{
    columnKey: FileSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "uploadedAt", direction: "desc" });

  const { data, loading, error, reload } = useAsyncData(
    () => adminService.getFileInventory(scopeFilter === "All" ? undefined : scopeFilter),
    [scopeFilter],
  );

  const allFiles = data ?? [];
  const scopeOptions = useMemo(
    () =>
      Array.from(
        new Set(allFiles.map((file) => file.scope).filter((value): value is string => Boolean(value))),
      ).sort((left, right) => left.localeCompare(right)),
    [allFiles],
  );
  const filteredFiles = allFiles.filter((file) => {
    const query = normalizeInventoryValue(search.trim());
    const matchesSearch =
      !query ||
      normalizeInventoryValue(file.fileName).includes(query) ||
      normalizeInventoryValue(file.storedName).includes(query) ||
      normalizeInventoryValue(file.scope).includes(query) ||
      normalizeInventoryValue(file.submissionId).includes(query) ||
      normalizeInventoryValue(file.subjectId).includes(query);
    const linkState = getFileLinkState(file);
    const matchesLink =
      linkFilter === "All" ||
      (linkFilter === "Linked" && linkState === "Healthy") ||
      (linkFilter === "Unlinked" && linkState === "Warning");

    return matchesSearch && matchesLink;
  });
  const files = [...filteredFiles].sort((left, right) => {
    if (!sortState) return 0;
    const direction = sortState.direction === "asc" ? 1 : -1;
    const pickValue = (file: FileInventoryRecord) => {
      switch (sortState.columnKey) {
        case "fileName":
          return normalizeInventoryValue(file.fileName);
        case "scope":
          return normalizeInventoryValue(file.scope);
        case "sizeBytes":
          return String(file.sizeBytes ?? 0).padStart(12, "0");
        case "linkState":
          return normalizeInventoryValue(getFileLinkState(file));
        case "uploadedAt":
        default:
          return normalizeInventoryValue(file.uploadedAt);
      }
    };
    return pickValue(left).localeCompare(pickValue(right)) * direction;
  });
  const previewFile =
    files.find((file) => getFileKey(file) === previewId) ??
    allFiles.find((file) => getFileKey(file) === previewId) ??
    null;
  const linkedCount = files.filter((file) => getFileLinkState(file) === "Healthy").length;
  const unlinkedCount = files.filter((file) => getFileLinkState(file) === "Warning").length;
  const downloadableCount = files.filter((file) => Boolean(file.relativePath)).length;
  const totalSizeBytes = files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
  const hasActiveFilters = Boolean(search.trim()) || scopeFilter !== "All" || linkFilter !== "All";
  const activeFilterItems = [
    search.trim()
      ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }
      : null,
    scopeFilter !== "All"
      ? { key: "scope", label: `Scope: ${scopeFilter}`, onRemove: () => setScopeFilter("All") }
      : null,
    linkFilter !== "All"
      ? { key: "link", label: `Link: ${linkFilter}`, onRemove: () => setLinkFilter("All") }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  useEffect(() => {
    if (previewId && !previewFile) {
      setPreviewId(null);
    }
  }, [previewFile, previewId]);

  async function handleDownload(file: FileInventoryRecord) {
    if (!file.relativePath || downloadState.path) return;
    setDownloadState({ path: file.relativePath, error: null });
    try {
      await adminService.downloadInventoryFile(file.relativePath, file.fileName);
      setDownloadState({ path: null, error: null });
    } catch (downloadError) {
      setDownloadState({
        path: null,
        error:
          downloadError instanceof Error
            ? downloadError.message
            : "Unable to download the selected file.",
      });
    }
  }

  async function confirmDeleteFile() {
    const relativePath = deleteTarget?.relativePath;
    if (!relativePath || deleteState.path) return;
    setDeleteState({ path: relativePath, error: null });
    try {
      await adminService.deleteInventoryFile(relativePath);
      if (previewId && deleteTarget && getFileKey(deleteTarget) === previewId) {
        setPreviewId(null);
      }
      setDeleteTarget(null);
      setDeleteState({ path: null, error: null });
      await reload();
    } catch (deleteError) {
      setDeleteState({
        path: null,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete the selected file.",
      });
    }
  }

  function resetFilters() {
    setSearch("");
    setScopeFilter("All");
    setLinkFilter("All");
  }

  return (
    <>
      <RoleListShell
      tone="slate"
      eyebrow="Storage Oversight"
      title="File Inventory"
      subtitle="Inspect stored files, linked submission context, and secure downloads from one shared operational workspace."
      icon={Files}
      meta={[
        { label: "Scope", value: scopeFilter === "All" ? "All scopes" : scopeFilter },
        { label: "Link state", value: linkFilter === "All" ? "All files" : linkFilter },
      ]}
      stats={[
        {
          label: "Visible files",
          value: loading ? "..." : String(files.length),
          hint: "Current result set after search and inventory filters.",
        },
        {
          label: "Linked",
          value: loading ? "..." : String(linkedCount),
          hint: "Files already attached to a subject or submission record.",
        },
        {
          label: "Unlinked",
          value: loading ? "..." : String(unlinkedCount),
          hint: "Files that need metadata review or context mapping.",
        },
        {
          label: "Visible size",
          value: loading ? "..." : formatInventorySize(totalSizeBytes),
          hint: `Downloadable files in current view: ${downloadableCount}.`,
        },
      ]}
      actions={(
        <>
          <Button
            type="button"
            disabled={loading || Boolean(downloadState.path) || Boolean(deleteState.path)}
            onClick={reload}
            variant="outline"
            className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
          >
            <RefreshCcw size={14} />
            Refresh
          </Button>
        </>
      )}
      toolbar={(
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search files by name, scope, submission, or subject"
          primaryFilters={(
            <>
              <FilterSelect
                label="Scope"
                value={scopeFilter}
                onChange={setScopeFilter}
                options={[
                  { value: "All", label: "All scopes" },
                  ...scopeOptions.map((scope) => ({ value: scope, label: scope })),
                ]}
              />
              <FilterSelect
                label="Link state"
                value={linkFilter}
                onChange={setLinkFilter}
                options={[
                  { value: "All", label: "All files" },
                  { value: "Linked", label: "Linked" },
                  { value: "Unlinked", label: "Unlinked" },
                ]}
              />
            </>
          )}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      )}
      activeFilters={<ActiveFilterChips items={activeFilterItems} onClearAll={resetFilters} />}
      notices={(
        <div className="space-y-3">
          {error ? (
            <PortalNotice tone="danger" icon={<XCircle size={16} />}>
              {error}
            </PortalNotice>
          ) : null}
          {downloadState.error ? (
            <PortalNotice tone="danger" icon={<XCircle size={16} />}>
              {downloadState.error}
            </PortalNotice>
          ) : null}
          {deleteState.error ? (
            <PortalNotice tone="danger" icon={<XCircle size={16} />}>
              {deleteState.error}
            </PortalNotice>
          ) : null}
          {linkFilter === "Unlinked" ? (
            <PortalNotice tone="warning">
              Showing files that are missing a linked submission or subject reference.
            </PortalNotice>
          ) : null}
        </div>
      )}
      drawer={(
        <FilePreviewDrawer
          open={Boolean(previewFile)}
          file={previewFile}
          downloadingPath={downloadState.path}
          deletingPath={deleteState.path}
          onClose={() => setPreviewId(null)}
          onDownload={handleDownload}
          onDelete={(file) => setDeleteTarget(file)}
        />
      )}
      >
        <FileInventoryTable
          rows={files}
          loading={loading}
          error={error}
          onRetry={reload}
          onPreview={setPreviewId}
          onDownload={handleDownload}
          onDelete={(file) => setDeleteTarget(file)}
          downloadingPath={downloadState.path}
          deletingPath={deleteState.path}
          sortState={sortState}
          onSortChange={(columnKey) =>
            setSortState((current) => {
              if (!current || current.columnKey !== columnKey) {
                return { columnKey: columnKey as FileSortKey, direction: "asc" };
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
        open={Boolean(deleteTarget)}
        title="Delete this file?"
        description="This removes the stored file from the shared inventory. Use this only for files that are no longer needed."
        confirmLabel="Delete file"
        tone="danger"
        loading={Boolean(deleteState.path)}
        onCancel={() => {
          if (!deleteState.path) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDeleteFile}
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
