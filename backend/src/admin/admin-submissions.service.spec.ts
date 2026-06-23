import { AdminSubmissionsService } from './admin-submissions.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  const mock: any = {
    submission: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    submissionTask: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    group: { findUnique: jest.fn() },
    authRateLimit: { deleteMany: jest.fn(), upsert: jest.fn().mockResolvedValue({ attempts: 1 }) },
    submissionFile: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  return mock as PrismaService;
}

function buildMockSubmissionRepository() {
  return { saveSubmissionNote: jest.fn() };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildMockFiles() {
  return { remove: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const submissionRepository = overrides?.submissionRepository ?? buildMockSubmissionRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  const files = overrides?.files ?? buildMockFiles();
  return new AdminSubmissionsService(prisma, submissionRepository as any, auditLogs as any, files as any);
}

describe('AdminSubmissionsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('submissions', () => {
    it('returns mapped submissions', async () => {
      const prisma = buildMockPrisma();
      (prisma.submission.findMany as jest.Mock).mockResolvedValue([
        { id: 'sub1', title: 'Homework', status: 'SUBMITTED', createdAt: new Date(), submittedAt: new Date(), externalLinks: [], feedback: null, notes: null, grade: null, taskId: 't1', subjectId: 'sj1', studentId: 'u1', groupId: null, task: { deadline: new Date(), title: 'HW1' }, subject: { name: 'Math', code: 'MATH101', teacher: null }, student: { firstName: 'John', lastName: 'Doe', studentProfile: { studentNumber: 'S001', section: { name: 'A' } } }, group: null },
      ]);
      const service = buildService({ prisma });
      const result = await service.submissions();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Homework');
    });
  });

  describe('createSubmission', () => {
    it('throws when required fields missing', async () => {
      const service = buildService();
      await expect(service.createSubmission({})).rejects.toThrow('Submission status is required.');
    });

    it('throws when task not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.createSubmission({ taskId: 't1', subjectId: 'sj1', title: 'Test', status: 'SUBMITTED', studentId: 'u1' })).rejects.toThrow('Submission task not found.');
    });

    it('creates submission successfully', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findUnique as jest.Mock).mockResolvedValue({ id: 't1', subjectId: 'sj1' });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1', firstName: 'John', lastName: 'Doe' });
      (prisma.submission.create as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'SUBMITTED' });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });
      const result = await service.createSubmission({ taskId: 't1', subjectId: 'sj1', title: 'Test', status: 'SUBMITTED', studentId: 'u1' });
      expect(result.success).toBe(true);
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('updateSubmission', () => {
    it('throws when not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.submission.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.updateSubmission('bad', {})).rejects.toThrow('Submission not found.');
    });
  });

  describe('submissionDetail', () => {
    it('throws when not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.submission.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.submissionDetail('bad')).rejects.toThrow('Submission not found.');
    });
  });

  describe('saveSubmissionNote', () => {
    it('saves note and logs audit', async () => {
      const submissionRepository = buildMockSubmissionRepository();
      (submissionRepository.saveSubmissionNote as jest.Mock).mockResolvedValue({ id: 'sub1', title: 'Test', notes: 'Admin note' });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ submissionRepository, auditLogs });
      const result = await service.saveSubmissionNote('sub1', 'Admin note');
      expect(result.success).toBe(true);
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('normalizeSubmissionStatusInput converts to uppercase', () => {
      const service = buildService();
      expect((service as any).normalizeSubmissionStatusInput('pending review')).toBe('PENDING_REVIEW');
    });

    it('parseOptionalGrade rejects negative numbers', () => {
      const service = buildService();
      expect(() => (service as any).parseOptionalGrade(-1)).toThrow('Grade must be a valid non-negative number.');
    });

    it('isUniqueConstraintError detects P2002', () => {
      const service = buildService();
      expect((service as any).isUniqueConstraintError({ code: 'P2002' })).toBe(true);
    });
  });
});
