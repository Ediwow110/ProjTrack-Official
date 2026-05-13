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
  };
}

describe('teacher export scope security gate', () => {
  it('routes teacher exports through teacherList with teacherId filters intact', async () => {
    const { service, submissionRepository } = buildSubmissionsService();
    submissionRepository.listTeacherSubmissions.mockResolvedValue([]);

    await expect(
      service.teacherExport({ teacherId: 'teacher-user-1', section: 'Section A', status: 'SUBMITTED', subjectId: 'subject-1' }),
    ).resolves.toMatchObject({ rows: [] });

    expect(submissionRepository.listTeacherSubmissions).toHaveBeenCalledWith({
      teacherId: 'teacher-user-1',
      section: 'Section A',
      status: 'SUBMITTED',
      subjectId: 'subject-1',
    });
  });

  it('does not fetch teacher export rows through an unscoped repository path', async () => {
    const { service, submissionRepository } = buildSubmissionsService();
    submissionRepository.listTeacherSubmissions.mockResolvedValue([
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
    expect(submissionRepository.listTeacherSubmissions).toHaveBeenCalledTimes(1);
  });

  it('keeps section filtering applied after decoration for teacher exports', async () => {
    const { service, submissionRepository, subjectRepository, userRepository } = buildSubmissionsService();
    submissionRepository.listTeacherSubmissions.mockResolvedValue([
      { id: 'submission-1', title: 'A', subjectId: 'subject-1', studentUserId: 'student-a', files: [], events: [] },
      { id: 'submission-2', title: 'B', subjectId: 'subject-1', studentUserId: 'student-b', files: [], events: [] },
    ]);
    subjectRepository.findSubjectById.mockResolvedValue({ id: 'subject-1', name: 'Subject 1' });
    userRepository.findById.mockImplementation(async (id: string) => ({
      id,
      firstName: id === 'student-a' ? 'Student' : 'Other',
      lastName: id === 'student-a' ? 'A' : 'B',
      section: id === 'student-a' ? 'Section A' : 'Section B',
    }));

    const result = await service.teacherExport({ teacherId: 'teacher-user-1', section: 'Section A' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: 'submission-1', section: 'Section A' });
  });
});
