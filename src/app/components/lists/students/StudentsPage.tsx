import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Mail,
  Plus,
  RefreshCcw,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

import { RoleListShell } from "../shared/RoleListShell";
import { FilterToolbar } from "../shared/FilterToolbar";
import { ActiveFilterChips } from "../shared/ActiveFilterChips";
import { BulkActionBar } from "../shared/BulkActionBar";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { StudentsTable } from "./StudentsTable";
import { StudentPreviewDrawer } from "./StudentPreviewDrawer";
import { PortalNotice } from "../../portal/PortalListPage";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { AppModal } from "../../ui/app-modal";
import { adminCatalogService, adminService } from "../../../lib/api/services";
import { useAsyncData } from "../../../lib/hooks/useAsyncData";
import type {
  AdminAcademicYearRecord,
  AdminSectionRecord,
  AdminStudentImportPreviewRow,
  AdminStudentRecord,
  AdminStudentUpsertInput,
  StudentStatus,
} from "../../../lib/api/contracts";

const initialCreateForm: AdminStudentUpsertInput = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  studentNumber: "",
  section: "",
  academicYearId: "",
  academicYear: "",
  course: "",
  yearLevel: "",
  yearLevelId: "",
  yearLevelName: "",
};

function describeSectionOption(section: AdminSectionRecord) {
  const details = [
    String(section.academicYear ?? section.ay ?? "").trim(),
    String(section.program ?? "").trim(),
    String(section.yearLevelName ?? section.yearLevelLabel ?? "").trim() || String(section.yearLevel || "").trim(),
  ].filter(Boolean);

  return details.length > 0 ? `${section.code} · ${details.join(" · ")}` : section.code;
}

function buildCreateStudentForm(
  sectionId: string,
  sections: AdminSectionRecord[],
  academicYearId: string,
  academicYearLabel: string,
): AdminStudentUpsertInput {
  const selectedSection = sections.find((section) => section.id === sectionId || section.code === sectionId);
  return {
    ...initialCreateForm,
    section: selectedSection?.id ?? "",
    academicYearId: selectedSection?.academicYearId ?? academicYearId,
    academicYear: selectedSection?.academicYear ?? selectedSection?.ay ?? academicYearLabel,
    course: selectedSection?.program ?? "",
    yearLevel: selectedSection?.yearLevelName ?? selectedSection?.yearLevelLabel ?? selectedSection?.yearLevel ?? "",
    yearLevelId: selectedSection?.yearLevelId ?? "",
    yearLevelName:
      selectedSection?.yearLevelName ??
      selectedSection?.yearLevelLabel ??
      selectedSection?.yearLevel ??
      "",
  };
}

type StudentSortKey =
  | "studentId"
  | "lastName"
  | "firstName"
  | "middleInitial"
  | "yearLevel"
  | "section"
  | "course"
  | "academicYear"
  | "status";

