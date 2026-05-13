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
  it('documents current blocker: student submission list is not paginated yet', async () => {
    const { repo, prisma } = buildRepository();

    await repo.listStudentSubmissions('student-user-1');

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
  });

  it('documents current blocker: teacher task pre-query is not bounded yet', async () => {
    const { repo, prisma } = buildRepository();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'teacher-profile-1' });

    await repo.listTeacherSubmissions({ teacherId: 'teacher-user-1' });

    expect(prisma.submissionTask.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
  });

  it('documents current blocker: teacher submission list is not paginated yet', async () => {
    const { repo, prisma } = buildRepository();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'teacher-profile-1' });

    await repo.listTeacherSubmissions({ teacherId: 'teacher-user-1' });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
  });
});
