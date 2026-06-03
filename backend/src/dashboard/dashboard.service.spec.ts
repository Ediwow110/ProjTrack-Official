import { UnauthorizedException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test subject names
// ---------------------------------------------------------------------------
const SUBJECT_1 = 'Mathematics';
const SUBJECT_2 = 'Science';
const SUBJECT_3 = 'History';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildMockPrisma() {
  const mockPrisma: any = {
    $transaction: jest.fn(),
    teacherProfile: {
      findUnique: jest.fn(),
    },
    studentProfile: {
      findUnique: jest.fn(),
    },
    submission: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    submissionTask: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    subject: {
      findMany: jest.fn(),
    },
  };
  return mockPrisma as PrismaService;
}

function buildService(prisma: PrismaService) {
  return new DashboardService(prisma, {} as any);
}

// ---------------------------------------------------------------------------
// studentCharts — correctness with batching
// ---------------------------------------------------------------------------
describe('DashboardService.studentCharts', () => {
  let prisma: PrismaService;
  let service: DashboardService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    service = buildService(prisma);
  });

  // -----------------------------------------------------------------------
  // 1. Correctness with multiple subjects
  // -----------------------------------------------------------------------
  it('returns correct progress for multiple subjects with different counts', async () => {
    // The resolveStudentProfileId helper does two lookups:
    // 1. findUnique by id (returns null since we pass userId not studentProfileId)
    // 2. findUnique by userId (returns the profile)
    (prisma.studentProfile as any).findUnique
      // First call: findUnique({ where: { id: 'student-user-id' } }) — returns null
      .mockResolvedValueOnce(null)
      // Second call: findUnique({ where: { userId: 'student-user-id' } }) — returns profile
      .mockResolvedValueOnce({ id: 'profile-1' });

    // Status counts
    (prisma.submission as any).count
      // Draft count
      .mockResolvedValueOnce(2)
      // Pending review count
      .mockResolvedValueOnce(3)
      // Needs revision count
      .mockResolvedValueOnce(1)
      // Graded count
      .mockResolvedValueOnce(5);

    // Subject list
    (prisma.subject as any).findMany.mockResolvedValueOnce([
      { id: 'subj-1', name: SUBJECT_1 },
      { id: 'subj-2', name: SUBJECT_2 },
      { id: 'subj-3', name: SUBJECT_3 },
    ]);

    // Batched progress — task counts
    (prisma.submissionTask as any).groupBy.mockResolvedValueOnce([
      { subjectId: 'subj-1', _count: { id: 10 } },
      { subjectId: 'subj-2', _count: { id: 5 } },
      { subjectId: 'subj-3', _count: { id: 8 } },
    ]);

    // Batched progress — completed counts
    (prisma.submission as any).groupBy.mockResolvedValueOnce([
      { subjectId: 'subj-1', _count: { id: 7 } },
      { subjectId: 'subj-2', _count: { id: 3 } },
    ]);
    // Note: subj-3 has 0 completed — tests zero-default

    const result = await service.studentCharts('student-user-id');

    expect(result.statusBreakdown).toEqual({
      draft: 2,
      pendingReview: 3,
      needsRevision: 1,
      graded: 5,
    });

    expect(result.subjectProgress).toEqual([
      { subject: SUBJECT_1, totalActivities: 10, completed: 7 },
      { subject: SUBJECT_2, totalActivities: 5, completed: 3 },
      { subject: SUBJECT_3, totalActivities: 8, completed: 0 },
    ]);
  });

  // -----------------------------------------------------------------------
  // 2. Zero default behavior
  // -----------------------------------------------------------------------
  it('returns zero defaults for a subject with no tasks', async () => {
    (prisma.studentProfile as any).findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'profile-1' });

    (prisma.submission as any).count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    // Single subject
    (prisma.subject as any).findMany.mockResolvedValueOnce([
      { id: 'subj-empty', name: 'Empty Subject' },
    ]);

    // No tasks for this subject
    (prisma.submissionTask as any).groupBy.mockResolvedValueOnce([]);
    // No completed submissions
    (prisma.submission as any).groupBy.mockResolvedValueOnce([]);

    const result = await service.studentCharts('student-user-id');

    expect(result.subjectProgress).toEqual([
      { subject: 'Empty Subject', totalActivities: 0, completed: 0 },
    ]);
  });

  // -----------------------------------------------------------------------
  // 3. Access control — another student's submissions not counted
  // -----------------------------------------------------------------------
  it('scopes progress queries to the authenticated student only', async () => {
    (prisma.studentProfile as any).findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'profile-1' });

    (prisma.submission as any).count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    (prisma.subject as any).findMany.mockResolvedValueOnce([
      { id: 'subj-1', name: SUBJECT_1 },
    ]);

    (prisma.submissionTask as any).groupBy.mockResolvedValueOnce([
      { subjectId: 'subj-1', _count: { id: 10 } },
    ]);
    (prisma.submission as any).groupBy.mockResolvedValueOnce([]);

    await service.studentCharts('student-user-id');

    // The completed-submission groupBy must include the student's ownerWhere filter
    const completedGroupByCall = (prisma.submission as any).groupBy.mock.calls[0][0];
    expect(completedGroupByCall.where).toBeDefined();

    // Verify scoping — the where must have OR with studentId
    const where = completedGroupByCall.where;
    const hasStudentScoping =
      where.studentId === 'student-user-id' ||
      (where.OR &&
        Array.isArray(where.OR) &&
        where.OR.some(
          (clause: any) =>
            clause.studentId === 'student-user-id' ||
            (clause.group?.members?.some?.studentId === 'student-user-id'),
        ));
    expect(hasStudentScoping).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 4. Batching behavior — no per-subject count calls
  // -----------------------------------------------------------------------
  it('uses groupBy instead of per-subject count queries', async () => {
    (prisma.studentProfile as any).findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'profile-1' });

    (prisma.submission as any).count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    (prisma.subject as any).findMany.mockResolvedValueOnce([
      { id: 'subj-1', name: SUBJECT_1 },
      { id: 'subj-2', name: SUBJECT_2 },
      { id: 'subj-3', name: SUBJECT_3 },
    ]);

    (prisma.submissionTask as any).groupBy.mockResolvedValueOnce([]);
    (prisma.submission as any).groupBy.mockResolvedValueOnce([]);

    await service.studentCharts('student-user-id');

    // submissionTask.count should NOT be called per-subject
    expect((prisma.submissionTask as any).count).not.toHaveBeenCalled();
    // submission.count should only be called for the 4 status counts, not per-subject
    expect((prisma.submission as any).count).toHaveBeenCalledTimes(4);

    // groupBy should be called exactly twice (task counts + completed counts)
    expect((prisma.submissionTask as any).groupBy).toHaveBeenCalledTimes(1);
    expect((prisma.submission as any).groupBy).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 5. Empty subjects list
  // -----------------------------------------------------------------------
  it('returns empty subjectProgress when student has no subjects', async () => {
    (prisma.studentProfile as any).findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'profile-1' });

    (prisma.submission as any).count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    // No enrolled subjects
    (prisma.subject as any).findMany.mockResolvedValueOnce([]);

    const result = await service.studentCharts('student-user-id');

    expect(result.subjectProgress).toEqual([]);
    // groupBy should NOT be called when there are no subjects
    expect((prisma.submissionTask as any).groupBy).not.toHaveBeenCalled();
    expect((prisma.submission as any).groupBy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6. Unauthenticated access denied
  // -----------------------------------------------------------------------
  it('throws UnauthorizedException for missing userId', async () => {
    await expect(service.studentCharts(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(service.studentCharts('')).rejects.toThrow(UnauthorizedException);
  });
});
