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
    prisma.submission.findMany.mockResolvedValue([]);

    const result = await service.studentList('student-user-1');

    expect(result).toHaveLength(0);
    expect(submissionRepository.listStudentSubmissions).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 0 }));
  });

  it('uses custom pagination parameters for student list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.submission.findMany.mockResolvedValue([]);

    await service.studentList('student-user-1', undefined, { take: 20, skip: 5 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20, skip: 5 }));
  });

  it('clamps take to max size (100) for student list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.submission.findMany.mockResolvedValue([]);

    await service.studentList('student-user-1', undefined, { take: 9999, skip: 10 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 10 }));
  });

  it('clamps invalid/negative pagination values to defaults/bounds for student list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.submission.findMany.mockResolvedValue([]);

    await service.studentList('student-user-1', undefined, { take: -50, skip: -10 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1, skip: 0 }));
  });

  it('uses bounded database query for teacher submission lists', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    const result = await service.teacherList({ teacherId: 'teacher-user-1' });

    expect(result).toHaveLength(0);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 0 }));
  });

  it('uses custom pagination parameters for teacher list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    await service.teacherList({ teacherId: 'teacher-user-1' }, { take: 50, skip: 15 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50, skip: 15 }));
  });

  it('clamps take to max size (100) for teacher list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    await service.teacherList({ teacherId: 'teacher-user-1' }, { take: 1500, skip: 20 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 20 }));
  });

  it('clamps invalid/negative pagination values to defaults/bounds for teacher list', async () => {
    const { service, prisma } = buildSubmissionsService();
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-1' });
    prisma.submission.findMany.mockResolvedValue([]);

    await service.teacherList({ teacherId: 'teacher-user-1' }, { take: -100, skip: -5 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1, skip: 0 }));
  });
});
