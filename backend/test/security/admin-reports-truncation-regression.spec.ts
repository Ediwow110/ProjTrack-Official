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

function buildPrismaMock(submissions: any[], subjects: any[]) {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const countMock = jest.fn().mockImplementation((args?: { where?: any }) => {
    const where = args?.where ?? {};
    let filtered = [...submissions];
    if (where.subjectId) filtered = filtered.filter((s) => s.subjectId === where.subjectId);
    if (where.status && typeof where.status === 'string') {
      filtered = filtered.filter((s) => s.status === where.status);
    }
    if (where.status?.in) {
      filtered = filtered.filter((s) => where.status.in.includes(s.status));
    }
    return Promise.resolve(filtered.length);
  });

  const groupByMock = jest.fn().mockImplementation((args: { by: string[]; where?: any; _count?: any }) => {
    const where = args.where ?? {};
    let filtered = [...submissions];
    if (where.subjectId) filtered = filtered.filter((s) => s.subjectId === where.subjectId);
    if (where.status && typeof where.status === 'string') {
      filtered = filtered.filter((s) => s.status === where.status);
    }
    if (where.status?.in) {
      filtered = filtered.filter((s) => where.status.in.includes(s.status));
    }

    // Group by subjectId
    const groupMap = new Map<string, number>();
    for (const s of filtered) {
      groupMap.set(s.subjectId, (groupMap.get(s.subjectId) ?? 0) + 1);
    }

    const result = Array.from(groupMap.entries()).map(([subjectId, count]) => ({
      subjectId,
      _count: { id: count },
    }));
    return Promise.resolve(result);
  });

  const findManyMock = jest.fn().mockImplementation((args?: { where?: any; take?: number }) => {
    const where = args?.where ?? {};
    let filtered = [...submissions];
    if (where.subjectId) filtered = filtered.filter((s) => s.subjectId === where.subjectId);
    // Simulate the take cap
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
      // 200 submissions: 80 GRADED, 70 SUBMITTED, 50 LATE
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
      // GRADED=80, pending (SUBMITTED+LATE)=120
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

      // 100 submissions for Section A, 100 for Section B
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
      // Verify the take is >100
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
      // Header + 150 data rows
      expect(result.csv.split('\n')).toHaveLength(151);
    });
  });

  describe('reportBundle() reflects full data beyond 100', () => {
    it('metrics reflect all submissions', async () => {
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
    });
  });
});
