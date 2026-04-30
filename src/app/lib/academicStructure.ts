import type {
  AdminAcademicYearRecord,
  AdminSectionRecord,
  BulkMoveSectionRecord,
} from "./api/contracts";

type SectionLike = Pick<
  AdminSectionRecord,
  "id" | "code" | "program" | "academicYearId" | "academicYear" | "ay" | "yearLevelId" | "yearLevelName" | "yearLevelLabel" | "yearLevel"
> |
  Pick<
    BulkMoveSectionRecord,
    "id" | "code" | "course" | "academicYearId" | "academicYear" | "yearLevelId" | "yearLevelName" | "yearLevel"
  >;

export function normalizeAcademicLabel(value?: string | null) {
  return String(value ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

export function normalizeCourseLabel(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeYearLevelLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d+)(?:st|nd|rd|th)?(?:\s+year)?$/i);
  if (!match?.[1]) return raw.replace(/\s+/g, " ");
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1) return raw.replace(/\s+/g, " ");
  const suffix =
    parsed % 10 === 1 && parsed % 100 !== 11
      ? "st"
      : parsed % 10 === 2 && parsed % 100 !== 12
        ? "nd"
        : parsed % 10 === 3 && parsed % 100 !== 13
          ? "rd"
          : "th";
  return `${parsed}${suffix} Year`;
}

function sectionCourse(section: SectionLike) {
  return "program" in section ? normalizeCourseLabel(section.program) : normalizeCourseLabel(section.course);
}

function sectionYearLevel(section: SectionLike) {
  return normalizeYearLevelLabel(
    ("yearLevelName" in section ? section.yearLevelName : "") ||
      ("yearLevelLabel" in section ? section.yearLevelLabel : "") ||
      String(section.yearLevel ?? ""),
  );
}

function sectionAcademicYear(section: SectionLike) {
  return normalizeAcademicLabel(("academicYear" in section ? section.academicYear : "") || ("ay" in section ? section.ay : ""));
}

export function getCourseOptions(sections: SectionLike[], academicYearId?: string) {
  const byKey = new Map<string, string>();
  sections.forEach((section) => {
    if (academicYearId && section.academicYearId !== academicYearId) return;
    const course = sectionCourse(section);
    if (!course) return;
    const key = course.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, course);
  });
  return Array.from(byKey.values()).sort((left, right) => left.localeCompare(right));
}

export function getYearLevelOptions(
  sections: SectionLike[],
  selection: { academicYearId?: string; course?: string },
) {
  const byKey = new Map<string, { id: string; label: string }>();
  sections.forEach((section) => {
    if (selection.academicYearId && section.academicYearId !== selection.academicYearId) return;
    if (selection.course && sectionCourse(section).toLowerCase() !== normalizeCourseLabel(selection.course).toLowerCase()) return;
    const label = sectionYearLevel(section);
    const id = String(section.yearLevelId || label).trim();
    if (!id || !label || byKey.has(id)) return;
    byKey.set(id, { id, label });
  });
  return Array.from(byKey.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function getSectionOptions(
  sections: SectionLike[],
  selection: { academicYearId?: string; course?: string; yearLevelId?: string; yearLevelName?: string },
) {
  const normalizedCourse = normalizeCourseLabel(selection.course).toLowerCase();
  const normalizedYearName = normalizeYearLevelLabel(selection.yearLevelName).toLowerCase();
  return sections.filter((section) => {
    if (selection.academicYearId && section.academicYearId !== selection.academicYearId) return false;
    if (normalizedCourse && sectionCourse(section).toLowerCase() !== normalizedCourse) return false;
    if (!selection.yearLevelId && !normalizedYearName) return true;
    const sectionYearId = String(section.yearLevelId || "").trim();
    const sectionYearName = sectionYearLevel(section).toLowerCase();
    return (
      (selection.yearLevelId && sectionYearId === selection.yearLevelId) ||
      (normalizedYearName && sectionYearName === normalizedYearName)
    );
  });
}

export function getAcademicYearFromSections(
  academicYears: AdminAcademicYearRecord[],
  sections: SectionLike[],
  academicYearId?: string,
) {
  if (academicYearId) {
    return academicYears.find((year) => year.id === academicYearId) ?? null;
  }
  const active = academicYears.find((year) => String(year.status).trim().toLowerCase() === "active");
  if (active) return active;
  const firstSectionYear = sections
    .map((section) => ({ id: section.academicYearId, name: sectionAcademicYear(section) }))
    .find((item) => item.id && item.name);
  if (!firstSectionYear) return null;
  return (
    academicYears.find((year) => year.id === firstSectionYear.id) ??
    ({
      id: firstSectionYear.id,
      name: firstSectionYear.name,
      status: "Active",
      sectionCount: 0,
      studentCount: 0,
      courseCount: 0,
      yearLevelCount: 0,
      yearLevels: [],
    } as AdminAcademicYearRecord)
  );
}