export default function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl =
    searchParams.get("sectionId")?.trim() ??
    searchParams.get("section")?.trim() ??
    "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState(sectionFromUrl);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortState, setSortState] = useState<{
    columnKey: StudentSortKey;
    direction: "asc" | "desc";
  } | null>({ columnKey: "lastName", direction: "asc" });
  const [selected, setSelected] = useState<string[]>([]);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminStudentRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AdminStudentUpsertInput>({
    ...initialCreateForm,
    section: sectionFromUrl,
  });
  const [academicYears, setAcademicYears] = useState<AdminAcademicYearRecord[]>([]);
  const [sectionOptions, setSectionOptions] = useState<AdminSectionRecord[]>([]);
  const [createState, setCreateState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });
  const [importState, setImportState] = useState<{
    processing: boolean;
    error: string | null;
  }>({ processing: false, error: null });
  const [importFilename, setImportFilename] = useState("");
  const [previewRows, setPreviewRows] = useState<AdminStudentImportPreviewRow[]>([]);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [actionState, setActionState] = useState<{
    busy: boolean;
    error: string | null;
  }>({ busy: false, error: null });

  const { data, loading, error, setData, reload } = useAsyncData(
    () => adminService.getStudents({ search, status: statusFilter }),
    [search, statusFilter],
  );

  const validPreviewRows = previewRows.filter((row) => row.validationErrors.length === 0);
  const invalidPreviewRows = previewRows.filter((row) => row.validationErrors.length > 0);
  const allStudents = data ?? [];
  const activeAcademicYear =
    academicYears.find((year) => year.status === "Active") ?? academicYears[0] ?? null;
  const activeAcademicYearId = activeAcademicYear?.id ?? "";
  const activeAcademicYearLabel = activeAcademicYear?.name ?? "Not configured";
  const activeSectionRecord =
    sectionOptions.find((section) => section.id === activeSection) ??
    sectionOptions.find((section) => section.code === activeSection) ??
    null;
  const filteredStudents = allStudents.filter((student) =>
    !activeSection || student.sectionId === activeSection || student.section === activeSection,
  );
  const students = [...filteredStudents].sort((left, right) => {
    if (!sortState) return 0;

    const direction = sortState.direction === "asc" ? 1 : -1;
    const pickValue = (student: AdminStudentRecord) => {
      switch (sortState.columnKey) {
        case "studentId":
          return String(student.studentId || student.id || "").toLowerCase();
        case "lastName":
          return String(student.lastName || "").toLowerCase();
        case "firstName":
          return String(student.firstName || "").toLowerCase();
        case "middleInitial":
          return String(student.middleInitial || "").toLowerCase();
        case "yearLevel":
          return String(student.yearLevel || "").toLowerCase();
        case "academicYear":
          return String(student.academicYear || "").toLowerCase();
        case "section":
          return String(student.section || "").toLowerCase();
        case "course":
          return String(student.course || "").toLowerCase();
        case "status":
          return student.status.toLowerCase();
        default:
          return String(student.lastName || "").toLowerCase();
      }
    };

    return pickValue(left).localeCompare(pickValue(right)) * direction;
  });
  const selectedStudents = students.filter((student) => selected.includes(student.id));
  const previewStudent =
    students.find((student) => student.id === previewStudentId) ??
    allStudents.find((student) => student.id === previewStudentId) ??
    null;
  const activeCount = students.filter((student) => student.status === "Active").length;
  const pendingSetupCount = students.filter((student) => student.status === "Pending Setup").length;
  const yearLevelOptions = (activeAcademicYear?.yearLevels ?? []).map((level) => ({
    value: level.id,
    label: level.name,
  }));
  const filteredCreateSectionOptions = sectionOptions.filter((section) => {
    const matchesAcademicYear =
      !activeAcademicYearId || section.academicYearId === activeAcademicYearId;
    const matchesCourse =
      !createForm.course?.trim() ||
      section.program.toLowerCase() === createForm.course.trim().toLowerCase();
    const matchesYearLevel =
      !createForm.yearLevelId ||
      section.yearLevelId === createForm.yearLevelId ||
      String(section.yearLevelName || section.yearLevelLabel || section.yearLevel || "").trim() ===
        String(createForm.yearLevelName || createForm.yearLevel || "").trim();

    return matchesAcademicYear && matchesCourse && matchesYearLevel;
  });
  const sectionSelectionDisabled =
    !activeAcademicYearId || !createForm.yearLevelId || filteredCreateSectionOptions.length === 0;
  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(activeSection) ||
    statusFilter !== "All";

  useEffect(() => {
    setActiveSection(sectionFromUrl);
    setCreateForm((current) => {
      if (!sectionFromUrl) return current;
      return {
        ...current,
        section: sectionFromUrl,
      };
    });
  }, [sectionFromUrl]);

  useEffect(() => {
    if (!activeAcademicYearId) return;
    setCreateForm((current) => {
      if (current.academicYearId === activeAcademicYearId && current.academicYear === activeAcademicYearLabel) {
        return current;
      }
      return {
        ...current,
        academicYearId: activeAcademicYearId,
        academicYear: activeAcademicYearLabel,
      };
    });
  }, [activeAcademicYearId, activeAcademicYearLabel]);

  useEffect(() => {
    setSelected([]);
  }, [search, statusFilter, activeSection]);

  useEffect(() => {
    if (previewStudentId && !previewStudent) {
      setPreviewStudentId(null);
    }
  }, [previewStudentId, previewStudent]);

  useEffect(() => {
    if (!createForm.yearLevelId) {
      if (createForm.section) {
        setCreateForm((current) => ({ ...current, section: "" }));
      }
      return;
    }

    if (
      createForm.section &&
      !filteredCreateSectionOptions.some((section) => section.id === createForm.section)
    ) {
      setCreateForm((current) => ({ ...current, section: "" }));
    }
  }, [createForm.yearLevelId, createForm.section, filteredCreateSectionOptions]);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminCatalogService.getSections(),
      adminCatalogService.getAcademicYears(),
    ])
      .then(([rows, years]) => {
        if (!active) return;
        setSectionOptions(rows);
        setAcademicYears(years);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const activeFilterItems = [
    search.trim()
      ? {
          key: "search",
          label: `Search: ${search.trim()}`,
          onRemove: () => setSearch(""),
        }
      : null,
    activeSection
      ? {
          key: "section",
          label: `Section: ${activeSectionRecord?.code ?? activeSection}`,
          onRemove: () => updateSectionFilter(""),
        }
      : null,
    statusFilter !== "All"
      ? {
          key: "status",
          label: `Status: ${statusFilter}`,
          onRemove: () => setStatusFilter("All"),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function updateSectionFilter(value: string) {
    setActiveSection(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set("sectionId", value);
    } else {
      nextParams.delete("sectionId");
      nextParams.delete("section");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function showFeedback(tone: "success" | "error" | "warning", message: string) {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  function updateStudentPatch(studentId: string, patch: Partial<AdminStudentRecord>) {
    setData((current) =>
      (current ?? []).map((student) =>
        student.id === studentId ? { ...student, ...patch } : student,
      ),
    );
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleAll() {
    setSelected((current) =>
      current.length === students.length ? [] : students.map((student) => student.id),
    );
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("All");
    updateSectionFilter("");
  }

  function openCreate() {
    setCreateForm(
      buildCreateStudentForm(
        activeSection,
        sectionOptions,
        activeAcademicYearId,
        activeAcademicYearLabel,
      ),
    );
    setCreateState({ saving: false, error: null });
    setCreateOpen(true);
  }

  function openImport() {
    setImportOpen(true);
    setImportState({ processing: false, error: null });
    setImportFilename("");
    setPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openStudentPage(studentId: string) {
    navigate(`/admin/students/${studentId}`);
  }

  async function sendSetupLink(student: AdminStudentRecord) {
    const response =
      student.status === "Pending Setup"
        ? await adminService.sendStudentSetupInvite(student.id)
        : await adminService.sendStudentResetLink(student.id);
    if (!response.mailJobId) {
      throw new Error("The backend did not confirm a queued mail job.");
    }
    updateStudentPatch(student.id, {
      status: student.status === "Pending Setup" ? "Pending Setup" : student.status,
      lastActive: student.status === "Pending Setup" ? "Setup email queued" : "Reset email queued",
    });
    return response;
  }

  async function handleSendSetupLink(studentId: string) {
    if (actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      const student = allStudents.find((item) => item.id === studentId);
      if (!student) {
        throw new Error("Unable to find the selected student.");
      }
      const response = await sendSetupLink(student);
      await reload();
      setActionState({ busy: false, error: null });
      showFeedback(
        "success",
        `${
          student.status === "Pending Setup" ? "Setup invite" : "Password reset"
        } mail job queued for ${student.name}${response.mailJobId ? ` (${response.mailJobId})` : ""}. Open Mail Jobs to watch delivery.`,
      );
    } catch (setupError) {
      const message =
        setupError instanceof Error
          ? setupError.message
          : "Unable to send the setup link.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleBulkSetupLinks() {
    if (actionState.busy || selectedStudents.length === 0) return;
    setActionState({ busy: true, error: null });
    try {
      for (const student of selectedStudents) {
        if (
          student.status === "Inactive" ||
          student.status === "Restricted" ||
          student.status === "Disabled" ||
          student.status === "Archived" ||
          student.status === "Graduated"
        ) {
          continue;
        }
        await sendSetupLink(student);
      }
      await reload();
      setSelected([]);
      setActionState({ busy: false, error: null });
      showFeedback(
        "success",
        `${selectedStudents.length} student account${selectedStudents.length > 1 ? "s" : ""} processed for setup or reset delivery.`,
      );
    } catch (bulkError) {
      const message =
        bulkError instanceof Error
          ? bulkError.message
          : "Unable to process the selected student accounts.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await adminService.deactivateStudent(deactivateTarget.id);
      updateStudentPatch(deactivateTarget.id, {
        status: "Inactive" as StudentStatus,
        lastActive: "Access disabled",
      });
      await reload();
      setSelected((current) => current.filter((value) => value !== deactivateTarget.id));
      showFeedback("success", `${deactivateTarget.name} was moved to inactive status.`);
      setDeactivateTarget(null);
      setActionState({ busy: false, error: null });
    } catch (deactivateError) {
      const message =
        deactivateError instanceof Error
          ? deactivateError.message
          : "Unable to deactivate this student.";
      setActionState({ busy: false, error: message });
      showFeedback("error", message);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportState({ processing: false, error: null });
      const rows = await adminService.parseStudentImport(file, allStudents);
      setImportFilename(file.name);
      setPreviewRows(rows);
    } catch (importError) {
      setImportState({
        processing: false,
        error:
          importError instanceof Error
            ? importError.message
            : "Unable to read the selected file.",
      });
      showFeedback(
        "error",
        importError instanceof Error
          ? importError.message
          : "Unable to read the selected file.",
      );
    }
  }

  async function handleConfirmImport() {
    if (validPreviewRows.length === 0) {
      showFeedback("error", "There are no valid rows to import.");
      return;
    }

    try {
      setImportState({ processing: true, error: null });
      const result = await adminService.confirmStudentImport(validPreviewRows);

      await reload();
      setImportOpen(false);
      setPreviewRows([]);
      setImportFilename("");
      setImportState({ processing: false, error: null });
      showFeedback(
        "success",
        `Import complete: ${result.summary.created} created, ${result.summary.updatedOrSkipped} updated/skipped, ${result.summary.invalidRows} invalid row${result.summary.invalidRows === 1 ? "" : "s"}, ${result.summary.pendingSetup} pending setup.`,
      );
    } catch (confirmError) {
      setImportState({
        processing: false,
        error:
          confirmError instanceof Error
            ? confirmError.message
            : "Unable to confirm the import batch.",
      });
      showFeedback(
        "error",
        confirmError instanceof Error
          ? confirmError.message
          : "Unable to confirm the import batch.",
      );
    }
  }

  async function handleCreateStudent() {
    setCreateState({ saving: true, error: null });
    try {
      await adminService.createStudent({
        ...createForm,
        academicYearId: createForm.academicYearId || activeAcademicYearId,
        academicYear: createForm.academicYear || activeAcademicYearLabel,
      });
      await reload();
      setCreateOpen(false);
      setCreateForm({
        ...initialCreateForm,
        academicYearId: activeAcademicYearId,
        academicYear: activeAcademicYearLabel,
      });
      setCreateState({ saving: false, error: null });
      showFeedback(
        "success",
        "Student created. They can set up their password using Forgot Password, or you can send a setup link manually.",
      );
    } catch (createError) {
      setCreateState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create student.",
      });
    }
  }

  const notices = (
    <div className="space-y-3">
      {error ? (
        <PortalNotice tone="danger" icon={<XCircle size={16} />}>
          {error}
        </PortalNotice>
      ) : null}
      {actionState.error ? (
        <PortalNotice tone="danger" icon={<XCircle size={16} />}>
          {actionState.error}
        </PortalNotice>
      ) : null}
      {feedback ? (
        <PortalNotice
          tone={
            feedback.tone === "success"
              ? "success"
              : feedback.tone === "warning"
                ? "warning"
                : "danger"
          }
          icon={
            feedback.tone === "success" ? (
              <CheckCircle2 size={16} />
            ) : feedback.tone === "warning" ? (
              <AlertTriangle size={16} />
            ) : (
              <XCircle size={16} />
            )
          }
        >
          {feedback.message}
        </PortalNotice>
      ) : null}
      {activeSection ? (
        <PortalNotice tone="info">
          Showing students filtered by section:{" "}
          <span className="font-semibold">{activeSectionRecord?.code ?? activeSection}</span>.
        </PortalNotice>
      ) : null}
      {statusFilter === "Pending Setup" ? (
        <PortalNotice tone="warning">
          Showing students who still need to create their first password.
        </PortalNotice>
      ) : null}
    </div>
  );

  return (
    <>
      <RoleListShell
        tone="slate"
        eyebrow="Directory Management"
        title="Students"
        subtitle="Manage student records, setup links, import batches, and quick previews from one shared operational workspace."
        icon={Users}
        meta={[
          {
            label: "Current section",
            value: activeSection ? activeSectionRecord?.code ?? activeSection : "All sections",
          },
          {
            label: "Status filter",
            value: statusFilter === "All" ? "All statuses" : statusFilter,
          },
        ]}
        stats={[
          {
            label: "Visible students",
            value: loading ? "..." : String(students.length),
            hint: "Current result set after search, section, and status filters.",
          },
          {
            label: "Active",
            value: loading ? "..." : String(activeCount),
            hint: "Students currently able to access the portal.",
          },
          {
            label: "Needs setup",
            value: loading ? "..." : String(pendingSetupCount),
            hint: "Accounts still waiting for first-time password setup.",
          },
          {
            label: "Selected",
            value: String(selected.length),
            hint: "Rows ready for shared bulk actions.",
          },
        ]}
        actions={(
          <>
            <Button
              type="button"
              disabled={loading || actionState.busy}
              onClick={() => {
                setSelected([]);
                reload();
              }}
              variant="outline"
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCcw size={14} />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={loading || actionState.busy}
              onClick={() => adminService.downloadStudentTemplate()}
              variant="outline"
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <Download size={14} />
              Download Template
            </Button>
          </>
        )}
        toolbar={(
          <FilterToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search students by name, ID, or email"
            primaryFilters={(
              <>
                <FilterSelect
                  label="Section"
                  value={activeSection}
                  onChange={updateSectionFilter}
                  options={[
                    { value: "", label: "All sections" },
                    ...sectionOptions.map((section) => ({
                      value: section.id,
                      label: `${section.code} · ${section.academicYear ?? section.ay}`,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "All", label: "All statuses" },
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                    { value: "Restricted", label: "Restricted" },
                    { value: "Disabled", label: "Disabled" },
                    { value: "Archived", label: "Archived" },
                    { value: "Graduated", label: "Graduated" },
                    { value: "Pending Setup", label: "Pending Setup" },
                  ]}
                />
              </>
            )}
            secondaryActions={(
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || actionState.busy}
                  onClick={openImport}
                >
                  <Upload size={14} />
                  Import Students
                </Button>
                <Button
                  type="button"
                  disabled={loading || actionState.busy}
                  onClick={openCreate}
                  className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
                >
                  <Plus size={14} />
                  Add Student
                </Button>
              </>
            )}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />
        )}
        activeFilters={<ActiveFilterChips items={activeFilterItems} onClearAll={resetFilters} />}
        notices={notices}
        bulkActions={(
          <BulkActionBar
            selectedCount={selected.length}
            onClearSelection={() => setSelected([])}
            actions={(
              <Button
                type="button"
                size="sm"
                disabled={actionState.busy || selected.length === 0}
                onClick={handleBulkSetupLinks}
                className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
              >
                <Mail size={14} />
                Send setup links to selected students
              </Button>
            )}
          />
        )}
        drawer={(
          <StudentPreviewDrawer
            open={Boolean(previewStudent)}
            student={previewStudent}
            actionBusy={actionState.busy}
            onClose={() => setPreviewStudentId(null)}
            onView={openStudentPage}
            onSendSetupLink={handleSendSetupLink}
            onDeactivate={(student) => setDeactivateTarget(student)}
          />
        )}
      >
        <StudentsTable
          rows={students}
          loading={loading}
          error={error}
          onRetry={reload}
          selectedRowKeys={selected}
          onToggleRow={toggleOne}
          onToggleAll={toggleAll}
          onPreview={setPreviewStudentId}
          onView={openStudentPage}
          onSendSetupLink={handleSendSetupLink}
          onMove={(student) =>
            navigate(
              `/admin/bulk-move?sourceSectionId=${encodeURIComponent(student.sectionId || "")}`,
            )
          }
          onDeactivate={(student) => setDeactivateTarget(student)}
          actionBusy={actionState.busy}
          sortState={sortState}
          onSortChange={(columnKey) =>
            setSortState((current) => {
              if (!current || current.columnKey !== columnKey) {
                return {
                  columnKey: columnKey as StudentSortKey,
                  direction: "asc",
                };
              }

              return {
                columnKey: current.columnKey,
                direction: current.direction === "asc" ? "desc" : "asc",
              };
            })
          }
        />
      </RoleListShell>

      <AppModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Student"
        description="Create a real student account in pending setup state."
        size="xl"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateStudent}
              disabled={
                createState.saving ||
                !createForm.firstName.trim() ||
                !createForm.lastName.trim() ||
                !createForm.email.trim() ||
                !createForm.studentNumber.trim() ||
                !createForm.section
              }
              className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
            >
              {createState.saving ? "Creating..." : "Create Student"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="First Name"
            value={createForm.firstName}
            onChange={(value) => setCreateForm((current) => ({ ...current, firstName: value }))}
          />
          <Field
            label="M.I."
            value={createForm.middleInitial ?? ""}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, middleInitial: value }))
            }
          />
          <Field
            label="Last Name"
            value={createForm.lastName}
            onChange={(value) => setCreateForm((current) => ({ ...current, lastName: value }))}
          />
          <Field
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
          />
          <Field
            label="Student Number / Student ID"
            value={createForm.studentNumber}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, studentNumber: value }))
            }
          />
          <Field
            label="Course"
            value={createForm.course ?? ""}
            onChange={(value) => setCreateForm((current) => ({ ...current, course: value }))}
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Year Level
            </label>
            <select
              value={createForm.yearLevelId ?? ""}
              onChange={(event) =>
                setCreateForm((current) => {
                  const selectedLevel = (activeAcademicYear?.yearLevels ?? []).find(
                    (level) => level.id === event.target.value,
                  );
                  return {
                    ...current,
                    yearLevelId: event.target.value,
                    yearLevelName: selectedLevel?.name ?? "",
                    yearLevel: selectedLevel?.name ?? "",
                    section: "",
                  };
                })
              }
              className="w-full rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">Select year level</option>
              {yearLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Section
            </label>
            <select
              value={createForm.section}
              onChange={(event) =>
                setCreateForm((current) => {
                  const selectedSection = filteredCreateSectionOptions.find(
                    (section) => section.id === event.target.value,
                  );
                  return {
                    ...current,
                    section: event.target.value,
                    course: selectedSection?.program ?? current.course,
                    yearLevelId: selectedSection?.yearLevelId ?? current.yearLevelId,
                    yearLevelName:
                      selectedSection?.yearLevelName ??
                      selectedSection?.yearLevelLabel ??
                      current.yearLevelName,
                    yearLevel:
                      selectedSection?.yearLevelName ??
                      selectedSection?.yearLevelLabel ??
                      selectedSection?.yearLevel ??
                      current.yearLevel,
                  };
                })
              }
              disabled={sectionSelectionDisabled}
              className="w-full rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">
                {createForm.yearLevelId ? "Select section" : "Select year level first"}
              </option>
              {filteredCreateSectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {describeSectionOption(section)}
                </option>
              ))}
            </select>
            {!createForm.yearLevelId ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Select a year level to enable section choices.
              </p>
            ) : filteredCreateSectionOptions.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                No sections available for this year level.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 md:col-span-2 dark:border-blue-500/30 dark:bg-blue-500/12 dark:text-blue-100">
            Academic Year: <span className="font-semibold">{activeAcademicYearLabel}</span>. New students are added to the current active academic year by default.
          </div>
          {createState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:col-span-2 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {createState.error}
            </div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Students"
        description="Upload an Excel or CSV file. The system validates each row before import."
        size="wide"
        footer={(
          <>
            <p className="mr-auto text-xs text-slate-400 dark:text-slate-500">
              Imported rows will be added with{" "}
              <span className="font-semibold text-slate-500 dark:text-slate-300">
                Pending Setup
              </span>{" "}
              status. No emails are sent automatically after import.
            </p>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={validPreviewRows.length === 0 || importState.processing}
              className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
            >
              {importState.processing ? "Importing..." : "Import Valid Rows"}
            </Button>
          </>
        )}
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/12">
                  <FileSpreadsheet size={18} className="text-blue-700 dark:text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Upload Student Import File
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Supported: .xlsx, .xls, .csv, .tsv · Required: student_id, last_name, first_name, year_level, section, course, academic_year, email
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
                >
                  Choose File
                </Button>
                {importFilename ? (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {importFilename}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {importState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {importState.error}
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: "Rows Detected", value: previewRows.length, tone: "blue" },
                  { label: "Valid Rows", value: validPreviewRows.length, tone: "emerald" },
                  { label: "Invalid Rows", value: invalidPreviewRows.length, tone: "rose" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75"
                  >
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      {item.label}
                    </p>
                    <p
                      className={`mt-1 text-2xl font-bold ${
                        item.tone === "blue"
                          ? "text-blue-800 dark:text-blue-200"
                          : item.tone === "emerald"
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/85">
                      {["Student ID", "Last Name", "First Name", "M.I.", "Year Level", "Section", "Course", "Academic Year", "Email", "Status", "Validation"].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {previewRows.map((row) => (
                      <tr
                        key={`${row.student_id}-${row.email}`}
                        className="bg-white dark:bg-slate-950/35"
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-100">
                          {row.student_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.last_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.first_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.middle_initial || ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.year_level || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.section || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.course || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.academic_year || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                          {row.email || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={row.status} size="xs" />
                        </td>
                        <td className="px-4 py-3">
                          {row.validationErrors.length === 0 ? (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                              Ready to import
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {row.validationErrors.map((issue) => (
                                <span
                                  key={issue}
                                  className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/12 dark:text-rose-200"
                                >
                                  {issue}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate student account?"
        description={
          deactivateTarget
            ? `${deactivateTarget.name} will lose active portal access until the account is re-enabled.`
            : "The selected student will lose active portal access until the account is re-enabled."
        }
        confirmLabel="Deactivate student"
        tone="danger"
        loading={actionState.busy}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
      />
    </div>
  );
}
