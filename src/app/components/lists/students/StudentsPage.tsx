import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Download,
  FileSpreadsheet,
  Mail,
  Plus,
  RefreshCcw,
  Upload,
  Users,
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
import { BootstrapIcon } from "../../ui/bootstrap-icon";
import {
  getCourseOptions,
  getSectionOptions,
  getYearLevelOptions,
} from "../../../lib/academicStructure";
import { assertConfirmedMailJob } from "../../../lib/mailActionSafety";
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
  const [courseFilter, setCourseFilter] = useState("");
  const [yearLevelFilter, setYearLevelFilter] = useState("");
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
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadOption, setDownloadOption] = useState("all");
  const [downloadYear, setDownloadYear] = useState("");
  const [downloadSection, setDownloadSection] = useState("");
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
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

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
  const sectionFilterAcademicYearId =
    activeSectionRecord?.academicYearId || activeAcademicYearId;
  const sectionFilterCourse = courseFilter || activeSectionRecord?.program || "";
  const availableCourseFilters = getCourseOptions(sectionOptions, sectionFilterAcademicYearId);
  const availableYearLevelFilters = getYearLevelOptions(sectionOptions, {
    academicYearId: sectionFilterAcademicYearId,
    course: sectionFilterCourse,
  });
  const selectedYearLevelLabel =
    availableYearLevelFilters.find((option) => option.id === yearLevelFilter)?.label ??
    yearLevelFilter;
  const availableSectionFilters = getSectionOptions(sectionOptions, {
    academicYearId: sectionFilterAcademicYearId,
    course: sectionFilterCourse,
    yearLevelId: yearLevelFilter,
    yearLevelName: selectedYearLevelLabel,
  }) as AdminSectionRecord[];
  const filteredStudents = allStudents.filter((student) => {
    if (activeSection && student.sectionId !== activeSection && student.section !== activeSection) {
      return false;
    }
    if (courseFilter && String(student.course || "").trim().toLowerCase() !== courseFilter.toLowerCase()) {
      return false;
    }
    if (
      yearLevelFilter &&
      String(student.yearLevel || "").trim().toLowerCase() !== selectedYearLevelLabel.toLowerCase()
    ) {
      return false;
    }
    return true;
  });
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
  const pendingActivationCount = students.filter(
    (student) =>
      student.status === "Pending Activation" ||
      student.status === "Pending Setup" ||
      student.status === "Activation Email Sent" ||
      student.status === "Activation Email Failed" ||
      student.status === "Setup Expired",
  ).length;
  const createAcademicYearId = createForm.academicYearId || activeAcademicYearId;
  const createCourseOptions = getCourseOptions(sectionOptions, createAcademicYearId);
  const createYearLevelOptions = getYearLevelOptions(sectionOptions, {
    academicYearId: createAcademicYearId,
    course: createForm.course,
  });
  const createYearLevelLabel =
    createYearLevelOptions.find((option) => option.id === createForm.yearLevelId)?.label ??
    createForm.yearLevelName ??
    String(createForm.yearLevel ?? "");
  const filteredCreateSectionOptions = getSectionOptions(sectionOptions, {
    academicYearId: createAcademicYearId,
    course: createForm.course,
    yearLevelId: createForm.yearLevelId,
    yearLevelName: createYearLevelLabel,
  }) as AdminSectionRecord[];
  const sectionSelectionDisabled =
    !createAcademicYearId ||
    !createForm.course?.trim() ||
    !createForm.yearLevelId ||
    filteredCreateSectionOptions.length === 0;
  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(activeSection) ||
    Boolean(courseFilter) ||
    Boolean(yearLevelFilter) ||
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
  }, [search, statusFilter, activeSection, courseFilter, yearLevelFilter]);

  useEffect(() => {
    if (previewStudentId && !previewStudent) {
      setPreviewStudentId(null);
    }
  }, [previewStudentId, previewStudent]);

  useEffect(() => {
    if (
      createForm.section &&
      !filteredCreateSectionOptions.some((section) => section.id === createForm.section)
    ) {
      setCreateForm((current) => ({ ...current, section: "" }));
    }
  }, [createForm.section, filteredCreateSectionOptions]);

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
        setCatalogError(null);
      })
      .catch((catalogLoadError) => {
        if (!active) return;
        setCatalogError(
          catalogLoadError instanceof Error
            ? catalogLoadError.message
            : "Unable to load sections and academic years for student forms.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      reload();
    }, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, [reload]);

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
    courseFilter
      ? {
          key: "course",
          label: `Course: ${courseFilter}`,
          onRemove: () => {
            setCourseFilter("");
            setYearLevelFilter("");
            updateSectionFilter("");
          },
        }
      : null,
    yearLevelFilter
      ? {
          key: "yearLevel",
          label: `Year Level: ${selectedYearLevelLabel}`,
          onRemove: () => {
            setYearLevelFilter("");
            updateSectionFilter("");
          },
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
    setCourseFilter("");
    setYearLevelFilter("");
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

  function openDownload() {
    setDownloadOpen(true);
    setDownloadOption("all");
    setDownloadYear("");
    setDownloadSection("");
  }

  function openStudentPage(studentId: string) {
    navigate(`/admin/students/${studentId}`);
  }

  async function sendSetupLink(student: AdminStudentRecord) {
    const needsActivationEmail =
      student.status === "Pending Setup" ||
      student.status === "Pending Activation" ||
      student.status === "Activation Email Failed" ||
      student.status === "Setup Expired" ||
      student.status === "Needs Resend";
    const response =
      needsActivationEmail
        ? await adminService.sendStudentSetupInvite(student.id)
        : await adminService.sendStudentResetLink(student.id);
    const mailJobId = assertConfirmedMailJob(
      response,
      needsActivationEmail ? "student activation email" : "student password reset email",
    );
    updateStudentPatch(student.id, {
      status: needsActivationEmail ? "Activation Email Sent" : student.status,
      activationEmailStatus: needsActivationEmail ? "Sent" : student.activationEmailStatus,
      activationEmailFailureReason: needsActivationEmail ? "" : student.activationEmailFailureReason,
    });
    return { mailJobId, needsActivationEmail };
  }

  async function handleSendSetupLink(studentId: string) {
    if (actionState.busy) return;
    setActionState({ busy: true, error: null });
    setBusyStudentId(studentId);
    try {
      const student = allStudents.find((item) => item.id === studentId);
      if (!student) {
        throw new Error("Unable to find the selected student.");
      }
      const { mailJobId, needsActivationEmail } = await sendSetupLink(student);
      await reload();
      setActionState({ busy: false, error: null });
      setBusyStudentId(null);
      showFeedback(
        "success",
        needsActivationEmail
          ? `Activation email queued. MailJob ${mailJobId} is ready for delivery.`
          : `Password reset email queued. MailJob ${mailJobId} is ready for delivery.`,
      );
    } catch (setupError) {
      const message =
        setupError instanceof Error
          ? setupError.message
          : "Unable to send the setup link.";
      setActionState({ busy: false, error: message });
      setBusyStudentId(null);
      showFeedback("error", message);
    }
  }

  async function handleBulkSetupLinks() {
    if (actionState.busy || selectedStudents.length === 0) return;
    setActionState({ busy: true, error: null });
    try {
      let processed = 0;
      let skipped = 0;
      for (const student of selectedStudents) {
        if (
          student.status === "Inactive" ||
          student.status === "Restricted" ||
          student.status === "Disabled" ||
          student.status === "Archived" ||
          student.status === "Graduated"
        ) {
          skipped += 1;
          continue;
        }
        await sendSetupLink(student);
        processed += 1;
      }
      await reload();
      setSelected([]);
      setActionState({ busy: false, error: null });
      const skippedMessage = skipped ? ` Skipped ${skipped} inactive/restricted account${skipped > 1 ? "s" : ""}.` : "";
      showFeedback(
        processed > 0 ? "success" : "warning",
        processed > 0
          ? `${processed} student setup/reset MailJob${processed > 1 ? "s" : ""} queued.${skippedMessage} Open Mail Jobs to watch delivery.`
          : `No student setup/reset emails were queued.${skippedMessage}`,
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
        `Import complete: ${result.summary.created} created, ${result.summary.updatedOrSkipped} updated/skipped, ${result.summary.invalidRows} invalid row${result.summary.invalidRows === 1 ? "" : "s"}, ${result.summary.pendingActivation} pending activation.`,
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
        "Student created. They remain Pending Activation until you send an activation email or they complete account setup.",
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

  async function handleDownload() {
    let studentsToDownload: AdminStudentRecord[] = [];
    if (downloadOption === "all") {
      studentsToDownload = allStudents;
    } else if (downloadOption === "filtered") {
      studentsToDownload = students;
    } else if (downloadOption === "year") {
      studentsToDownload = allStudents.filter((s) => s.yearLevel === downloadYear);
    } else if (downloadOption === "section") {
      studentsToDownload = allStudents.filter((s) => s.section === downloadSection);
    } else if (downloadOption === "yearSection") {
      studentsToDownload = allStudents.filter(
        (s) => s.yearLevel === downloadYear && s.section === downloadSection,
      );
    }

    studentsToDownload.sort((a, b) => {
      if (a.yearLevel !== b.yearLevel) return String(a.yearLevel || "").localeCompare(String(b.yearLevel || ""));
      if (a.section !== b.section) return String(a.section || "").localeCompare(String(b.section || ""));
      if (a.lastName !== b.lastName) return String(a.lastName || "").localeCompare(String(b.lastName || ""));
      if (a.firstName !== b.firstName) return String(a.firstName || "").localeCompare(String(b.firstName || ""));
      return (a.middleInitial || "").localeCompare(b.middleInitial || "");
    });

    const csvHeaders = ["Student ID", "Last Name", "First Name", "Middle Name", "Year Level", "Section", "Course", "Academic Year", "Email", "Status", "Activation Status", "Activation Email Status", "Activation Email Last Sent", "Activation Email Failure Reason", "Setup Token Expires At", "Last Login", "Created Date"];
    const csvRows = [csvHeaders];
    studentsToDownload.forEach(student => {
      csvRows.push([
        student.studentId || student.id,
        student.lastName,
        student.firstName,
        student.middleInitial || "",
        student.yearLevel || "",
        student.section || "",
        student.course || "",
        student.academicYear || "",
        student.email,
        student.status,
        student.activationStatus || student.status,
        student.activationEmailStatus || "Not Sent",
        student.activationEmailLastSentAt || "",
        student.activationEmailFailureReason || "",
        student.setupTokenExpiresAt || "",
        student.lastLoginAt || "",
        student.createdAt || ""
      ].map(field => `"${field.replace(/"/g, '""')}"`));
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    let filename = `projtrack-students-all-${timestamp}.csv`;
    if (downloadOption === "filtered") filename = `projtrack-students-filtered-${timestamp}.csv`;
    else if (downloadOption === "year") filename = `projtrack-students-year-${downloadYear.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.csv`;
    else if (downloadOption === "section") filename = `projtrack-students-section-${downloadSection.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.csv`;
    else if (downloadOption === "yearSection") filename = `projtrack-students-year-${downloadYear.replace(/\s+/g, "-").toLowerCase()}-section-${downloadSection.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.csv`;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
    showFeedback("success", `Downloaded ${studentsToDownload.length} student records as ${filename}.`);
  }

  const notices = (
    <div className="space-y-3">
      {error ? (
        <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
          {error}
        </PortalNotice>
      ) : null}
      {actionState.error ? (
        <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
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
              <BootstrapIcon name="check-circle-fill" tone="success" />
            ) : feedback.tone === "warning" ? (
              <BootstrapIcon name="exclamation-triangle-fill" tone="warning" />
            ) : (
              <BootstrapIcon name="x-circle-fill" tone="danger" />
            )
          }
        >
          {feedback.message}
        </PortalNotice>
      ) : null}
      {catalogError ? (
        <PortalNotice tone="danger" icon={<BootstrapIcon name="x-circle-fill" tone="danger" />}>
          {catalogError}
        </PortalNotice>
      ) : null}
      {activeSection ? (
        <PortalNotice tone="info">
          Showing students filtered by section:{" "}
          <span className="font-semibold">{activeSectionRecord?.code ?? activeSection}</span>.
        </PortalNotice>
      ) : null}
      {statusFilter === "Pending Activation" || statusFilter === "Pending Setup" ? (
        <PortalNotice tone="warning">
          Showing students who still need an activation email or first-time setup.
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
            label: "Pending Activation",
            value: loading ? "..." : String(pendingActivationCount),
            hint: "Accounts waiting for activation before first-time setup begins.",
          },
          {
            label: "Selected",
            value: String(selected.length),
            hint: "Rows ready for shared bulk actions.",
          },
        ]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || actionState.busy}
              onClick={() => {
                setSelected([]);
                reload();
              }}
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCcw size={14} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || actionState.busy}
              onClick={() => adminService.downloadStudentTemplate()}
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <Download size={14} />
              Download Template
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || actionState.busy || allStudents.length === 0}
              onClick={openDownload}
              className="border-white/18 bg-white/8 text-white hover:bg-white/15 hover:text-white"
            >
              <Download size={14} />
              Download Records
            </Button>
          </div>
        )}
        toolbar={(
          <FilterToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search students by name, ID, or email"
            primaryFilters={(
              <>
                <FilterSelect
                  label="Course"
                  value={courseFilter}
                  onChange={(value) => {
                    setCourseFilter(value);
                    setYearLevelFilter("");
                    updateSectionFilter("");
                  }}
                  options={[
                    { value: "", label: "All courses" },
                    ...availableCourseFilters.map((course) => ({
                      value: course,
                      label: course,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Year Level"
                  value={yearLevelFilter}
                  onChange={(value) => {
                    setYearLevelFilter(value);
                    updateSectionFilter("");
                  }}
                  options={[
                    { value: "", label: "All year levels" },
                    ...availableYearLevelFilters.map((option) => ({
                      value: option.id,
                      label: option.label,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Section"
                  value={activeSection}
                  onChange={updateSectionFilter}
                  options={[
                    { value: "", label: "All sections" },
                    ...availableSectionFilters.map((section) => ({
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
                    { value: "Pending Activation", label: "Pending Activation" },
                    { value: "Activation Email Sent", label: "Activation Email Sent" },
                    { value: "Setup Expired", label: "Setup Expired" },
                    { value: "Activation Email Failed", label: "Activation Email Failed" },
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
                Send activation/setup links to selected students
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
          busyStudentId={busyStudentId}
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
        description="Create a student inside the academic hierarchy. New records start as pending activation."
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
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Academic Year
            </label>
            <select
              value={createAcademicYearId}
              onChange={(event) =>
                setCreateForm((current) => {
                  return {
                    ...current,
                    academicYearId: event.target.value,
                    academicYear:
                      academicYears.find((year) => year.id === event.target.value)?.name ?? "",
                    course: "",
                    yearLevelId: "",
                    yearLevelName: "",
                    yearLevel: "",
                    section: "",
                  };
                })
              }
              className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">Select academic year</option>
              {academicYears.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Course / Program
            </label>
            <select
              value={createForm.course ?? ""}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  course: event.target.value,
                  yearLevelId: "",
                  yearLevelName: "",
                  yearLevel: "",
                  section: "",
                }))
              }
              disabled={!createAcademicYearId}
              className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">{createAcademicYearId ? "Select course" : "Select academic year first"}</option>
              {createCourseOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Year Level
            </label>
            <select
              value={createForm.yearLevelId ?? ""}
              onChange={(event) =>
                setCreateForm((current) => {
                  const selectedLevel = createYearLevelOptions.find(
                    (level) => level.id === event.target.value,
                  );
                  return {
                    ...current,
                    yearLevelId: event.target.value,
                    yearLevelName: selectedLevel?.label ?? "",
                    yearLevel: selectedLevel?.label ?? "",
                    section: "",
                  };
                })
              }
              disabled={!createAcademicYearId || !createForm.course?.trim()}
              className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">
                {createForm.course?.trim() ? "Select year level" : "Select course first"}
              </option>
              {createYearLevelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
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
              className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
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
            {!createForm.course?.trim() ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Select a course to load its year levels.
              </p>
            ) : !createForm.yearLevelId ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Select a year level to enable section choices.
              </p>
            ) : filteredCreateSectionOptions.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                No sections available for this year level.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/15 px-4 py-3 text-sm text-blue-800 md:col-span-2 dark:border-blue-500/30 dark:bg-blue-500/12 dark:text-blue-100">
            New students stay visible in rosters as <span className="font-semibold">Pending Activation</span> until they receive and complete account setup.
          </div>
          {createState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
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
            <p className="mr-auto text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">
              Imported rows will be added with{" "}
              <span className="font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-300">
                Pending Activation
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
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/15 dark:bg-blue-500/12">
                  <FileSpreadsheet size={18} className="text-blue-700 dark:text-blue-300 dark:text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Upload Student Import File
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">
                    Supported: .xlsx, .xls, .csv, .tsv · Required: student_id, first_name, last_name, email, course_code, year_level, section
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
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {importState.error}
            </div>
          ) : null}

          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/15 px-4 py-3 text-xs text-blue-900 dark:text-blue-100 dark:border-blue-500/35 dark:bg-blue-500/12">
            Course Code must match an existing Course / Program. Year Level must already exist under that Course / Program. Section must already exist under the selected Academic Year, Course / Program, and Year Level. If Academic Year is blank, the active academic year is used only when that match is safe.
          </div>

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
                    className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-900/85 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75"
                  >
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-300 dark:text-slate-500">
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
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700/70 dark:border-slate-700/60">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 dark:border-slate-700/60 dark:bg-slate-900/85">
                      {["Student ID", "Last Name", "First Name", "M.I.", "Year Level", "Section", "Course", "Academic Year", "Email", "Status", "Validation"].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 dark:text-slate-500"
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60 dark:divide-slate-800">
                    {previewRows.map((row) => (
                      <tr
                        key={`${row.student_id}-${row.email}`}
                        className="bg-white dark:bg-slate-900/85 dark:bg-slate-950/35"
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">
                          {row.student_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.last_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.first_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.middle_initial || ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.year_level || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.section || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.course || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
                          {row.academic_year || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-300">
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
                                  className="rounded-full bg-rose-50 dark:bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/12 dark:text-rose-200"
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

      <AppModal
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        title="Download Student Records"
        description="Select the scope of student records to export as CSV."
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDownloadOpen(false)} disabled={actionState.busy}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={actionState.busy || (downloadOption === "year" && !downloadYear) || (downloadOption === "section" && !downloadSection) || (downloadOption === "yearSection" && (!downloadYear || !downloadSection))}>
              Download
            </Button>
          </div>
        )}
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Download Scope</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              value={downloadOption}
              onChange={(e) => setDownloadOption(e.target.value)}
            >
              <option value="all">All Students ({allStudents.length})</option>
              <option value="filtered">Current Filtered Results ({students.length})</option>
              <option value="year">Students by Year</option>
              <option value="section">Students by Section</option>
              <option value="yearSection">Students by Year and Section</option>
            </select>
          </div>
          {downloadOption === "year" || downloadOption === "yearSection" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Year Level</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                value={downloadYear}
                onChange={(e) => setDownloadYear(e.target.value)}
              >
                <option value="">Select Year Level</option>
                {Array.from(
                  new Set(
                    allStudents
                      .map((student) => String(student.yearLevel || "").trim())
                      .filter(Boolean),
                  ),
                ).map((yearLevel) => (
                  <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
                ))}
              </select>
            </div>
          ) : null}
          {downloadOption === "section" || downloadOption === "yearSection" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Section</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                value={downloadSection}
                onChange={(e) => setDownloadSection(e.target.value)}
              >
                <option value="">Select Section</option>
                {availableSectionFilters.map(section => (
                  <option key={section.id} value={section.code}>{describeSectionOption(section)}</option>
                ))}
              </select>
            </div>
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
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
        {label}
      </label>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
      />
    </div>
  );
}
