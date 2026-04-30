import { useMemo, useState } from "react";
import { Download, FileText, Plus, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { SubmissionsTable } from "./SubmissionsTable";
import { SubmissionPreviewDrawer } from "./SubmissionPreviewDrawer";
import { adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import { Button } from "../../ui/button";
import { AppModal } from "../../ui/app-modal";
import type { AdminSubmissionRecord, AdminSubmissionUpsertInput } from "../../../lib/api/contracts";

const statuses = [
  "All",
  "Submitted",
  "Late",
  "Reviewed",
  "Graded",
  "Returned for Revision",
  "Pending",
  "Draft",
] as const;

type SubmissionSortKey = "title" | "student" | "subject" | "status" | "submitted";

const initialForm: AdminSubmissionUpsertInput = {
  taskId: "",
  subjectId: "",
  studentId: "",
  groupId: "",
  title: "",
  status: "SUBMITTED",
  grade: "",
  feedback: "",
  notes: "",
  submittedAt: "",
  externalLinks: [],
};

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: SubmissionSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "submitted", direction: "desc" });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<AdminSubmissionRecord | null>(null);
  const [form, setForm] = useState<AdminSubmissionUpsertInput>(initialForm);
  const [linksInput, setLinksInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminSubmissionRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => adminService.getSubmissions({ search, status: statusFilter }),
    [search, statusFilter],
  );

  const submissions = useMemo(() => {
    const rows = data ?? [];
    return [...rows].sort((left, right) => {
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
  }, [data, sortState]);

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

  function openCreateModal() {
    setModalMode("create");
    setEditingSubmission(null);
    setForm(initialForm);
    setLinksInput("");
    setActionState({ busy: false, error: null });
  }

  function openEditModal(submission: AdminSubmissionRecord) {
    setModalMode("edit");
    setEditingSubmission(submission);
    setForm({
      taskId: submission.taskId || "",
      subjectId: submission.subjectId || "",
      studentId: submission.studentId || "",
      groupId: submission.groupId || "",
      title: submission.title,
      status: submission.statusKey || submission.status,
      grade: submission.grade === "—" ? "" : submission.grade,
      feedback: submission.feedback || "",
      notes: submission.notes || "",
      submittedAt: "",
      externalLinks: submission.externalLinks || [],
    });
    setLinksInput((submission.externalLinks || []).join("\n"));
    setActionState({ busy: false, error: null });
  }

  async function saveSubmission() {
    if (actionState.busy || !modalMode) return;
    setActionState({ busy: true, error: null });
    setFeedback(null);
    const payload: AdminSubmissionUpsertInput = {
      ...form,
      externalLinks: parseLinks(linksInput),
    };

    try {
      if (modalMode === "create") {
        await adminService.createSubmission(payload);
        setFeedback({
          tone: "success",
          message: "Manual submission record created successfully.",
        });
      } else if (editingSubmission) {
        await adminService.updateSubmission(editingSubmission.id, {
          status: payload.status,
          grade: payload.grade,
          feedback: payload.feedback,
          notes: payload.notes,
          submittedAt: payload.submittedAt,
          externalLinks: payload.externalLinks,
        });
        setFeedback({
          tone: "success",
          message: "Submission details updated successfully.",
        });
      }

      setModalMode(null);
      setEditingSubmission(null);
      setForm(initialForm);
      setLinksInput("");
      await reload();
      setActionState({ busy: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save the submission.";
      setActionState({ busy: false, error: message });
    }
  }

  async function deleteSubmission() {
    if (!deleteTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    setFeedback(null);
    try {
      await adminService.deleteSubmission(deleteTarget.id, "DELETE");
      setFeedback({
        tone: "success",
        message: "Submission deleted successfully.",
      });
      setDeleteTarget(null);
      setDeleteConfirmation("");
      await reload();
      setActionState({ busy: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete the submission.";
      setActionState({ busy: false, error: message });
    }
  }

  return (
    <RoleListShell
      tone="slate"
      eyebrow="Global Oversight"
      title="Submissions"
      subtitle="Monitor grading state, submission ownership, and admin cleanup actions through one operational workspace."
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
            disabled={loading || actionState.busy}
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
          <Button
            type="button"
            onClick={openCreateModal}
            className="bg-white text-slate-900 hover:bg-slate-100"
          >
            <Plus size={14} />
            Add Submission
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
      notices={
        <div className="space-y-3">
          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
          {actionState.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {actionState.error}
            </div>
          ) : null}
        </div>
      }
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
        actionBusy={actionState.busy}
        onRetry={reload}
        onPreview={setPreviewId}
        onView={openSubmission}
        onEdit={openEditModal}
        onDelete={(submission) => {
          setDeleteTarget(submission);
          setDeleteConfirmation("");
        }}
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

      <AppModal
        open={Boolean(modalMode)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setModalMode(null);
            setEditingSubmission(null);
          }
        }}
        title={modalMode === "edit" ? "Edit Submission" : "Add Submission"}
        description={
          modalMode === "edit"
            ? "Update status, grading, feedback, notes, or external links."
            : "Create a manual submission record when operational support requires it."
        }
        size="lg"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setModalMode(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={actionState.busy} onClick={saveSubmission}>
              {actionState.busy ? "Saving..." : modalMode === "edit" ? "Save Changes" : "Create Submission"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Title"
            value={form.title}
            onChange={(value) => setForm((current) => ({ ...current, title: value }))}
            disabled={modalMode === "edit"}
          />
          <Field
            label="Status"
            value={form.status}
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          />
          <Field
            label="Task ID"
            value={form.taskId}
            onChange={(value) => setForm((current) => ({ ...current, taskId: value }))}
            disabled={modalMode === "edit"}
          />
          <Field
            label="Subject ID"
            value={form.subjectId}
            onChange={(value) => setForm((current) => ({ ...current, subjectId: value }))}
            disabled={modalMode === "edit"}
          />
          <Field
            label="Student ID"
            value={form.studentId ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, studentId: value, groupId: value ? "" : current.groupId }))}
            disabled={modalMode === "edit"}
          />
          <Field
            label="Group ID"
            value={form.groupId ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, groupId: value, studentId: value ? "" : current.studentId }))}
            disabled={modalMode === "edit"}
          />
          <Field
            label="Grade"
            value={form.grade ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, grade: value }))}
          />
          <Field
            label="Submitted At"
            type="datetime-local"
            value={form.submittedAt ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, submittedAt: value }))}
          />
          <TextAreaField
            label="Feedback"
            value={form.feedback ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, feedback: value }))}
            className="sm:col-span-2"
          />
          <TextAreaField
            label="Admin Notes"
            value={form.notes ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
            className="sm:col-span-2"
          />
          <TextAreaField
            label="External Links"
            value={linksInput}
            onChange={setLinksInput}
            placeholder="One URL per line"
            className="sm:col-span-2"
          />
        </div>
      </AppModal>

      <AppModal
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
            setDeleteConfirmation("");
          }
        }}
        title="Delete submission?"
        description="This will permanently remove the submission record, file records, grade, feedback, and admin notes."
        size="md"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionState.busy || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
              onClick={deleteSubmission}
            >
              {actionState.busy ? "Deleting..." : "Delete Submission"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Type <span className="font-semibold">DELETE</span> to confirm this destructive action.
          </p>
          <input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          />
        </div>
      </AppModal>
    </RoleListShell>
  );
}

function parseLinks(value: string) {
  return value
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:disabled:bg-slate-800"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`space-y-2 ${className ?? ""}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
      />
    </label>
  );
}
