import { AdminReportsRepository } from '../../src/repositories/admin-reports.repository';
import { SubmissionRepository } from '../../src/repositories/submission.repository';
import { SubjectRepository } from '../../src/repositories/subject.repository';
import { UserRepository } from '../../src/repositories/user.repository';

const PENDING_STATUSES = ['SUBMITTED', 'PENDING_REVIEW', 'LATE'];

function makeSubmission(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'sub-default',
    title: overrides.title ?? 'Default Submission',
    subjectId: overrides.subjectId ?? 'subject-1',
    status: overrides.status ?? 'SUBMITTED',
    grade: overrides.grade ?? null,
    submittedAt: overrides.submittedAt ?? new Date('2026-06-01'),
    studentId: overrides.studentId ?? null,
    groupId: overrides.groupId ?? null,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    taskId: 'task-1',
    subject: overrides.subject ?? { id: 'subject-1', name: 'Math' },
    student: overrides.student ?? null,
    group: overrides.group ?? null,
    ...overrides,
  };
}

function matchesSectionFilter(submission: any, where: any) {
  if (!where.OR || !Array.isArray(where.OR)) return true;
  
  for (const condition of where.OR) {
    if (condition.student?.studentProfile?.section?.name) {
      if (submission.student?.studentProfile?.section?.name === condition.student.studentProfile.section.name) {
        return true;
      }
    }
    if (condition.group?.members?.some) {
      const targetSection = condition.group.members.some.student?.studentProfile?.section?.name;
      if (targetSection && submission.group?.members?.some((m: any) => m.student?.studentProfile?.section?.name === targetSection)) {
        return true;
      }
    }
  }
  return false;
}

function buildPrismaMock(submissions: any[], subjects: any[]) {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const applyWhere = (s: any, where: any) => {
    if (where.subjectId && s.subjectId !== where.subjectId) return false;
    if (where.status && typeof where.status === 'string' && s.status !== where.status) return false;
    if (where.status?.in && !where.status.in.includes(s.status)) return false;
    if (!matchesSectionFilter(s, where)) return false;
    return true;
  };

  const countMock = jest.fn().mockImplementation((args?: { where?: any }) => {
    const where = args?.where ?? {};
    return Promise.resolve(submissions.filter((s) => applyWhere(s, where)).length);
  });

  const groupByMock = jest.fn().mockImplementation((args: { by: string[]; where?: any; _count?: any }) => {
    const where = args.where ?? {};
    const filtered = submissions.filter((s) => applyWhere(s, where));
    const groupMap = new Map<string, number>();
    for (const s of filtered) {
      groupMap.set(s.subjectId, (groupMap.get(s.subjectId) ?? 0) + 1);
    }
    return Promise.resolve(Array.from(groupMap.entries()).map(([subjectId, count]) => ({
      subjectId,
      _count: { id: count },
    })));
  });

  const findManyMock = jest.fn().mockImplementation((args?: { where?: any; take?: number }) => {
    const where = args?.where ?? {};
    let filtered = submissions.filter((s) => applyWhere(s, where));
    if (args?.take && args.take < filtered.length) {
      filtered = filtered.slice(0, args.take);
    }
    return Promise.resolve(filtered);
  });

  const findUniqueSubjectMock = jest.fn().mockImplementation((args: { where: { id: string } }) => {
    return Promise.resolve(subjectMap.get(args.where.id) ?? null);
  });

  const findManySubjectMock = jest.fn().mockImplementation((args?: { where?: any }) => {
    const ids = args?.where?.id?.in ?? [];
    return Promise.resolve(ids.length ? ids.map((id: string) => subjectMap.get(id)).filter(Boolean) : subjects);
  });

  const prisma = {
    submission: {
      findMany: findManyMock,
      count: countMock,
      groupBy: groupByMock,
    },
    subject: {
      findUnique: findUniqueSubjectMock,
      findMany: findManySubjectMock,
    },
  };

  return { prisma, countMock, groupByMock, findManyMock };
}

