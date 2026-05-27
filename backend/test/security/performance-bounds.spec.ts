import { SubmissionRepository } from '../../src/repositories/submission.repository';

function buildRepository() {
  const prisma = {
    teacherProfile: { findUnique: jest.fn() },
    submissionTask: { findMany: jest.fn(async () => []) },
    submission: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  return { repo: new SubmissionRepository(prisma), prisma };
}

describe('performance bounds gate', () => {
  it('verified: student submission list is paginated (take is present)', async () => {
    const { repo, prisma } = buildRepository();

    await repo.listStudentSubmissions('student-user-1');

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });

  it('verified: teacher submission list uses single paginated query (no separate unbounded task pre-query)', async () => {
    const { repo, prisma } = buildRepository();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'teacher-profile-1' });

    await repo.listTeacherSubmissions({ teacherId: 'teacher-user-1' });

    // Teacher submission list was refactored into a single paginated submission.findMany call
    expect(prisma.submissionTask.findMany).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });

  it('verified: teacher submission list is paginated (take is present)', async () => {
    const { repo, prisma } = buildRepository();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'teacher-profile-1' });

    await repo.listTeacherSubmissions({ teacherId: 'teacher-user-1' });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });
});
