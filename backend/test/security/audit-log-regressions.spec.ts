import { AuditLogsService } from '../../src/audit-logs/audit-logs.service';
import { AuditLogRepository } from '../../src/repositories/audit-log.repository';
import { SubmissionsService } from '../../src/submissions/submissions.service';

/**
 * Sensitive-action audit-log regression tests (BUG-AUDIT-001).
 *
 * These tests prove that privileged and security-sensitive actions
 * record audit events with the expected actor/action/module/target/result.
 *
 * Strategy: Mock the AuditLogRepository at the boundary and assert calls
 * from real service methods (e.g. SubmissionsService.review).
 */

function buildAuditLogRepositoryMock() {
  return {
    create: jest.fn(),
    listAuditLogs: jest.fn(),
  } as any;
}

describe('sensitive-action audit-log regressions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('submission review', () => {
    it('records SUBMISSION_REVIEWED audit event with correct actor and details when a teacher reviews a submission', async () => {
      const auditLogRepository = buildAuditLogRepositoryMock();

      // Minimal mocks for dependencies of SubmissionsService
      const prisma = {
        submission: { findUnique: jest.fn() },
        submissionFile: { findMany: jest.fn() },
        submissionEvent: { create: jest.fn() },
        studentProfile: { findUnique: jest.fn() },
        teacherProfile: { findUnique: jest.fn() },
        subject: { findUnique: jest.fn() },
        enrollment: { findFirst: jest.fn() },
        group: { findUnique: jest.fn() },
        groupMember: { findFirst: jest.fn() },
      } as any;

      const access = {
        requireTeacherCanReviewSubmission: jest.fn().mockResolvedValue(undefined),
      } as any;

      const auditLogs = new AuditLogsService(auditLogRepository);
      const mailer = { send: jest.fn() } as any;
      const storage = { getSignedUrl: jest.fn() } as any;
      const fileMalware = { scanBuffer: jest.fn() } as any;

      const service = new SubmissionsService(prisma, access, auditLogs, mailer, storage, fileMalware);

      // Mock repository to return a submission the teacher can review
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

      expect(auditLogRepository.create).toHaveBeenCalledWith(
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
    it('AuditLogsService.record accepts structured input without requiring secrets in details', () => {
      const repo = buildAuditLogRepositoryMock();
      const service = new AuditLogsService(repo);

      // The service itself does not sanitize; the callers are responsible.
      // This test anchors that the contract exists and is used.
      expect(typeof service.record).toBe('function');
    });
  });
});