describe('AdminReportsRepository – no truncation (BUG-001)', () => {
  function buildRepo(prisma: any) {
    const submissionRepo = new SubmissionRepository(prisma as any);
    const subjectRepo = new SubjectRepository(prisma as any);
    const userRepo = new UserRepository(prisma as any);
    return new AdminReportsRepository(prisma as any, submissionRepo, subjectRepo, userRepo);
  }

  describe('summary() without section filter uses DB aggregates', () => {
    it('returns correct total for >100 submissions', async () => {
      const submissions = Array.from({ length: 150 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: i < 90 ? 'subject-1' : 'subject-2',
          status: i < 60 ? 'GRADED' : i < 110 ? 'SUBMITTED' : 'LATE',
        }),
      );
      const subjects = [
        { id: 'subject-1', name: 'Math' },
        { id: 'subject-2', name: 'Science' },
      ];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.summary();

      expect(result.totalSubmissions).toBe(150);
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.pendingReviews).toBeGreaterThanOrEqual(0);
      expect(result.lateRate).toBeGreaterThanOrEqual(0);
    });

    it('reports correct totals for known distribution across >100 submissions', async () => {
      const submissions = Array.from({ length: 200 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: i < 120 ? 'subject-1' : 'subject-2',
          status: i < 80 ? 'GRADED' : i < 150 ? 'SUBMITTED' : 'LATE',
        }),
      );
      const subjects = [
        { id: 'subject-1', name: 'Math' },
        { id: 'subject-2', name: 'Science' },
      ];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.summary();

      expect(result.totalSubmissions).toBe(200);
      expect(result.completionRate).toBe(Math.round(((80 + 120) / 200) * 100));
      expect(result.pendingReviews).toBe(120);
      expect(result.lateRate).toBe(Math.round((50 / 200) * 100));
      expect(result.bySubject).toHaveLength(2);
    });

    it('reports totals correctly when no section filter and single subject', async () => {
      const submissions = Array.from({ length: 150 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'GRADED',
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Physics' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.summary();

      expect(result.totalSubmissions).toBe(150);
      expect(result.bySubject).toHaveLength(1);
      expect(result.bySubject[0].subject).toBe('Physics');
      expect(result.bySubject[0].submissions).toBe(150);
      expect(result.bySubject[0].graded).toBe(150);
    });
  });

  describe('summary() with section filter', () => {
    it('filters by section correctly across many submissions', async () => {
      const studentSectionA = {
        id: 'student-a',
        firstName: 'Alice',
        lastName: 'A',
        studentProfile: { section: { name: 'Section A' } },
      };
      const studentSectionB = {
        id: 'student-b',
        firstName: 'Bob',
        lastName: 'B',
        studentProfile: { section: { name: 'Section B' } },
      };

      const submissions = [
        ...Array.from({ length: 100 }, (_, i) =>
          makeSubmission({
            id: `sub-a-${i}`,
            subjectId: 'subject-1',
            status: 'GRADED',
            studentId: 'student-a',
            student: studentSectionA,
          }),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          makeSubmission({
            id: `sub-b-${i}`,
            subjectId: 'subject-1',
            status: 'SUBMITTED',
            studentId: 'student-b',
            student: studentSectionB,
          }),
        ),
      ];
      const subjects = [{ id: 'subject-1', name: 'English' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.summary('Section A');

      expect(result.totalSubmissions).toBe(100);
      expect(result.bySubject).toHaveLength(1);
    });
  });

  describe('currentView() returns all rows beyond 100', () => {
    it('returns all 150 submissions when more than 100 exist', async () => {
      const submissions = Array.from({ length: 150 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i}`,
            firstName: `Student`,
            lastName: `${i}`,
            studentProfile: { section: { name: 'Section A' } },
          },
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const rows = await repo.currentView();

      expect(rows).toHaveLength(150);
      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: expect.any(Number) }),
      );
      const callArgs = prisma.submission.findMany.mock.calls[0][0];
      expect(callArgs.take).toBeGreaterThanOrEqual(5000);
    });

    it('returns all submissions when exactly 100 exist (boundary)', async () => {
      const submissions = Array.from({ length: 100 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i}`,
            firstName: `Student`,
            lastName: `${i}`,
            studentProfile: { section: { name: 'Section A' } },
          },
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const rows = await repo.currentView();

      expect(rows).toHaveLength(100);
    });

    it('respects subjectId filter at volume', async () => {
      const submissions = [
        ...Array.from({ length: 80 }, (_, i) =>
          makeSubmission({
            id: `sub-math-${i}`,
            subjectId: 'subject-1',
            status: 'GRADED',
            student: {
              id: `student-${i}`,
              firstName: 'S',
              lastName: `${i}`,
              studentProfile: { section: { name: 'Section A' } },
            },
          }),
        ),
        ...Array.from({ length: 80 }, (_, i) =>
          makeSubmission({
            id: `sub-sci-${i}`,
            subjectId: 'subject-2',
            status: 'SUBMITTED',
            student: {
              id: `student-sci-${i}`,
              firstName: 'S',
              lastName: `Sci${i}`,
              studentProfile: { section: { name: 'Section B' } },
            },
          }),
        ),
      ];
      const subjects = [
        { id: 'subject-1', name: 'Math' },
        { id: 'subject-2', name: 'Science' },
      ];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const mathRows = await repo.currentView(undefined, 'subject-1');
      expect(mathRows).toHaveLength(80);
      expect(mathRows.every((r: any) => r.subjectId === 'subject-1')).toBe(true);

      const sciRows = await repo.currentView(undefined, 'subject-2');
      expect(sciRows).toHaveLength(80);
      expect(sciRows.every((r: any) => r.subjectId === 'subject-2')).toBe(true);
    });
  });

  describe('exportCsv() returns all rows beyond 100', () => {
    it('produces CSV with correct line count for >100 submissions', async () => {
      const submissions = Array.from({ length: 150 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i}`,
            firstName: 'S',
            lastName: `${i}`,
            studentProfile: { section: { name: 'Section A' } },
          },
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.exportCsv();

      expect(result.filename).toBe('admin-report-export.csv');
      expect(result.csv.split('\n')).toHaveLength(151);
    });
  });

  describe('reportBundle() reflects full data beyond 100', () => {
    it('metrics reflect all submissions and metadata shows no truncation', async () => {
      const submissions = Array.from({ length: 150 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: i < 60 ? 'GRADED' : i < 110 ? 'SUBMITTED' : 'LATE',
          student: {
            id: `student-${i % 10}`,
            firstName: 'S',
            lastName: `${i % 10}`,
            studentProfile: { section: { name: 'Section A' } },
          },
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const bundle = await repo.reportBundle();

      const totalMetric = bundle.metrics.find((m: any) => m.label === 'Total Submissions');
      expect(totalMetric.value).toBe('150');

      const completionMetric = bundle.metrics.find((m: any) => m.label === 'Completion Rate');
      expect(parseInt(completionMetric.value)).toBeGreaterThanOrEqual(0);

      expect(bundle.completionData).toBeDefined();
      expect(bundle.lateData).toBeDefined();
      expect(bundle.turnaroundData).toBeDefined();
      expect(bundle.tableRows).toBeDefined();

      // Metadata: 150 submissions < 5000 cap, so no truncation
      expect(bundle.isTruncated).toBe(false);
      expect(bundle.rowLimit).toBe(5000);
      expect(bundle.totalMatchingRows).toBe(150);
      expect(bundle.returnedRows).toBe(150);
    });
  });
});

describe('AdminReportsRepository – DB-side section filtering optimization (PERF-001)', () => {
  function buildRepo(prisma: any) {
    const submissionRepo = new SubmissionRepository(prisma as any);
    const subjectRepo = new SubjectRepository(prisma as any);
    const userRepo = new UserRepository(prisma as any);
    return new AdminReportsRepository(prisma as any, submissionRepo, subjectRepo, userRepo);
  }

  it('summary(section) uses DB aggregates and does NOT call findMany (currentView)', async () => {
    // Seed 5100 submissions. Target section is in the older 100 (indices 5000-5099).
    // If it called currentView (findMany with take: 5000 orderBy desc), it would miss them.
    const submissions = Array.from({ length: 5100 }, (_, i) =>
      makeSubmission({
        id: `sub-${i}`,
        subjectId: 'subject-1',
        status: i < 5000 ? 'GRADED' : 'SUBMITTED',
        student: i >= 5000 ? {
          id: `student-${i}`,
          firstName: 'S',
          lastName: `${i}`,
          studentProfile: { section: { name: 'Section Z' } },
        } : {
          id: `student-${i}`,
          firstName: 'S',
          lastName: `${i}`,
          studentProfile: { section: { name: 'Section A' } },
        },
        submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
      }),
    );
    const subjects = [{ id: 'subject-1', name: 'Math' }];
    const { prisma, countMock, findManyMock } = buildPrismaMock(submissions, subjects);
    const repo = buildRepo(prisma);

    const result = await repo.summary('Section Z');

    // Should find the 100 submissions in Section Z despite being outside the first 5000
    expect(result.totalSubmissions).toBe(100);
    
    // Verify count was called with the section OR filter
    expect(countMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ student: expect.any(Object) }),
          expect.objectContaining({ group: expect.any(Object) })
        ])
      })
    }));

    // Verify findMany (currentView) was NOT called by summary()
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('reportBundle(section) calls findMany (currentView) at most once', async () => {
    const submissions = Array.from({ length: 5100 }, (_, i) =>
      makeSubmission({
        id: `sub-${i}`,
        subjectId: 'subject-1',
        status: 'SUBMITTED',
        student: {
          id: `student-${i}`,
          firstName: 'S',
          lastName: `${i}`,
          studentProfile: { section: { name: 'Section Z' } },
        },
        submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
      }),
    );
    const subjects = [{ id: 'subject-1', name: 'Math' }];
    const { prisma, findManyMock } = buildPrismaMock(submissions, subjects);
    const repo = buildRepo(prisma);

    await repo.reportBundle('Section Z');

    // summary() uses count/groupBy, reportBundle() uses currentView (findMany)
    // Total findMany calls should be exactly 1 (from reportBundle -> currentView)
    // countMatchingRows uses count not findMany
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});

describe('AdminReportsRepository – truncation metadata (REPORT-CAP)', () => {
  function buildRepo(prisma: any) {
    const submissionRepo = new SubmissionRepository(prisma as any);
    const subjectRepo = new SubjectRepository(prisma as any);
    const userRepo = new UserRepository(prisma as any);
    return new AdminReportsRepository(prisma as any, submissionRepo, subjectRepo, userRepo);
  }

  describe('reportBundle() metadata', () => {
    it('returns isTruncated=true when totalMatchingRows > 5000', async () => {
      const submissions = Array.from({ length: 5100 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: i < 3000 ? 'GRADED' : 'SUBMITTED',
          student: {
            id: `student-${i % 100}`,
            firstName: 'S',
            lastName: `${i % 100}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const bundle = await repo.reportBundle();

      expect(bundle.isTruncated).toBe(true);
      expect(bundle.rowLimit).toBe(5000);
      expect(bundle.totalMatchingRows).toBe(5100);
      expect(bundle.returnedRows).toBe(5000);
    });

    it('returns isTruncated=false when totalMatchingRows <= 5000', async () => {
      const submissions = Array.from({ length: 3000 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: i < 1500 ? 'GRADED' : 'SUBMITTED',
          student: {
            id: `student-${i % 100}`,
            firstName: 'S',
            lastName: `${i % 100}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const bundle = await repo.reportBundle();

      expect(bundle.isTruncated).toBe(false);
      expect(bundle.rowLimit).toBe(5000);
      expect(bundle.totalMatchingRows).toBe(3000);
      expect(bundle.returnedRows).toBe(3000);
    });

    it('returns isTruncated=false when exactly 5000 (boundary)', async () => {
      const submissions = Array.from({ length: 5000 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i % 100}`,
            firstName: 'S',
            lastName: `${i % 100}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const bundle = await repo.reportBundle();

      expect(bundle.isTruncated).toBe(false);
      expect(bundle.rowLimit).toBe(5000);
      expect(bundle.totalMatchingRows).toBe(5000);
      expect(bundle.returnedRows).toBe(5000);
    });

    it('summary totals remain full-count-safe beyond 5000', async () => {
      const submissions = Array.from({ length: 5100 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: i < 3000 ? 'subject-1' : 'subject-2',
          status: i < 2000 ? 'GRADED' : 'SUBMITTED',
          student: {
            id: `student-${i % 100}`,
            firstName: 'S',
            lastName: `${i % 100}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1 + Math.floor(i / 100)),
        }),
      );
      const subjects = [
        { id: 'subject-1', name: 'Math' },
        { id: 'subject-2', name: 'Science' },
      ];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const bundle = await repo.reportBundle();

      // summary uses DB aggregates — totals should reflect ALL 5100 submissions
      const totalMetric = bundle.metrics.find((m: any) => m.label === 'Total Submissions');
      expect(totalMetric.value).toBe('5100');
      expect(totalMetric.value).not.toBe('5000');
    });

    it('respects section filter in truncation metadata', async () => {
      const sectionAStudent = {
        id: 'student-a',
        firstName: 'Alice',
        lastName: 'A',
        studentProfile: { section: { name: 'Section A' } },
      };
      const sectionBStudent = {
        id: 'student-b',
        firstName: 'Bob',
        lastName: 'B',
        studentProfile: { section: { name: 'Section B' } },
      };

      const submissions = [
        // Section A has 6000 submissions (will be truncated)
        ...Array.from({ length: 6000 }, (_, i) =>
          makeSubmission({
            id: `sub-a-${i}`,
            subjectId: 'subject-1',
            status: 'SUBMITTED',
            studentId: 'student-a',
            student: sectionAStudent,
            submittedAt: new Date(2026, 0, 1),
          }),
        ),
        // Section B has 100 submissions (will not be truncated)
        ...Array.from({ length: 100 }, (_, i) =>
          makeSubmission({
            id: `sub-b-${i}`,
            subjectId: 'subject-1',
            status: 'SUBMITTED',
            studentId: 'student-b',
            student: sectionBStudent,
            submittedAt: new Date(2026, 0, 1),
          }),
        ),
      ];
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      // Section A should be truncated
      const bundleA = await repo.reportBundle('Section A');
      expect(bundleA.isTruncated).toBe(true);
      expect(bundleA.totalMatchingRows).toBe(6000);
      expect(bundleA.returnedRows).toBe(5000);

      // Section B should not be truncated
      const bundleB = await repo.reportBundle('Section B');
      expect(bundleB.isTruncated).toBe(false);
      expect(bundleB.totalMatchingRows).toBe(100);
      expect(bundleB.returnedRows).toBe(100);
    });

    it('respects subjectId filter in truncation metadata', async () => {
      const submissions = [
        ...Array.from({ length: 6000 }, (_, i) =>
          makeSubmission({
            id: `sub-math-${i}`,
            subjectId: 'subject-1',
            status: 'SUBMITTED',
            student: {
              id: `student-${i % 100}`,
              firstName: 'S',
              lastName: `${i % 100}`,
              studentProfile: { section: { name: 'Section A' } },
            },
            submittedAt: new Date(2026, 0, 1),
          }),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          makeSubmission({
            id: `sub-sci-${i}`,
            subjectId: 'subject-2',
            status: 'SUBMITTED',
            student: {
              id: `student-sci-${i}`,
              firstName: 'S',
              lastName: `Sci${i}`,
              studentProfile: { section: { name: 'Section A' } },
            },
            submittedAt: new Date(2026, 0, 1),
          }),
        ),
      ];
      const subjects = [
        { id: 'subject-1', name: 'Math' },
        { id: 'subject-2', name: 'Science' },
      ];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      // subject-1 has 6000 submissions (truncated)
      const bundleMath = await repo.reportBundle(undefined, 'subject-1');
      expect(bundleMath.isTruncated).toBe(true);
      expect(bundleMath.totalMatchingRows).toBe(6000);
      expect(bundleMath.returnedRows).toBe(5000);

      // subject-2 has 100 submissions (not truncated)
      const bundleSci = await repo.reportBundle(undefined, 'subject-2');
      expect(bundleSci.isTruncated).toBe(false);
      expect(bundleSci.totalMatchingRows).toBe(100);
      expect(bundleSci.returnedRows).toBe(100);
    });
  });

  describe('exportCsv() metadata', () => {
    it('includes truncation metadata', async () => {
      const submissions = Array.from({ length: 5100 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i % 100}`,
            firstName: 'S',
            lastName: `${i % 100}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1),
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.exportCsv();

      expect(result.isTruncated).toBe(true);
      expect(result.rowLimit).toBe(5000);
      expect(result.totalMatchingRows).toBe(5100);
      expect(result.returnedRows).toBe(5000);
      expect(result.filename).toBe('admin-report-export.csv');
      expect(result.csv).toBeDefined();
      // CSV should have header + 5000 data rows
      expect(result.csv.split('\n')).toHaveLength(5001);
    });

    it('returns isTruncated=false when under cap', async () => {
      const submissions = Array.from({ length: 100 }, (_, i) =>
        makeSubmission({
          id: `sub-${i}`,
          subjectId: 'subject-1',
          status: 'SUBMITTED',
          student: {
            id: `student-${i}`,
            firstName: 'S',
            lastName: `${i}`,
            studentProfile: { section: { name: 'Section A' } },
          },
          submittedAt: new Date(2026, 0, 1),
        }),
      );
      const subjects = [{ id: 'subject-1', name: 'Math' }];
      const { prisma } = buildPrismaMock(submissions, subjects);
      const repo = buildRepo(prisma);

      const result = await repo.exportCsv();

      expect(result.isTruncated).toBe(false);
      expect(result.rowLimit).toBe(5000);
      expect(result.totalMatchingRows).toBe(100);
      expect(result.returnedRows).toBe(100);
    });
  });
});