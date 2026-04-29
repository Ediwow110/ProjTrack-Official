export type SeedRelationKind = 'demo-only' | 'mixed' | 'real-only' | 'unlinked';

type SeedRelationCount = {
  demo: number;
  real: number;
};

export type SeedSectionEvaluationInput = {
  explicitSeed: boolean;
  studentIds: string[];
  enrollmentStudentIds: string[];
  enrollmentSubjectIds: string[];
  groupIds: string[];
  subjectSectionSubjectIds: string[];
  seedStudentProfileIds: Set<string>;
  seedSubjectIds: Set<string>;
  seedGroupIds: Set<string>;
};

export type SeedSectionEvaluationResult = {
  qualifiesAsSeed: boolean;
  hasSeedLinks: boolean;
  relationKind: SeedRelationKind;
  relationCounts: {
    students: SeedRelationCount;
    enrollmentStudents: SeedRelationCount;
    enrollmentSubjects: SeedRelationCount;
    groups: SeedRelationCount;
    subjectSections: SeedRelationCount;
  };
};

function countMembership(values: string[], seedIds: Set<string>): SeedRelationCount {
  return values.reduce(
    (acc, value) => {
      if (seedIds.has(String(value))) {
        acc.demo += 1;
      } else {
        acc.real += 1;
      }
      return acc;
    },
    { demo: 0, real: 0 } satisfies SeedRelationCount,
  );
}

export function describeSeedRelationKind(kind: SeedRelationKind) {
  if (kind === 'demo-only') return 'demo-only';
  if (kind === 'mixed') return 'mixed demo+real';
  if (kind === 'real-only') return 'real-only';
  return 'unlinked';
}

export function summarizeSeedRelationCounts(
  counts: SeedSectionEvaluationResult['relationCounts'],
) {
  const demo =
    counts.students.demo +
    counts.enrollmentStudents.demo +
    counts.enrollmentSubjects.demo +
    counts.groups.demo +
    counts.subjectSections.demo;
  const real =
    counts.students.real +
    counts.enrollmentStudents.real +
    counts.enrollmentSubjects.real +
    counts.groups.real +
    counts.subjectSections.real;

  return { demo, real };
}

export function evaluateSeedSectionCandidate(
  input: SeedSectionEvaluationInput,
): SeedSectionEvaluationResult {
  const relationCounts = {
    students: countMembership(input.studentIds, input.seedStudentProfileIds),
    enrollmentStudents: countMembership(
      input.enrollmentStudentIds,
      input.seedStudentProfileIds,
    ),
    enrollmentSubjects: countMembership(
      input.enrollmentSubjectIds,
      input.seedSubjectIds,
    ),
    groups: countMembership(input.groupIds, input.seedGroupIds),
    subjectSections: countMembership(
      input.subjectSectionSubjectIds,
      input.seedSubjectIds,
    ),
  };

  const summary = summarizeSeedRelationCounts(relationCounts);
  const hasSeedLinks = summary.demo > 0;
  const hasRealLinks = summary.real > 0;
  const relationKind: SeedRelationKind = hasSeedLinks
    ? hasRealLinks
      ? 'mixed'
      : 'demo-only'
    : hasRealLinks
      ? 'real-only'
      : 'unlinked';

  return {
    qualifiesAsSeed: input.explicitSeed || (hasSeedLinks && !hasRealLinks),
    hasSeedLinks,
    relationKind,
    relationCounts,
  };
}
