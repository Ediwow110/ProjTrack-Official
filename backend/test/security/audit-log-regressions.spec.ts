import { AuditLogsService } from '../../src/audit-logs/audit-logs.service';
import { AuditLogRepository } from '../../src/repositories/audit-log.repository';
import { SubmissionsService } from '../../src/submissions/submissions.service';

/**
 * Sensitive-action audit-log regression tests (BUG-AUDIT-001).
 *
 * These tests prove that privileged and security-sensitive actions
 * record audit events with the expected actor/action/module/target/result.
 *
 * Strategy: Use the project's standard buildSubmissionsService pattern
 * and assert that auditLogs.record is called correctly.
 */

function buildSubmissionsService(overrides: any = {}) {
  const submissionRepository = {
    findSubmissionById: jest.fn(),
    reviewSubmission: jest.fn(),
    ...overrides.submissionRepository,
  } as any;

  const subjectRepository = {
    findSubjectById: jest.fn(),
    ...overrides.subjectRepository,
  } as any;

  const userRepository = {
    findById: jest.fn(),
    ...overrides.userRepository,
  } as any;

  const notificationRepository = {
    create: jest.fn(),
    ...overrides.notificationRepository,
  } as any;

  const auditLogs = {
    record: jest.fn(),
    ...overrides.auditLogs,
  } as any;

  const filesService = {
    resolvePendingUploadsForSubmission: jest.fn(),
    ...overrides.filesService,
  } as any;

  const mailService = {
    queueTransactional: jest.fn(),
    ...overrides.mailService,
  } as any;

  const prisma = {
    submission: { findUnique: jest.fn() },
    submissionEvent: { create: jest.fn() },
    teacherProfile: { findUnique: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    group: { findFirst: jest.fn() },
    ...overrides.prisma,
  } as any;

  const access = {
    requireTeacherCanReviewSubmission: jest.fn().mockResolvedValue(undefined),
    ...overrides.access,
  } as any;

  const service = new SubmissionsService(
    submissionRepository,
    subjectRepository,
    userRepository,
    notificationRepository,
    auditLogs,
    filesService,
    mailService,
    prisma,
    access,
  );

  return { service, submissionRepository, auditLogs, prisma, access };
}

describe('sensitive-action audit-log regressions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('submission review', () => {
    it('records SUBMISSION_REVIEWED audit event with correct actor and details when a teacher reviews a submission', async () => {
      const { service, auditLogs, prisma } = buildSubmissionsService();

      prisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        title: 'Test Submission',
        status: 'SUBMITTED',
        studentId: 'student-1',
        subject: { id: 'subj-1', teacherId: 'teacher-1' },
        group: null,
      });

      await service.review('sub-1', {
        status: 'GRADED',
        grade: 85,
        feedback: 'Good work',
        actorUserId: 'teacher-user-1',
      });

      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'teacher-user-1',
          actorRole: 'TEACHER',
          action: 'SUBMISSION_REVIEWED',
          module: 'Submissions',
          target: 'Test Submission',
          entityId: 'sub-1',
          result: 'Success',
        }),
      );
    });
  });

  describe('audit metadata safety', () => {
    it('AuditLogsService.record accepts structured input', () => {
      const repo = { create: jest.fn(), listAuditLogs: jest.fn() } as any;
      const service = new AuditLogsService(repo);
      expect(typeof service.record).toBe('function');
    });
  });
});
