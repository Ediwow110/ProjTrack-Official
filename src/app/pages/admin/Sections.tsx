import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
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
  AdminSectionCreateInput,
  AdminSectionRecord,
  SectionMasterListResponse,
} from "../../lib/api/contracts";

type StructureView = {
  academicYearId: string;
  yearLevelId: string;
  sectionId: string;
};

const emptyView: StructureView = {
  academicYearId: "",
  yearLevelId: "",
  sectionId: "",
};

const initialAcademicYearForm = {
  name: "",
  status: "Upcoming",
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
  const [createLevelOpen, setCreateLevelOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [academicYearForm, setAcademicYearForm] = useState(initialAcademicYearForm);
  const [yearLevelForm, setYearLevelForm] = useState(initialYearLevelForm);
  const [sectionForm, setSectionForm] = useState<AdminSectionCreateInput>(initialSectionForm);
  const [submitState, setSubmitState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });

  const {
    data,
    loading,
    error,
    reload,
  } = useAsyncData(
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
    academicYears.find((year) => year.id === view.academicYearId) ??
    null;
  const selectedYearLevels = selectedYear?.yearLevels ?? [];
  const selectedYearLevel =
    selectedYearLevels.find((level) => level.id === view.yearLevelId) ?? null;
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

  const {
    data: masterList,
    loading: masterListLoading,
    error: masterListError,
  } = useAsyncData(
    () =>
      view.sectionId
        ? adminCatalogService.getSectionMasterList(view.sectionId)
        : Promise.resolve(null as SectionMasterListResponse | null),
    [view.sectionId],
  );

  function openAcademicYear(year: AdminAcademicYearRecord) {
    setView({
      academicYearId: year.id,
      yearLevelId: "",
      sectionId: "",
    });
  }

  function openYearLevel(level: AdminAcademicYearLevelRecord) {
    setView((current) => ({
      ...current,
      yearLevelId: level.id,
      sectionId: "",
    }));
  }

  function openSection(section: AdminSectionRecord) {
    setView((current) => ({
      ...current,
      sectionId: section.id,
    }));
  }

  function openCreateAcademicYear() {
    setAcademicYearForm(initialAcademicYearForm);
    setSubmitState({ saving: false, error: null });
    setCreateYearOpen(true);
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
    });
    setSubmitState({ saving: false, error: null });
    setCreateSectionOpen(true);
  }

  async function handleCreateAcademicYear() {
    setSubmitState({ saving: true, error: null });
    try {
      const created = await adminCatalogService.createAcademicYear(academicYearForm);
      await reload();
      setView({
        academicYearId: created.id,
        yearLevelId: "",
        sectionId: "",
      });
      setCreateYearOpen(false);
      setAcademicYearForm(initialAcademicYearForm);
      setSubmitState({ saving: false, error: null });
    } catch (createError) {
      setSubmitState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create the academic year.",
      });
    }
  }

  async function handleCreateYearLevel() {
    if (!selectedYear) return;
    setSubmitState({ saving: true, error: null });
    try {
      const created = await adminCatalogService.createAcademicYearLevel({
        academicYearId: selectedYear.id,
        name: yearLevelForm.name,
        sortOrder: yearLevelForm.sortOrder ? Number(yearLevelForm.sortOrder) : undefined,
      });
      await reload();
      setView({
        academicYearId: selectedYear.id,
        yearLevelId: created.id,
        sectionId: "",
      });
      setCreateLevelOpen(false);
      setYearLevelForm(initialYearLevelForm);
      setSubmitState({ saving: false, error: null });
    } catch (createError) {
      setSubmitState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create the year level.",
      });
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
    } catch (createError) {
      setSubmitState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create the section.",
      });
    }
  }

  const showAcademicYears = !view.academicYearId;
  const showYearLevels = Boolean(view.academicYearId) && !view.yearLevelId;
  const showSections = Boolean(view.academicYearId && view.yearLevelId) && !view.sectionId;

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
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">
              Organize the school structure one step at a time: academic years, year levels, sections, then the section master list.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={loading}
              onClick={reload}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/bulk-move")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
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
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {showAcademicYears ? (
          <div className="flex max-w-sm items-center gap-2 rounded-lg border border-slate-200 bg-white/88 px-3 py-2 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/45">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              disabled={loading}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search academic years..."
              aria-label="Search academic years"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        ) : null}

        {showAcademicYears ? (
          academicYears.length === 0 ? (
            <EmptyState
              title="No academic years yet"
              message="Create your first academic year to start building year levels, sections, and section rosters."
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
                  className="rounded-2xl border border-slate-200 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{year.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {year.yearLevelCount} year level{year.yearLevelCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusChip status={year.status} size="xs" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="Year Levels" value={year.yearLevelCount} />
                    <Metric label="Sections" value={year.sectionCount} />
                    <Metric label="Students" value={year.studentCount} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                    <span>Open academic year</span>
                    <ChevronRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {showYearLevels && selectedYear ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView(emptyView)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to Academic Years
            </button>

            <div className="rounded-3xl border border-slate-200 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedYear.name}</h2>
                <StatusChip status={selectedYear.status} size="xs" />
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Open a year level to manage its sections and section master lists.
              </p>
            </div>

            {selectedYearLevels.length === 0 ? (
              <EmptyState
                title="No year levels yet"
                message="Add year levels inside this academic year before creating sections."
                actionLabel="Add Year Level"
                onAction={openCreateYearLevel}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {selectedYearLevels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => openYearLevel(level)}
                    className="rounded-2xl border border-slate-200 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{level.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {level.sectionCount} section{level.sectionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <FolderTree size={16} className="text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Sections" value={level.sectionCount} />
                      <Metric label="Students" value={level.studentCount} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                      <span>Open year level</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {showSections && selectedYear && selectedYearLevel ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() =>
                setView({
                  academicYearId: selectedYear.id,
                  yearLevelId: "",
                  sectionId: "",
                })
              }
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to {selectedYear.name}
            </button>

            <div className="rounded-3xl border border-slate-200 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Year Level
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{selectedYearLevel.name}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Sections in {selectedYear.name} / {selectedYearLevel.name}.
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
                    className="rounded-2xl border border-slate-200 bg-white/88 p-5 text-left shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-slate-500/80 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{section.code}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {section.program || "Course not set"}
                        </p>
                      </div>
                      <Users size={16} className="text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>Adviser: {section.adviser || "Unassigned"}</p>
                      {section.description ? <p>{section.description}</p> : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Students" value={section.students} />
                      <Metric label="Subjects" value={section.subjects} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                      <span>Open master list</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {view.sectionId && selectedYear && selectedYearLevel && selectedSection ? (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() =>
                setView({
                  academicYearId: selectedYear.id,
                  yearLevelId: selectedYearLevel.id,
                  sectionId: "",
                })
              }
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to {selectedYearLevel.name}
            </button>

            <div className="rounded-3xl border border-slate-200 bg-white/82 p-6 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Section Master&apos;s List
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{selectedSection.code}</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    {selectedYear.name} / {selectedYearLevel.name} / {selectedSection.program || "Course not set"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/admin/students?sectionId=${encodeURIComponent(selectedSection.id)}`)
                    }
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <Users size={14} />
                    View Students
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/admin/bulk-move?sourceSectionId=${encodeURIComponent(selectedSection.id)}`)
                    }
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <FolderTree size={14} />
                    Manage Moves
                  </button>
                </div>
              </div>
            </div>

            {masterListError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {masterListError}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/86 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/40">
              <div className="border-b border-slate-200/70 px-6 py-4 dark:border-slate-700/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Master&apos;s List</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Student ID, last name, first name, and M.I. only.
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
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/70 bg-slate-50/85 dark:border-slate-700/70 dark:bg-slate-900/70">
                        {["Student ID", "Last Name", "First Name", "M.I."].map((header) => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {masterList.rows.map((student) => (
                        <tr key={`${student.id}-${student.studentId}`} className="bg-white/70 dark:bg-slate-950/20">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-300">{student.studentId}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{student.lastName}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.firstName}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.middleInitial || ""}</td>
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

      <AppModal
        open={createYearOpen}
        onOpenChange={(nextOpen) => {
          if (!submitState.saving) setCreateYearOpen(nextOpen);
        }}
        title="Add Academic Year"
        description="Create the academic year card first, then add year levels and sections under it."
        footer={(
          <>
            <button
              type="button"
              disabled={submitState.saving}
              onClick={() => setCreateYearOpen(false)}
              className="rounded-[20px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!academicYearForm.name.trim() || submitState.saving}
              onClick={handleCreateAcademicYear}
              className="rounded-[20px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {submitState.saving ? "Creating..." : "Create Academic Year"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Academic Year"
            value={academicYearForm.name}
            onChange={(value) => setAcademicYearForm((current) => ({ ...current, name: value }))}
            placeholder="2025-2026"
          />

          <SelectField
            label="Status"
            value={academicYearForm.status}
            onChange={(value) => setAcademicYearForm((current) => ({ ...current, status: value }))}
            options={[
              { value: "Upcoming", label: "Upcoming" },
              { value: "Active", label: "Active" },
              { value: "Archived", label: "Archived" },
            ]}
            placeholder="Select status"
          />

          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:col-span-2 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={createLevelOpen}
        onOpenChange={(nextOpen) => {
          if (!submitState.saving) setCreateLevelOpen(nextOpen);
        }}
        title="Add Year Level"
        description="Add a year level or custom level inside the selected academic year."
        footer={(
          <>
            <button
              type="button"
              disabled={submitState.saving}
              onClick={() => setCreateLevelOpen(false)}
              className="rounded-[20px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!yearLevelForm.name.trim() || submitState.saving}
              onClick={handleCreateYearLevel}
              className="rounded-[20px] bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {submitState.saving ? "Creating..." : "Create Year Level"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Academic Year"
            value={selectedYear?.name ?? ""}
            onChange={() => undefined}
            placeholder=""
            disabled
          />
          <Field
            label="Year Level"
            value={yearLevelForm.name}
            onChange={(value) => setYearLevelForm((current) => ({ ...current, name: value }))}
            placeholder="1st Year, Grade 11, Bridge Program"
          />
          <Field
            label="Sort Order"
            value={yearLevelForm.sortOrder}
            onChange={(value) => setYearLevelForm((current) => ({ ...current, sortOrder: value }))}
            placeholder="Optional"
          />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:col-span-2 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={createSectionOpen}
        onOpenChange={(nextOpen) => {
          if (!submitState.saving) setCreateSectionOpen(nextOpen);
        }}
        title="Add Section"
        description="Sections are created inside the selected academic year and year level."
        size="xl"
        footer={(
          <>
            <button
              type="button"
              disabled={submitState.saving}
              onClick={() => setCreateSectionOpen(false)}
              className="rounded-[20px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                submitState.saving ||
                !sectionForm.code.trim() ||
                !sectionForm.program.trim() ||
                !sectionForm.yearLevelId
              }
              onClick={handleCreateSection}
              className="rounded-[20px] bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {submitState.saving ? "Creating..." : "Create Section"}
            </button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Academic Year"
            value={sectionForm.academicYear ?? ""}
            onChange={() => undefined}
            placeholder=""
            disabled
          />
          <Field
            label="Year Level"
            value={sectionForm.yearLevelName ?? ""}
            onChange={() => undefined}
            placeholder=""
            disabled
          />
          <Field
            label="Section Name"
            value={sectionForm.code}
            onChange={(value) => setSectionForm((current) => ({ ...current, code: value }))}
            placeholder="BSIT 1A"
          />
          <Field
            label="Course"
            value={sectionForm.program}
            onChange={(value) => setSectionForm((current) => ({ ...current, program: value }))}
            placeholder="BSIT"
          />
          <Field
            label="Adviser / Teacher"
            value={sectionForm.adviserName ?? ""}
            onChange={(value) => setSectionForm((current) => ({ ...current, adviserName: value }))}
            placeholder="Optional"
          />
          <Field
            label="Description"
            value={sectionForm.description ?? ""}
            onChange={(value) => setSectionForm((current) => ({ ...current, description: value }))}
            placeholder="Optional"
          />
          {submitState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 md:col-span-2 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center dark:bg-slate-950/45">
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/82 p-10 text-center text-sm text-slate-500 shadow-[var(--shadow-soft)] dark:border-slate-700/70 dark:bg-slate-950/35 dark:text-slate-300">
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
      >
        <Plus size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-12 w-full rounded-[20px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[20px] border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
