import { SubmissionsService } from '../../src/submissions/submissions.service';

function buildSubmissionsService() {
  const submissionRepository = {
    listStudentSubmissions: jest.fn(async () => []),
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
    prisma,
  };
}

describe('submission list response bounds', () => {
  it('uses bounded database query for student submission lists', async () => {
    const { service, submissionRepository, prisma } = buildSubmissionsService();
    prisma.submission.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        id: `submission-${index}`,
        title: `Submission ${index}`,
        subjectId: 'subject-1',
        files: [],
        events: [],
      })),
    );

    const result = await service.studentList('student-user-1');

    expect(result).toHaveLength(100);
    expect(submissionRepository.listStudentSubmissions).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });
});
