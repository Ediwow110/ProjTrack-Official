import { AdminSubjectsService } from './admin-subjects.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  const mock: any = {
    subject: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
    teacherProfile: { findFirst: jest.fn() },
    section: { findMany: jest.fn() },
    subjectSection: { createMany: jest.fn(), deleteMany: jest.fn() },
    enrollment: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  return mock as PrismaService;
}

function buildMockSettingsRepository() {
  return { getAcademicSettings: jest.fn() };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const settingsRepository = overrides?.settingsRepository ?? buildMockSettingsRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminSubjectsService(prisma, settingsRepository as any, auditLogs as any);
}

describe('AdminSubjectsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('subjects', () => {
    it('returns mapped subjects with search filtering', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', code: 'MATH101', name: 'Mathematics', status: 'ACTIVE', isOpen: true, tasks: [], enrollments: [], teacher: null },
      ]);
      (prisma.subject.count as jest.Mock).mockResolvedValue(1);
      const service = buildService({ prisma });
      const result = await service.subjects();
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.rows[0].code).toBe('MATH101');
    });
  });

  describe('createSubject', () => {
    it('throws when code is missing', async () => {
      const service = buildService();
      await expect(service.createSubject({ code: '', name: 'Test' })).rejects.toThrow('Subject code and subject name are required.');
    });

    it('throws on duplicate code', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });
      const service = buildService({ prisma });
      await expect(service.createSubject({ code: 'MATH101', name: 'Math' })).rejects.toThrow('That subject code already exists.');
    });

    it('creates subject successfully', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.teacherProfile.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.subject.create as jest.Mock).mockResolvedValue({ id: 's1' });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });
      const result = await service.createSubject({ code: 'MATH101', name: 'Mathematics' });
      expect(result.success).toBe(true);
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('updateSubject', () => {
    it('throws when subject not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.updateSubject('bad-id', {})).rejects.toThrow('Subject not found.');
    });

    it('updates subject successfully', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue({ id: 's1', code: 'MATH101', name: 'Math', status: 'ACTIVE', groupEnabled: true, allowLateSubmission: true });
      (prisma.subject.findFirst as jest.Mock).mockResolvedValue(null);
      const tx = { subject: { update: jest.fn() }, subjectSection: { deleteMany: jest.fn(), createMany: jest.fn() } };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });
      const result = await service.updateSubject('s1', { name: 'Advanced Math' });
      expect(result.success).toBe(true);
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('subjectDetail', () => {
    it('throws when subject not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.subjectDetail('bad-id')).rejects.toThrow('Subject not found.');
    });

    it('returns formatted detail', async () => {
      const prisma = buildMockPrisma();
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue({
        id: 's1', code: 'MATH101', name: 'Mathematics', status: 'ACTIVE', isOpen: true, groupEnabled: true, allowLateSubmission: true, teacher: null, tasks: [], enrollments: [],
      });
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.getAcademicSettings as jest.Mock).mockResolvedValue({ schoolYear: '2024-2025', semester: '1st' });
      const service = buildService({ prisma, settingsRepository });
      const result = await service.subjectDetail('s1');
      expect(result.code).toBe('MATH101');
      expect(result.term).toContain('2024-2025');
    });
  });

  describe('formatSubjectStatus', () => {
    it('converts status to title words', () => {
      const service = buildService();
      expect((service as any).formatSubjectStatus('PENDING_ACTIVATION')).toBe('Pending Activation');
    });

    it('falls back to isOpen when status is null', () => {
      const service = buildService();
      expect((service as any).formatSubjectStatus(null, true)).toBe('Active');
      expect((service as any).formatSubjectStatus(null, false)).toBe('Closed');
    });
  });
});
