import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";

import { AppModal } from "../../components/ui/app-modal";
import {
  getCourseOptions,
  getSectionOptions,
  getYearLevelOptions,
} from "../../lib/academicStructure";
import { adminOpsService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { BulkMoveSectionRecord } from "../../lib/api/contracts";

type StructureSelection = {
  academicYearId: string;
  course: string;
  yearLevelId: string;
  sectionId: string;
};

const emptySelection: StructureSelection = {
  academicYearId: "",
  course: "",
  yearLevelId: "",
  sectionId: "",
};

export default function AdminBulkMoveStudents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, setData, reload } = useAsyncData(
    () => adminOpsService.getBulkMoveData(),
    [],
  );
  const academicYears = data?.academicYears ?? [];
  const sections = data?.sections ?? [];
  const [sourceSelection, setSourceSelection] = useState<StructureSelection>(emptySelection);
  const [destSelection, setDestSelection] = useState<StructureSelection>(emptySelection);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const requestedSource =
    searchParams.get("sourceSectionId")?.trim() ??
    searchParams.get("source")?.trim() ??
    "";
  const requestedDest =
    searchParams.get("destSectionId")?.trim() ??
    searchParams.get("dest")?.trim() ??
    "";

  const sourceSection = sections.find((section) => section.id === sourceSelection.sectionId) ?? null;
  const destSection = sections.find((section) => section.id === destSelection.sectionId) ?? null;

  useEffect(() => {
    const nextSource = sections.find((section) => section.id === requestedSource);
    const nextDest = sections.find((section) => section.id === requestedDest);

    if (nextSource) {
      setSourceSelection({
        academicYearId: nextSource.academicYearId,
        course: nextSource.course,
        yearLevelId: nextSource.yearLevelId || nextSource.yearLevelName || nextSource.yearLevel,
        sectionId: nextSource.id,
      });
    }

    if (nextDest) {
      setDestSelection({
        academicYearId: nextDest.academicYearId,
        course: nextDest.course,
        yearLevelId: nextDest.yearLevelId || nextDest.yearLevelName || nextDest.yearLevel,
        sectionId: nextDest.id,
      });
    }
  }, [requestedDest, requestedSource, sections]);

  function updateRouteSelection(nextSourceSectionId: string, nextDestSectionId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextSourceSectionId) next.set("sourceSectionId", nextSourceSectionId);
    else next.delete("sourceSectionId");

    if (nextDestSectionId) next.set("destSectionId", nextDestSectionId);
    else next.delete("destSectionId");

    next.delete("source");
    next.delete("dest");

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }

  const sourceCourses = useMemo(
    () => getCourseOptions(sections, sourceSelection.academicYearId),
    [sections, sourceSelection.academicYearId],
  );
  const destCourses = useMemo(
    () => getCourseOptions(sections, destSelection.academicYearId),
    [sections, destSelection.academicYearId],
  );
  const sourceYearLevels = useMemo(
    () =>
      getYearLevelOptions(sections, {
        academicYearId: sourceSelection.academicYearId,
        course: sourceSelection.course,
      }),
    [sections, sourceSelection.academicYearId, sourceSelection.course],
  );
  const destYearLevels = useMemo(
    () =>
      getYearLevelOptions(sections, {
        academicYearId: destSelection.academicYearId,
        course: destSelection.course,
      }),
    [sections, destSelection.academicYearId, destSelection.course],
  );

  const sourceSections = (getSectionOptions(sections, {
    academicYearId: sourceSelection.academicYearId,
    course: sourceSelection.course,
    yearLevelId: sourceSelection.yearLevelId,
    yearLevelName:
      sourceYearLevels.find((level) => level.id === sourceSelection.yearLevelId)?.label ??
      sourceSelection.yearLevelId,
  }) as BulkMoveSectionRecord[]);
  const destSections = (getSectionOptions(sections, {
    academicYearId: destSelection.academicYearId,
    course: destSelection.course,
    yearLevelId: destSelection.yearLevelId,
    yearLevelName:
      destYearLevels.find((level) => level.id === destSelection.yearLevelId)?.label ??
      destSelection.yearLevelId,
  }) as BulkMoveSectionRecord[]).filter(
    (section) => section.id !== sourceSelection.sectionId,
  );

  const sourceStudents = useMemo(() => {
    const students = sourceSection?.students ?? [];
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(normalizedQuery) ||
        String(student.studentNumber || "").toLowerCase().includes(normalizedQuery),
    );
  }, [search, sourceSection]);

  const selectedStudents = sourceStudents.filter((student) => selected.includes(student.id));

  function setSource(next: Partial<StructureSelection>) {
    setSourceSelection((current) => {
      const updated = { ...current, ...next };
      updateRouteSelection(updated.sectionId, destSelection.sectionId);
      return updated;
    });
  }

  function setDestination(next: Partial<StructureSelection>) {
    setDestSelection((current) => {
      const updated = { ...current, ...next };
      updateRouteSelection(sourceSelection.sectionId, updated.sectionId);
      return updated;
    });
  }

  const toggleStudent = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    setSelected(
      selected.length === sourceStudents.length
        ? []
        : sourceStudents.map((student) => student.id),
    );
  };

  const handleMove = async () => {
    if (!sourceSection || !destSection) return;
    const updated = await adminOpsService.moveStudents(sourceSection.id, destSection.id, selected);
    setData(updated);
    setDoneMessage(
      `${selected.length} student(s) moved from ${sourceSection.academicYear} / ${sourceSection.course} / ${sourceSection.yearLevelName || sourceSection.yearLevel} / ${sourceSection.code} to ${destSection.academicYear} / ${destSection.course} / ${destSection.yearLevelName || destSection.yearLevel} / ${destSection.code}.`,
    );
    setSelected([]);
    setShowModal(false);
    window.setTimeout(() => setDoneMessage(null), 3500);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/sections")}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 dark:text-slate-300 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <h1
            className="font-bold text-slate-900 dark:text-slate-100"
            style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}
          >
            Bulk Move Students
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-300">
            Promote or reassign students through the same academic hierarchy used for student placement.
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-300">
            {loading
              ? "Loading academic structure..."
              : `${sourceStudents.length} student${sourceStudents.length === 1 ? "" : "s"} in the selected source section`}
          </p>
        </div>

        <button
          disabled={loading}
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {doneMessage ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{doneMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <StructurePicker
          title="Source"
          academicYears={academicYears}
          courses={sourceCourses}
          yearLevels={sourceYearLevels}
          sections={sourceSections}
          selection={sourceSelection}
          onAcademicYearChange={(academicYearId) => {
            setSource({ academicYearId, course: "", yearLevelId: "", sectionId: "" });
            setSelected([]);
          }}
          onCourseChange={(course) => {
            setSource({ course, yearLevelId: "", sectionId: "" });
            setSelected([]);
          }}
          onYearLevelChange={(yearLevelId) => {
            setSource({ yearLevelId, sectionId: "" });
            setSelected([]);
          }}
          onSectionChange={(sectionId) => {
            setSource({ sectionId });
            setSelected([]);
          }}
        />

        <div className="flex items-center justify-center">
          <ArrowRight size={20} className="text-slate-400 dark:text-slate-300" />
        </div>

        <StructurePicker
          title="Destination"
          academicYears={academicYears}
          courses={destCourses}
          yearLevels={destYearLevels}
          sections={destSections}
          selection={destSelection}
          onAcademicYearChange={(academicYearId) => setDestination({ academicYearId, course: "", yearLevelId: "", sectionId: "" })}
          onCourseChange={(course) => setDestination({ course, yearLevelId: "", sectionId: "" })}
          onYearLevelChange={(yearLevelId) => setDestination({ yearLevelId, sectionId: "" })}
          onSectionChange={(sectionId) => setDestination({ sectionId })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-900/85 shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 dark:border-slate-700/70 p-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
              <Search size={13} className="shrink-0 text-slate-400 dark:text-slate-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search selected source section students..."
                aria-label="Search students in source section"
                className="flex-1 text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
                disabled={!sourceSection || loading}
              />
            </div>
          </div>

          {!sourceSection ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-300">
              Select a source academic year, course, year level, and section to see students.
            </div>
          ) : sourceStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-300">
              No students in this section.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      disabled={loading || sourceStudents.length === 0}
                      checked={selected.length === sourceStudents.length && sourceStudents.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-300 accent-blue-800 disabled:opacity-50"
                    />
                  </th>
                  {["Student ID", "Name"].map((header) => (
                    <th
                      key={header}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-300"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
                {sourceStudents.map((student) => (
                  <tr
                    key={student.id}
                    className={`${selected.includes(student.id) ? "bg-blue-50/50" : ""} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/70`}
                    onClick={() => toggleStudent(student.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleStudent(student.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select student ${student.name}`}
                  >
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(student.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-slate-300 accent-blue-800"
                      />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400 dark:text-slate-300">
                      {student.studentNumber || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {student.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-900/85 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Move Summary</h2>

            <div className="space-y-2 text-xs">
              <SummaryLine
                label="From"
                value={
                  sourceSection
                    ? `${sourceSection.academicYear} / ${sourceSection.course} / ${sourceSection.yearLevelName || sourceSection.yearLevel} / ${sourceSection.code}`
                    : "—"
                }
              />
              <SummaryLine
                label="To"
                value={
                  destSection
                    ? `${destSection.academicYear} / ${destSection.course} / ${destSection.yearLevelName || destSection.yearLevel} / ${destSection.code}`
                    : "—"
                }
              />
              <SummaryLine label="Students Selected" value={String(selected.length)} emphasize />
            </div>

            {selected.length > 0 ? (
              <div className="mb-4 mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Selected:</p>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {selectedStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{student.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className="rounded p-1 text-slate-400 dark:text-slate-300 hover:text-rose-500"
                        aria-label={`Remove ${student.name} from selected students`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selected.length > 0 ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 dark:bg-amber-500/15 p-2.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This updates each selected student&apos;s academic year, course, year level, and section to match the destination section.
                </p>
              </div>
            ) : null}

            <button
              onClick={() => setShowModal(true)}
              disabled={!sourceSection || !destSection || selected.length === 0}
              className="w-full rounded-xl bg-blue-800 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Move {selected.length > 0 ? `${selected.length} Student(s)` : "Students"}
            </button>
          </div>
        </div>
      </div>

      <AppModal
        open={showModal}
        onOpenChange={setShowModal}
        title="Confirm Bulk Move"
        description="Review the academic structure and selected count before reassigning students."
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 sm:w-auto dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              className="w-full rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 sm:w-auto"
            >
              Confirm Move
            </button>
          </>
        }
      >
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          You are about to move{" "}
          <span className="font-bold text-slate-800 dark:text-slate-100">{selected.length} student(s)</span>{" "}
          from{" "}
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {sourceSection ? `${sourceSection.academicYear} / ${sourceSection.course} / ${sourceSection.yearLevelName || sourceSection.yearLevel} / ${sourceSection.code}` : "—"}
          </span>{" "}
          to{" "}
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {destSection ? `${destSection.academicYear} / ${destSection.course} / ${destSection.yearLevelName || destSection.yearLevel} / ${destSection.code}` : "—"}
          </span>.
        </p>
      </AppModal>
    </div>
  );
}

function StructurePicker({
  title,
  academicYears,
  courses,
  yearLevels,
  sections,
  selection,
  onAcademicYearChange,
  onCourseChange,
  onYearLevelChange,
  onSectionChange,
}: {
  title: string;
  academicYears: Array<{ id: string; name: string; status: string }>;
  courses: string[];
  yearLevels: Array<{ id: string; label: string }>;
  sections: BulkMoveSectionRecord[];
  selection: StructureSelection;
  onAcademicYearChange: (value: string) => void;
  onCourseChange: (value: string) => void;
  onYearLevelChange: (value: string) => void;
  onSectionChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-900/85 p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-100">{title} Structure</h2>
      <p className="mb-4 text-xs text-slate-400 dark:text-slate-300">
        Follow the academic hierarchy: Academic Year, Course / Program, Year Level, then Section.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LabeledSelect
          label="Academic Year"
          value={selection.academicYearId}
          onChange={onAcademicYearChange}
          options={academicYears.map((year) => ({
            value: year.id,
            label: `${year.name} · ${year.status}`,
          }))}
          placeholder="Select academic year"
        />
        <LabeledSelect
          label="Course / Program"
          value={selection.course}
          onChange={onCourseChange}
          options={courses.map((course) => ({
            value: course,
            label: course,
          }))}
          placeholder={selection.academicYearId ? "Select course" : "Select academic year first"}
          disabled={!selection.academicYearId}
        />
        <LabeledSelect
          label="Year Level"
          value={selection.yearLevelId}
          onChange={onYearLevelChange}
          options={yearLevels.map((yearLevel) => ({
            value: yearLevel.id,
            label: yearLevel.label,
          }))}
          placeholder={selection.course ? "Select year level" : "Select course first"}
          disabled={!selection.academicYearId || !selection.course}
        />
        <LabeledSelect
          label="Section"
          value={selection.sectionId}
          onChange={onSectionChange}
          options={sections.map((section) => ({
            value: section.id,
            label: `${section.code} · ${section.course}`,
          }))}
          placeholder={selection.yearLevelId ? "Select section" : "Select year level first"}
          disabled={!selection.yearLevelId}
        />
      </div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option.value || "blank"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryLine({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400 dark:text-slate-300">{label}</span>
      <span className={emphasize ? "font-bold text-blue-700 dark:text-blue-300" : "font-semibold text-slate-700 dark:text-slate-200"}>
        {value}
      </span>
    </div>
  );
}
