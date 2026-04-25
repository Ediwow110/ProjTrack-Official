import { useState } from "react";
import { Download, FileText, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { SubmissionsTable } from "./SubmissionsTable";
import { SubmissionPreviewDrawer } from "./SubmissionPreviewDrawer";
import { adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import { Button } from "../../ui/button";
import type { AdminSubmissionRecord } from "../../../lib/api/contracts";

const statuses = [
  "All",
  "Submitted",
  "Late",
  "Reviewed",
  "Graded",
  "Returned for Revision",
  "Pending",
] as const;

type SubmissionSortKey = "title" | "student" | "subject" | "status" | "submitted";

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: SubmissionSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "submitted", direction: "desc" });

  const { data, loading, error, reload } = useAsyncData(
    () => adminService.getSubmissions({ search, status: statusFilter }),
    [search, statusFilter],
  );

  const allSubmissions = data ?? [];
  const submissions = [...allSubmissions].sort((left, right) => {
    if (!sortState) return 0;
    const direction = sortState.direction === "asc" ? 1 : -1;
    const pickValue = (submission: AdminSubmissionRecord) => {
      switch (sortState.columnKey) {
        case "title":
          return submission.title.toLowerCase();
        case "student":
          return submission.student.toLowerCase();
        case "subject":
          return `${submission.subject} ${submission.section}`.toLowerCase();
        case "status":
          return submission.status.toLowerCase();
        case "submitted":
        default:
          return submission.submitted.toLowerCase();
      }
    };

    return pickValue(left).localeCompare(pickValue(right)) * direction;
  });
  const previewSubmission = submissions.find((submission) => submission.id === previewId) ?? null;
  const gradedCount = submissions.filter((submission) => submission.status === "Graded").length;
  const lateCount = submissions.filter((submission) => submission.status === "Late").length;
  const pendingCount = submissions.filter((submission) => submission.status === "Pending").length;
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "All";
  const activeFilterItems = [
    search.trim()
      ? { key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }
      : null,
    statusFilter !== "All"
      ? { key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("All") }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function openSubmission(submissionId: string) {
    navigate(`/admin/submissions/${submissionId}`);
  }

  return (
    <RoleListShell
      tone="slate"
      eyebrow="Global Oversight"
      title="Submissions"
      subtitle="Monitor grading state, student ownership, and submission health through one shared operational workspace."
      icon={FileText}
      meta={[
        { label: "Status filter", value: statusFilter === "All" ? "All statuses" : statusFilter },
        { label: "Current scope", value: "Admin submissions" },
      ]}
      stats={[
        {
          label: "Visible submissions",
          value: loading ? "..." : String(submissions.length),
          hint: "Current result set after search and status filters.",
        },
        {
          label: "Graded",
          value: loading ? "..." : String(gradedCount),
          hint: "Submissions already graded in the current view.",
        },
        {
          label: "Late",
          value: loading ? "..." : String(lateCount),
          hint: "Late work that may need operational follow-up.",
        },
        {
          label: "Pending",
          value: loading ? "..." : String(pendingCount),
          hint: "Records still waiting for review or completion.",
        },
      ]}
      actions={(
        <>
          <Button
            type="button"
            disabled={loading}
            onClick={reload}
            variant="outline"
            className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
          >
            <RefreshCcw size={14} />
            Refresh
          </Button>
          <Button
            type="button"
            disabled={loading || submissions.length === 0}
            onClick={() => adminService.exportSubmissionsCsv(submissions)}
            variant="outline"
            className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
          >
            <Download size={14} />
            Export
          </Button>
        </>
      )}
      toolbar={(
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search submissions by title, student, or subject"
          primaryFilters={(
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statuses.map((status) => ({ value: status, label: status === "All" ? "All statuses" : status }))}
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
      drawer={(
        <SubmissionPreviewDrawer
          open={Boolean(previewSubmission)}
          submission={previewSubmission}
          onClose={() => setPreviewId(null)}
          onView={openSubmission}
        />
      )}
    >
      <SubmissionsTable
        rows={submissions}
        loading={loading}
        error={error}
        onRetry={reload}
        onPreview={setPreviewId}
        onView={openSubmission}
        sortState={sortState}
        onSortChange={(columnKey) =>
          setSortState((current) => {
            if (!current || current.columnKey !== columnKey) {
              return { columnKey: columnKey as SubmissionSortKey, direction: "asc" };
            }

            return {
              columnKey: current.columnKey,
              direction: current.direction === "asc" ? "desc" : "asc",
            };
          })
        }
      />
    </RoleListShell>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[var(--radius-control)] border border-slate-200/80 bg-white px-3 text-sm text-slate-700 shadow-[var(--shadow-soft)] outline-none focus:border-[var(--role-accent)] dark:border-slate-700/60 dark:bg-[var(--surface-soft)] dark:text-slate-100"
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
