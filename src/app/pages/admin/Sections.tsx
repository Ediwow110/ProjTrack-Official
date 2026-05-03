import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  Trash2,
  CalendarRange,
  ChevronRight,
  Download,
  FolderTree,
  Plus,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";

import { StatusChip } from "../../components/ui/StatusChip";
import { AppModal } from "../../components/ui/app-modal";
import { adminCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type {
  AdminAcademicYearLevelRecord,
  AdminAcademicYearRecord,
  AdminCourseRecord,
  AdminSectionCreateInput,
  AdminSectionRecord,
  SectionMasterListResponse,
} from "../../lib/api/contracts";

type StructureView = {
  academicYearId: string;
  courseId: string;
  yearLevelId: string;
  sectionId: string;
};

const emptyView: StructureView = {
  academicYearId: "",
  courseId: "",
  yearLevelId: "",
  sectionId: "",
};

const initialAcademicYearForm = {
  name: "",
  status: "Upcoming",
};

const initialCourseForm = {
  name: "",
  code: "",
  description: "",
};

const initialYearLevelForm = {
  name: "",
  sortOrder: "",
};

const initialSectionForm: AdminSectionCreateInput = {
  code: "",
  program: "",
  yearLevel: "",
  yearLevelId: "",
  yearLevelName: "",
  academicYearId: "",
  academicYear: "",
  adviserName: "",
  description: "",
};

function normalizeLabel(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getSectionYearLevelName(section: AdminSectionRecord) {
  return (
    String(section.yearLevelName || "").trim() ||
    String(section.yearLevelLabel || "").trim() ||
    String(section.yearLevel || "").trim()
  );
}

export default function AdminSections() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<StructureView>(emptyView);

  const [createYearOpen, setCreateYearOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [createLevelOpen, setCreateLevelOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);

  const [academicYearForm, setAcademicYearForm] = useState(initialAcademicYearForm);
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [yearLevelForm, setYearLevelForm] = useState(initialYearLevelForm);
  const [sectionForm, setSectionForm] = useState<AdminSectionCreateInput>(initialSectionForm);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'year' | 'course' | 'yearLevel' | 'section';
    id: string;
    yearId?: string;
    courseId?: string;
    name: string;
  } | null>(null);
  const [deleteState, setDeleteState] = useState<{ deleting: boolean; error: string | null }>({
    deleting: false,
    error: null,
  });
  const [submitState, setSubmitState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [academicYears, sections] = await Promise.all([
        adminCatalogService.getAcademicYears({ search }),
        adminCatalogService.getSections(),
      ]);
      return { academicYears, sections };
    },
    [search],
  );

  const academicYears = data?.academicYears ?? [];
  const sections = data?.sections ?? [];

  const selectedYear =
    academicYears.find((year) => year.id === view.academicYearId) ?? null;

  const selectedCourse: AdminCourseRecord | null = useMemo(() => {
    if (!selectedYear || !view.courseId) return null;
    return (selectedYear.courses ?? []).find((c) => c.id === view.courseId) ?? null;
  }, [selectedYear, view.courseId]);

  const yearLevelsForCourse: AdminAcademicYearLevelRecord[] = useMemo(() => {
    if (!selectedYear) return [];
    const all = selectedYear.yearLevels ?? [];
    if (!view.courseId) return all;
    return all.filter((l) => l.courseId === view.courseId);
  }, [selectedYear, view.courseId]);

  const selectedYearLevel =
    yearLevelsForCourse.find((level) => level.id === view.yearLevelId) ?? null;

  const sectionsForSelectedLevel = useMemo(() => {
    if (!selectedYear || !selectedYearLevel) return [];
    return sections
      .filter((section) => {
        if (section.academicYearId !== selectedYear.id) return false;
        if (section.yearLevelId && section.yearLevelId === selectedYearLevel.id) return true;
        return normalizeLabel(getSectionYearLevelName(section)) === normalizeLabel(selectedYearLevel.name);
      })
      .sort((left, right) => left.code.localeCompare(right.code));
  }, [sections, selectedYear, selectedYearLevel]);

  const selectedSection =
    sectionsForSelectedLevel.find((section) => section.id === view.sectionId) ?? null;

  const { data: masterList, loading: masterListLoading, error: masterListError } = useAsyncData(
    () =>
      view.sectionId
        ? adminCatalogService.getSectionMasterList(view.sectionId)
        : Promise.resolve(null as SectionMasterListResponse | null),
    [view.sectionId],
  );

  // ---- Navigation helpers ----
  function openAcademicYear(year: AdminAcademicYearRecord) {
    setView({ academicYearId: year.id, courseId: "", yearLevelId: "", sectionId: "" });
  }
  function openCourse(course: AdminCourseRecord) {
    setView((c) => ({ ...c, courseId: course.id, yearLevelId: "", sectionId: "" }));
  }
  function openYearLevel(level: AdminAcademicYearLevelRecord) {
    setView((c) => ({ ...c, yearLevelId: level.id, sectionId: "" }));
  }
  function openSection(section: AdminSectionRecord) {
    setView((c) => ({ ...c, sectionId: section.id }));
  }

  // ---- Create openers ----
  function openCreateAcademicYear() {
    setAcademicYearForm(initialAcademicYearForm);
    setSubmitState({ saving: false, error: null });
    setCreateYearOpen(true);
  }
  function openCreateCourse() {
    if (!selectedYear) return;
    setCourseForm(initialCourseForm);
    setSubmitState({ saving: false, error: null });
    setCreateCourseOpen(true);
  }
  function openCreateYearLevel() {
    if (!selectedYear) return;
    setYearLevelForm(initialYearLevelForm);
    setSubmitState({ saving: false, error: null });
    setCreateLevelOpen(true);
  }
  function openCreateSection() {
    if (!selectedYear || !selectedYearLevel) return;
    setSectionForm({
      ...initialSectionForm,
      academicYearId: selectedYear.id,
      academicYear: selectedYear.name,
      yearLevelId: selectedYearLevel.id,
      yearLevelName: selectedYearLevel.name,
      yearLevel: selectedYearLevel.name,
      program: selectedCourse?.name ?? "",
    });
    setSubmitState({ saving: false, error: null });
    setCreateSectionOpen(true);
  }

  // ---- Submit handlers ----
  async function handleCreateAcademicYear() {
    setSubmitState({ saving: true, error: null });
    try {
      const created = await adminCatalogService.createAcademicYear(academicYearForm);
      await reload();
      setView({ academicYearId: created.id, courseId: "", yearLevelId: "", sectionId: "" });
      setCreateYearOpen(false);
      setAcademicYearForm(initialAcademicYearForm);
      setSubmitState({ saving: false, error: null });
    } catch (err) {
      setSubmitState({ saving: false, error: err instanceof Error ? err.message : "Unable to create the academic year." });
    }
  }

  async function handleCreateCourse() {
    if (!selectedYear) return;
    setSubmitState({ saving: true, error: null });
    try {
      const created = await adminCatalogService.createCourse(selectedYear.id, {
        name: courseForm.name,
        code: courseForm.code || undefined,
        description: courseForm.description || undefined,
      });
      await reload();
      setView((c) => ({ ...c, courseId: created.id, yearLevelId: "", sectionId: "" }));
      setCreateCourseOpen(false);
      setCourseForm(initialCourseForm);
      setSubmitState({ saving: false, error: null });
    } catch (err) {
      setSubmitState({ saving: false, error: err instanceof Error ? err.message : "Unable to create the course." });
    }
  }

  async function handleCreateYearLevel() {
    if (!selectedYear) return;
    setSubmitState({ saving: true, error: null });
    try {
      const created = await adminCatalogService.createAcademicYearLevel({
        academicYearId: selectedYear.id,
        courseId: view.courseId || undefined,
        name: yearLevelForm.name,
        sortOrder: yearLevelForm.sortOrder ? Number(yearLevelForm.sortOrder) : undefined,
      });
      await reload();
      setView((c) => ({ ...c, yearLevelId: created.id, sectionId: "" }));
      setCreateLevelOpen(false);
      setYearLevelForm(initialYearLevelForm);
      setSubmitState({ saving: false, error: null });
    } catch (err) {
      setSubmitState({ saving: false, error: err instanceof Error ? err.message : "Unable to create the year level." });
    }
  }

  async function handleCreateSection() {
    setSubmitState({ saving: true, error: null });
    try {
      await adminCatalogService.createSection(sectionForm);
      await reload();
      setCreateSectionOpen(false);
      setSectionForm(initialSectionForm);
      setSubmitState({ saving: false, error: null });
    } catch (err) {
      setSubmitState({ saving: false, error: err instanceof Error ? err.message : "Unable to create the section." });
    }
  }

  // ---- Delete handlers ----
  function openDeleteYear(year: AdminAcademicYearRecord, event: React.MouseEvent) {
    event.stopPropagation();
    setDeleteTarget({ type: 'year', id: year.id, name: year.name });
    setDeleteState({ deleting: false, error: null });
  }
  function openDeleteCourse(course: AdminCourseRecord, event: React.MouseEvent) {
    event.stopPropagation();
    if (!selectedYear) return;
    setDeleteTarget({ type: 'course', id: course.id, yearId: selectedYear.id, name: course.name });
    setDeleteState({ deleting: false, error: null });
  }
  function openDeleteYearLevel(level: AdminAcademicYearLevelRecord, event: React.MouseEvent) {
    event.stopPropagation();
    if (!selectedYear) return;
    setDeleteTarget({ type: 'yearLevel', id: level.id, yearId: selectedYear.id, name: level.name });
    setDeleteState({ deleting: false, error: null });
  }
  function openDeleteSection(section: AdminSectionRecord, event: React.MouseEvent) {
    event.stopPropagation();
    setDeleteTarget({ type: 'section', id: section.id, name: section.code });
    setDeleteState({ deleting: false, error: null });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteState({ deleting: true, error: null });
    try {
      if (deleteTarget.type === 'year') {
        await adminCatalogService.deleteAcademicYear(deleteTarget.id);
        setView(emptyView);
      } else if (deleteTarget.type === 'course') {
        await adminCatalogService.deleteCourse(deleteTarget.yearId!, deleteTarget.id);
        setView((c) => ({ ...c, courseId: '', yearLevelId: '', sectionId: '' }));
      } else if (deleteTarget.type === 'yearLevel') {
        await adminCatalogService.deleteAcademicYearLevel(deleteTarget.yearId!, deleteTarget.id);
        setView((c) => ({ ...c, yearLevelId: '', sectionId: '' }));
      } else {
        await adminCatalogService.deleteSection(deleteTarget.id);
        setView((c) => ({ ...c, sectionId: '' }));
      }
      await reload();
      setDeleteTarget(null);
      setDeleteState({ deleting: false, error: null });
    } catch (err) {
      setDeleteState({ deleting: false, error: err instanceof Error ? err.message : 'Delete failed.' });
    }
  }

  // ---- View states ----
  const showAcademicYears = !view.academicYearId;
  const showCourses = Boolean(view.academicYearId) && !view.courseId && !view.yearLevelId && !view.sectionId;
  const showYearLevels = Boolean(view.academicYearId && view.courseId) && !view.yearLevelId && !view.sectionId;
  const showSections = Boolean(view.academicYearId && view.courseId && view.yearLevelId) && !view.sectionId;

  return (
    <>
      <div className="mx-auto max-w-[var(--content-width-wide)] space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1
              className="font-bold text-slate-900 dark:text-slate-100"
              style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}
            >
              Academic Years
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-300">
              Organize the school structure: academic years → courses → year levels → sections.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={loading}
              onClick={reload}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/bulk-move")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              Move Students
            </button>
            {showAcademicYears ? (
              <button
                disabled={submitState.saving}
                onClick={openCreateAcademicYear}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <CalendarRange size={14} />
                Add Academic Year
              </button>
            ) : null}
            {showCourses ? (
              <button
                disabled={submitState.saving || !selectedYear}
                onClick={openCreateCourse}
                className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
              >
                <Plus size={14} />
                Add Course
              </button>
            ) : null}
            {showYearLevels ? (
              <button
                disabled={submitState.saving || !selectedYear}
                onClick={openCreateYearLevel}
                className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Plus size={14} />
                Add Year Level
              </button>
            ) : null}
            {showSections ? (
              <button
                disabled={submitState.saving || !selectedYearLevel}
                onClick={openCreateSection}
                className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Plus size={14} />
                Add Section
              </button>
            ) : null}
            {view.sectionId ? (
              <button
                type="button"
                onClick={() => view.sectionId && adminCatalogService.downloadSectionMasterList(view.sectionId)}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <Download size={14} />
                Download Master&apos;s List
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* ── STEP 1: Academic Years ── */}
        {showAcademicYears ? (
          <div className="flex max-w-sm items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/88 px-3 py-2 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/45">
            <Search size={14} className="shrink-0 text-slate-400 dark:text-slate-300" />
            <input
              disabled={loading}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search academic years..."
              aria-label="Search academic years"
              className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        ) : null}

        {showAcademicYears ? (
          academicYears.length === 0 ? (
            <EmptyState
              title="No academic years yet"
              message="Create your first academic year to start building courses, year levels, sections, and section rosters."
              actionLabel="Add Academic Year"
              onAction={openCreateAcademicYear}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {academicYears.map((year) => (
                <button
                  key={year.id}
                  type="button"
                  onClick={() => openAcademicYear(year)}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{year.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {(year.courses ?? []).length} course{(year.courses ?? []).length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={year.status} size="xs" />
                      <button
                        type="button"
                        onClick={(e) => openDeleteYear(year, e)}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        title="Delete academic year"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="Courses" value={(year.courses ?? []).length} />
                    <Metric label="Sections" value={year.sectionCount} />
                    <Metric label="Students" value={year.studentCount} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-300">
                    <span>Open academic year</span>
                    <ChevronRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {/* ── STEP 2: Courses ── */}
        {showCourses && selectedYear ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView(emptyView)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to Academic Years
            </button>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedYear.name}</h2>
                <StatusChip status={selectedYear.status} size="xs" />
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-300">
                Select a course to manage its year levels and sections.
              </p>
            </div>

            {(selectedYear.courses ?? []).length === 0 ? (
              <EmptyState
                title="No courses yet"
                message="Add courses (e.g. BSIT, BSCS, BSN) to this academic year before creating year levels and sections."
                actionLabel="Add Course"
                onAction={openCreateCourse}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(selectedYear.courses ?? []).map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => openCourse(course)}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{course.name}</p>
                        {course.code ? (
                          <p className="mt-0.5 text-xs font-mono text-violet-600 dark:text-violet-400">{course.code}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {course.yearLevelCount} year level{course.yearLevelCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-violet-600 dark:text-violet-300" />
                        <button
                          type="button"
                          onClick={(e) => openDeleteCourse(course, e)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title="Delete course"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {course.description ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{course.description}</p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Year Levels" value={course.yearLevelCount} />
                      <Metric label="Sections" value={course.sectionCount ?? 0} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <span>Open course</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* ── STEP 3: Year Levels ── */}
        {showYearLevels && selectedYear && selectedCourse ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView((c) => ({ ...c, courseId: "", yearLevelId: "", sectionId: "" }))}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to {selectedYear.name}
            </button>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Course
              </p>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedCourse.name}</h2>
                {selectedCourse.code ? (
                  <span className="rounded-lg bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 text-xs font-mono font-semibold text-violet-700 dark:text-violet-300">
                    {selectedCourse.code}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-300">
                {selectedYear.name} / {selectedCourse.name} — Open a year level to manage sections.
              </p>
            </div>

            {yearLevelsForCourse.length === 0 ? (
              <EmptyState
                title="No year levels yet"
                message="Add year levels inside this course before creating sections."
                actionLabel="Add Year Level"
                onAction={openCreateYearLevel}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {yearLevelsForCourse.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => openYearLevel(level)}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{level.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {level.sectionCount} section{level.sectionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <FolderTree size={16} className="text-blue-600 dark:text-blue-300" />
                        <button
                          type="button"
                          onClick={(e) => openDeleteYearLevel(level, e)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title="Delete year level"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Sections" value={level.sectionCount} />
                      <Metric label="Students" value={level.studentCount} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <span>Open year level</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* ── STEP 4: Sections ── */}
        {showSections && selectedYear && selectedCourse && selectedYearLevel ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView((c) => ({ ...c, yearLevelId: "", sectionId: "" }))}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to {selectedCourse.name}
            </button>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Year Level
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{selectedYearLevel.name}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-300">
                {selectedYear.name} / {selectedCourse.name} / {selectedYearLevel.name}
              </p>
            </div>

            {sectionsForSelectedLevel.length === 0 ? (
              <EmptyState
                title="No sections for this year level"
                message="Create a section inside this year level to start assigning students and exporting a master list."
                actionLabel="Add Section"
                onAction={openCreateSection}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sectionsForSelectedLevel.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => openSection(section)}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{section.code}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {section.program || "Course not set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-emerald-600 dark:text-emerald-300" />
                        <button
                          type="button"
                          onClick={(e) => openDeleteSection(section, e)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title="Delete section"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>Adviser: {section.adviser || "Unassigned"}</p>
                      {section.description ? <p>{section.description}</p> : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Students" value={section.students} />
                      <Metric label="Subjects" value={section.subjects} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-300">
                      <span>Open master list</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* ── STEP 5: Master List ── */}
        {view.sectionId && selectedYear && selectedCourse && selectedYearLevel && selectedSection ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView((c) => ({ ...c, sectionId: "" }))}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to {selectedYearLevel.name}
            </button>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Section Master&apos;s List
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{selectedSection.code}</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-300">
                    {selectedYear.name} / {selectedCourse.name} / {selectedYearLevel.name} / {selectedSection.program || "Course not set"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/students?sectionId=${encodeURIComponent(selectedSection.id)}`)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <Users size={14} />
                    View Students
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/bulk-move?sourceSectionId=${encodeURIComponent(selectedSection.id)}`)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <FolderTree size={14} />
                    Manage Moves
                  </button>
                </div>
              </div>
            </div>

            {masterListError ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
                {masterListError}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/86 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="border-b border-slate-200/70 px-6 py-4 dark:border-slate-700/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Master&apos;s List</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Student ID, last name, first name, M.I., and account status.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Adviser:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {masterList?.section.adviser || selectedSection.adviser || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>

              {masterListLoading ? (
                <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">Loading master list...</div>
              ) : !masterList || masterList.rows.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No students in this section.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/70 bg-slate-50/85 dark:border-slate-700/70 dark:bg-slate-900/70">
                        {["Student ID", "Last Name", "First Name", "M.I.", "Account Status"].map((header) => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 dark:divide-slate-800">
                      {masterList.rows.map((student) => (
                        <tr key={`${student.id}-${student.studentId}`} className="bg-white/70 dark:bg-slate-950/20">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{student.studentId}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{student.lastName}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.firstName}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.middleInitial || ""}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.accountStatus || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>

      {/* ── Modals ── */}

      <AppModal
        open={createYearOpen}
        onOpenChange={(next) => { if (!submitState.saving) setCreateYearOpen(next); }}
        title="Add Academic Year"
        description="Create the academic year card first, then add courses, year levels and sections under it."
        footer={(
          <>
            <button type="button" disabled={submitState.saving} onClick={() => setCreateYearOpen(false)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={!academicYearForm.name.trim() || submitState.saving} onClick={handleCreateAcademicYear}
              className="rounded-[20px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {submitState.saving ? "Creating..." : "Create Academic Year"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Academic Year" value={academicYearForm.name} onChange={(v) => setAcademicYearForm((c) => ({ ...c, name: v }))} placeholder="2025-2026" />
          <SelectField label="Status" value={academicYearForm.status} onChange={(v) => setAcademicYearForm((c) => ({ ...c, status: v }))}
            options={[{ value: "Upcoming", label: "Upcoming" }, { value: "Active", label: "Active" }, { value: "Archived", label: "Archived" }]}
            placeholder="Select status" />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2">{submitState.error}</div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={createCourseOpen}
        onOpenChange={(next) => { if (!submitState.saving) setCreateCourseOpen(next); }}
        title="Add Course"
        description="Add a course program (e.g. BSIT, BSCS, BSN) to this academic year."
        footer={(
          <>
            <button type="button" disabled={submitState.saving} onClick={() => setCreateCourseOpen(false)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={!courseForm.name.trim() || submitState.saving} onClick={handleCreateCourse}
              className="rounded-[20px] bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50">
              {submitState.saving ? "Creating..." : "Create Course"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Academic Year" value={selectedYear?.name ?? ""} onChange={() => undefined} placeholder="" disabled />
          <Field label="Course Name" value={courseForm.name} onChange={(v) => setCourseForm((c) => ({ ...c, name: v }))} placeholder="Bachelor of Science in Information Technology" />
          <Field label="Code / Abbreviation" value={courseForm.code} onChange={(v) => setCourseForm((c) => ({ ...c, code: v }))} placeholder="BSIT (optional)" />
          <Field label="Description" value={courseForm.description} onChange={(v) => setCourseForm((c) => ({ ...c, description: v }))} placeholder="Optional" />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2">{submitState.error}</div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={createLevelOpen}
        onOpenChange={(next) => { if (!submitState.saving) setCreateLevelOpen(next); }}
        title="Add Year Level"
        description="Add a year level inside the selected course."
        footer={(
          <>
            <button type="button" disabled={submitState.saving} onClick={() => setCreateLevelOpen(false)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={!yearLevelForm.name.trim() || submitState.saving} onClick={handleCreateYearLevel}
              className="rounded-[20px] bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
              {submitState.saving ? "Creating..." : "Create Year Level"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Academic Year" value={selectedYear?.name ?? ""} onChange={() => undefined} placeholder="" disabled />
          <Field label="Course" value={selectedCourse?.name ?? ""} onChange={() => undefined} placeholder="" disabled />
          <Field label="Year Level" value={yearLevelForm.name} onChange={(v) => setYearLevelForm((c) => ({ ...c, name: v }))} placeholder="1st Year, Grade 11, Bridge Program" />
          <Field label="Sort Order" value={yearLevelForm.sortOrder} onChange={(v) => setYearLevelForm((c) => ({ ...c, sortOrder: v }))} placeholder="Optional" />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2">{submitState.error}</div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={createSectionOpen}
        onOpenChange={(next) => { if (!submitState.saving) setCreateSectionOpen(next); }}
        title="Add Section"
        description="Sections are created inside the selected academic year, course and year level."
        size="xl"
        footer={(
          <>
            <button type="button" disabled={submitState.saving} onClick={() => setCreateSectionOpen(false)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
              Cancel
            </button>
            <button type="button"
              disabled={submitState.saving || !sectionForm.code.trim() || !sectionForm.program.trim() || !sectionForm.yearLevelId}
              onClick={handleCreateSection}
              className="rounded-[20px] bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
              {submitState.saving ? "Creating..." : "Create Section"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Academic Year" value={sectionForm.academicYear ?? ""} onChange={() => undefined} placeholder="" disabled />
          <Field label="Year Level" value={sectionForm.yearLevelName ?? ""} onChange={() => undefined} placeholder="" disabled />
          <Field label="Section Name" value={sectionForm.code} onChange={(v) => setSectionForm((c) => ({ ...c, code: v }))} placeholder="BSIT 1A" />
          <Field label="Course" value={sectionForm.program} onChange={(v) => setSectionForm((c) => ({ ...c, program: v }))} placeholder="BSIT" />
          <Field label="Adviser / Teacher" value={sectionForm.adviserName ?? ""} onChange={(v) => setSectionForm((c) => ({ ...c, adviserName: v }))} placeholder="Optional" />
          <Field label="Description" value={sectionForm.description ?? ""} onChange={(v) => setSectionForm((c) => ({ ...c, description: v }))} placeholder="Optional" />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2">{submitState.error}</div>
          ) : null}
        </div>
      </AppModal>

      {/* Delete confirmation */}
      {deleteTarget ? (
        <AppModal
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => { if (!deleteState.deleting && !open) setDeleteTarget(null); }}
          title={
            deleteTarget.type === 'year' ? 'Delete Academic Year'
            : deleteTarget.type === 'course' ? 'Delete Course'
            : deleteTarget.type === 'yearLevel' ? 'Delete Year Level'
            : 'Delete Section'
          }
          description={
            deleteTarget.type === 'year'
              ? `Permanently delete "${deleteTarget.name}" and all its courses, year levels and sections. This cannot be undone.`
            : deleteTarget.type === 'course'
              ? `Permanently delete course "${deleteTarget.name}" and all its year levels. Students must be moved out first. This cannot be undone.`
            : deleteTarget.type === 'yearLevel'
              ? `Permanently delete year level "${deleteTarget.name}" and all its sections. This cannot be undone.`
            : `Permanently delete section "${deleteTarget.name}". This cannot be undone.`
          }
          size="md"
          footer={(
            <>
              <button type="button" disabled={deleteState.deleting} onClick={() => setDeleteTarget(null)}
                className="rounded-[20px] border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={deleteState.deleting} onClick={handleConfirmDelete}
                className="rounded-[20px] bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
                {deleteState.deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        >
          {deleteState.error ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
              {deleteState.error}
            </div>
          ) : null}
        </AppModal>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3 text-center dark:bg-slate-950/45">
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300 dark:text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({ title, message, actionLabel, onAction }: {
  title: string; message: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/82 p-10 text-center text-sm text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/35 dark:text-slate-300">
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{message}</p>
      <button type="button" onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
        <Plus size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="h-12 w-full rounded-[20px] border border-slate-300 bg-white dark:bg-slate-900/85 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>; placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-[20px] border border-slate-300 bg-white dark:bg-slate-900/85 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100">
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={`${label}-${opt.value}`} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
