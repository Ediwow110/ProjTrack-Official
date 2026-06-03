import { SubmissionsService } from '../../src/submissions/submissions.service';
import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      const { service, submissionRepository, auditLogs } = buildSubmissionsService({
        prisma: {
          systemSetting: {
            findFirst: jest.fn().mockResolvedValue({
              classroomActivityEmailsEnabled: true,
              classroomActivitySystemNotificationsEnabled: true,
            }),
          },
        },
      });

      const mockSubmission = {
        id: 'sub-1',
        title: 'Test Submission',
        status: 'SUBMITTED',
        studentId: 'student-1',
        subject: { id: 'subj-1', teacherId: 'teacher-1' },
        group: null,
      };

      submissionRepository.findSubmissionById.mockResolvedValue(mockSubmission);
      submissionRepository.reviewSubmission.mockResolvedValue(mockSubmission);

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

      const recorded = auditLogs.record.mock.calls[0][0];
      const sensitiveKeys = ['password', 'token', 'secret', 'resetToken', 'activationToken', 'raw', 'authorization', 'cookie'];
      for (const key of sensitiveKeys) {
        expect(recorded).not.toHaveProperty(key);
      }
      if (recorded.details) {
        expect(String(recorded.details)).not.toMatch(/password|token|secret|reset|activation/i);
      }
      if (recorded.afterValue) {
        expect(String(recorded.afterValue)).not.toMatch(/password|token|secret|reset|activation/i);
      }
      if (recorded.beforeValue) {
        expect(String(recorded.beforeValue)).not.toMatch(/password|token|secret|reset|activation/i);
      }
    });

    it('does not record a SUBMISSION_REVIEWED success audit when teacher authorization check fails', async () => {
      const access = {
        requireTeacherCanReviewSubmission: jest.fn().mockRejectedValue(new ForbiddenException('Not allowed to review this submission')),
      } as any;

      const { service, submissionRepository, auditLogs } = buildSubmissionsService({
        access,
        prisma: {
          systemSetting: {
            findFirst: jest.fn().mockResolvedValue({
              classroomActivityEmailsEnabled: true,
              classroomActivitySystemNotificationsEnabled: true,
            }),
          },
        },
      });

      const mockSubmission = {
        id: 'sub-1',
        title: 'Test Submission',
        status: 'SUBMITTED',
        studentId: 'student-1',
        subject: { id: 'subj-1', teacherId: 'teacher-1' },
        group: null,
      };

      submissionRepository.findSubmissionById.mockResolvedValue(mockSubmission);

      await expect(
        service.review('sub-1', {
          status: 'GRADED',
          grade: 85,
          feedback: 'Good work',
          actorUserId: 'unauthorized-teacher',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(auditLogs.record).not.toHaveBeenCalled();
    });
  });
});

describe('admin mutation audit atomicity (SEC-001)', () => {
  const serviceSource = readFileSync(
    join(process.cwd(), 'src', 'admin', 'admin.service.ts'),
    'utf8',
  );

  it('deleteUser audit is written atomically inside the same transaction as the deletion', () => {
    const idx = serviceSource.indexOf('async deleteUser');
    const afterDelete = serviceSource.substring(idx);
    const nextMethod = afterDelete.indexOf('\n  async teachers');
    const body = afterDelete.substring(0, nextMethod > 0 ? nextMethod : undefined);

    // Uses tx.auditLog.create (inside transaction), NOT this.auditLogs.record
    expect(body).toContain('tx.auditLog.create');

    // The old orphaned this.auditLogs.record call after the transaction must be gone.
    // Check that we never see the old pattern: transaction close followed by auditLogs.record with DELETE.
    const txClose = body.indexOf('      await tx.user.delete');
    const afterTx = body.substring(txClose > 0 ? txClose : 0);

    // The phrase this.auditLogs.record should NOT appear after tx.user.delete
    expect(afterTx).not.toContain('this.auditLogs.record');
  });

  it('deactivateUser audit is written atomically inside the same transaction as the deactivation', () => {
    const idx = serviceSource.indexOf('async deactivateUser');
    const afterDeact = serviceSource.substring(idx);
    const nextMethod = afterDeact.indexOf('\n  async sendUserResetLink');
    const body = afterDeact.substring(0, nextMethod > 0 ? nextMethod : undefined);

    // Uses tx.auditLog.create and interactive $transaction
    expect(body).toContain('tx.auditLog.create');
    expect(body).toContain('$transaction(async (tx)');

    // The old batch $transaction([...]) pattern must be gone
    expect(body).not.toContain('$transaction([');
  });
});
