import { SubmissionsService } from '../../src/submissions/submissions.service';

function buildSubmissionsService() {
  const submissionRepository = {
    listTeacherSubmissions: jest.fn(async () => []),
    findSubmissionById: jest.fn(),
  } as any;
  const subjectRepository = {
    findSubjectById: jest.fn(),
    findActivityById: jest.fn(),
    listGroupsBySubject: jest.fn(async () => []),
  } as any;
  const userRepository = { findById: jest.fn() } as any;
  const notificationRepository = { create: jest.fn() } as any;
  const auditLogs = { record: jest.fn() } as any;
  const filesService = { resolvePendingUploadsForSubmission: jest.fn() } as any;
  const mailService = { queueTransactional: jest.fn() } as any;
  const prisma = {
    submission: { findMany: jest.fn(async () => []) },
    teacherProfile: { findUnique: jest.fn() },
    systemSetting: { findFirst: jest.fn() },
    submissionEvent: { create: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    group: { findFirst: jest.fn() },
  } as any;
  const access = {
    requireTeacherCanReviewSubmission: jest.fn(),
    requireStudentEnrolledInSubject: jest.fn(),
  } as any;

  return {
    service: new SubmissionsService(
      submissionRepository,
      subjectRepository,
      userRepository,
      notificationRepository,
      auditLogs,
      filesService,
      mailService,
      prisma,
      access,
    ),
    submissionRepository,
    subjectRepository,
    userRepository,
    prisma,
  };
}

describe('teacher export scope security gate', () => {
  it('uses bounded teacher-scoped database query for teacher exports', async () => {
    const { service, submissionRepository, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    await expect(
      service.teacherExport({ teacherId: 'teacher-user-1', section: 'Section A', status: 'SUBMITTED', subjectId: 'subject-1' }),
    ).resolves.toMatchObject({ rows: [] });

    expect(submissionRepository.listTeacherSubmissions).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1001 }));
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SUBMITTED',
          subjectId: 'subject-1',
          task: { subject: { teacherId: 'teacher-profile-1' } },
        }),
      }),
    );
  });

  it('does not fetch teacher export rows through an unscoped repository path', async () => {
    const { service, submissionRepository, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([
      {
        id: 'submission-1',
        title: 'Scoped submission',
        subjectId: 'subject-1',
        studentUserId: 'student-1',
        files: [],
        events: [],
      },
    ]);

    await service.teacherExport({ teacherId: 'teacher-user-1' });

    expect(submissionRepository.findSubmissionById).not.toHaveBeenCalled();
    expect(submissionRepository.listTeacherSubmissions).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps section filtering applied for teacher exports at the query boundary', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    await service.teacherExport({ teacherId: 'teacher-user-1', section: 'Section A' });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('caps teacher exports and returns truncation metadata', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        id: `submission-${index}`,
        title: `Submission ${index}`,
        subjectId: 'subject-1',
        studentUserId: undefined,
        studentId: undefined,
        student: null,
        files: [],
        events: [],
      })),
    );

    const result = await service.teacherExport({ teacherId: 'teacher-user-1' });

    expect(result.rows).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    expect(result.maxRows).toBe(1000);
  });

  it('uses bounded teacher list database query', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        id: `submission-${index}`,
        title: `Submission ${index}`,
        subjectId: 'subject-1',
        files: [],
        events: [],
      })),
    );

    const result = await service.teacherList({ teacherId: 'teacher-user-1' });

    expect(result).toHaveLength(100);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});
