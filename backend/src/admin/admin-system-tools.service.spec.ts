import { ForbiddenException, BadRequestException, HttpException } from '@nestjs/common';
import { AdminSystemToolsService } from './admin-system-tools.service';

function buildMockPrisma() {
  return {
    user: { findMany: jest.fn(), deleteMany: jest.fn() },
    subject: { findMany: jest.fn(), deleteMany: jest.fn() },
    section: { findMany: jest.fn(), deleteMany: jest.fn() },
    academicYear: { findMany: jest.fn(), deleteMany: jest.fn() },
    academicYearLevel: { findMany: jest.fn(), deleteMany: jest.fn() },
    group: { findMany: jest.fn(), deleteMany: jest.fn() },
    submission: { findMany: jest.fn(), deleteMany: jest.fn() },
    notification: { findMany: jest.fn(), deleteMany: jest.fn() },
    emailJob: { findMany: jest.fn(), deleteMany: jest.fn() },
    department: { findMany: jest.fn(), deleteMany: jest.fn() },
    announcement: { findMany: jest.fn(), deleteMany: jest.fn() },
    request: { findMany: jest.fn(), deleteMany: jest.fn() },
    authSession: { findMany: jest.fn(), deleteMany: jest.fn() },
    accountActionToken: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { findMany: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
    authRateLimit: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    submissionEvent: { deleteMany: jest.fn() },
    submissionFile: { deleteMany: jest.fn() },
    groupMember: { deleteMany: jest.fn() },
    enrollment: { deleteMany: jest.fn() },
    subjectSection: { deleteMany: jest.fn() },
    submissionTask: { deleteMany: jest.fn() },
    studentProfile: { deleteMany: jest.fn() },
    teacherProfile: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

function buildMockSystemToolsRepository() {
  return {
    getSystemTools: jest.fn(),
    runSystemTool: jest.fn(),
  };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildMockNotifications() {
  return { createInAppNotification: jest.fn() };
}

function buildMockFiles() {
  return { removeStorageObjectOnly: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const systemToolsRepository = overrides?.systemToolsRepository ?? buildMockSystemToolsRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  const notifications = overrides?.notifications ?? buildMockNotifications();
  const files = overrides?.files ?? buildMockFiles();
  return new AdminSystemToolsService(
    prisma,
    systemToolsRepository as any,
    auditLogs as any,
    notifications as any,
    files as any,
  );
}

describe('AdminSystemToolsService', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
    delete process.env.ALLOW_SEED_DATA_CLEANUP;
    delete process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS;
    delete process.env.ADMIN_SYSTEM_TOOL_MAX_PER_HOUR;
  });

  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('getSystemTools', () => {
    it('returns tools from repository when seed-cleanup is already present', async () => {
      const systemToolsRepository = buildMockSystemToolsRepository();
      systemToolsRepository.getSystemTools.mockResolvedValue([
        { id: 'seed-cleanup', title: 'Seed Data Cleanup' },
        { id: 'other-tool', title: 'Other Tool' },
      ]);
      const service = buildService({ systemToolsRepository });

      const result = await service.getSystemTools();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('seed-cleanup');
    });

    it('appends seed-cleanup tool record when not present', async () => {
      const systemToolsRepository = buildMockSystemToolsRepository();
      systemToolsRepository.getSystemTools.mockResolvedValue([
        { id: 'other-tool', title: 'Other Tool' },
      ]);
      const service = buildService({ systemToolsRepository });

      const result = await service.getSystemTools();
      expect(result).toHaveLength(2);
      expect(result[1].id).toBe('seed-cleanup');
      expect(result[1].title).toBe('Seed Data Cleanup');
    });
  });

  describe('runSystemTool', () => {
    it('delegates non-seed-cleanup tools to systemToolsRepository', async () => {
      process.env.ADMIN_SYSTEM_TOOL_MAX_PER_HOUR = '100';

      const prisma = buildMockPrisma();
      prisma.authRateLimit.findUnique.mockResolvedValue(null);
      prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 1 } as any);

      const systemToolsRepository = buildMockSystemToolsRepository();
      systemToolsRepository.runSystemTool.mockResolvedValue({
        result: { title: 'Other Tool', status: 'Completed', summary: 'Done.' },
      });

      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, systemToolsRepository, auditLogs });

      const result = await service.runSystemTool('other-tool', {}, {});

      expect(systemToolsRepository.runSystemTool).toHaveBeenCalledWith('other-tool');
      expect(auditLogs.record).toHaveBeenCalled();
      expect(result.result.status).toBe('Completed');
    });

    it('runs seed-cleanup preview mode', async () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'true';

      const prisma = buildMockPrisma();
      // Mock all the findMany calls from buildSeedCleanupPreview
      prisma.user.findMany.mockResolvedValue([]);
      prisma.subject.findMany.mockResolvedValue([]);
      prisma.section.findMany.mockResolvedValue([]);
      prisma.academicYear.findMany.mockResolvedValue([]);
      prisma.academicYearLevel.findMany.mockResolvedValue([]);
      prisma.group.findMany.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.emailJob.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);
      prisma.announcement.findMany.mockResolvedValue([]);
      prisma.request.findMany.mockResolvedValue([]);
      prisma.authRateLimit.findUnique.mockResolvedValue(null);
      prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 1 } as any);

      const systemToolsRepository = buildMockSystemToolsRepository();
      systemToolsRepository.getSystemTools.mockResolvedValue([]);

      const service = buildService({ prisma, systemToolsRepository });

      const result = await service.runSystemTool('seed-cleanup', { mode: 'preview' }, {});

      expect((result.result as any).toolId).toBe('seed-cleanup');
      expect((result.result as any).executed).toBe(false);
      expect((result.result as any).recordsDeleted).toBe(0);
    });

    it('throws ForbiddenException when seed-cleanup disabled', async () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'false';

      const prisma = buildMockPrisma();
      prisma.user.findMany.mockResolvedValue([]);
      prisma.subject.findMany.mockResolvedValue([]);
      prisma.section.findMany.mockResolvedValue([]);
      prisma.academicYear.findMany.mockResolvedValue([]);
      prisma.academicYearLevel.findMany.mockResolvedValue([]);
      prisma.group.findMany.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.emailJob.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);
      prisma.announcement.findMany.mockResolvedValue([]);
      prisma.request.findMany.mockResolvedValue([]);
      prisma.authRateLimit.findUnique.mockResolvedValue(null);
      prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 1 } as any);

      const systemToolsRepository = buildMockSystemToolsRepository();
      systemToolsRepository.getSystemTools.mockResolvedValue([]);

      const service = buildService({ prisma, systemToolsRepository });

      await expect(
        service.runSystemTool('seed-cleanup', { mode: 'execute' }, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('isProductionRuntime', () => {
    it('returns true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const service = buildService();
      expect((service as any).isProductionRuntime()).toBe(true);
    });

    it('returns true when APP_ENV is production', () => {
      process.env.APP_ENV = 'production';
      const service = buildService();
      expect((service as any).isProductionRuntime()).toBe(true);
    });

    it('returns false in non-production environments', () => {
      const service = buildService();
      expect((service as any).isProductionRuntime()).toBe(false);
    });
  });

  describe('allowSeedCleanup', () => {
    it('returns true when ALLOW_SEED_DATA_CLEANUP is true', () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'true';
      const service = buildService();
      expect((service as any).allowSeedCleanup()).toBe(true);
    });

    it('returns false when ALLOW_SEED_DATA_CLEANUP is not true', () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'false';
      const service = buildService();
      expect((service as any).allowSeedCleanup()).toBe(false);
    });
  });

  describe('allowProductionAdminToolRuns', () => {
    it('returns true when ALLOW_PRODUCTION_ADMIN_TOOL_RUNS is true', () => {
      process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS = 'true';
      const service = buildService();
      expect((service as any).allowProductionAdminToolRuns()).toBe(true);
    });

    it('returns false when ALLOW_PRODUCTION_ADMIN_TOOL_RUNS is not true', () => {
      const service = buildService();
      expect((service as any).allowProductionAdminToolRuns()).toBe(false);
    });
  });

  describe('buildSeedCleanupToolRecord', () => {
    it('returns Disabled status when cleanup flag is false', () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'false';
      const service = buildService();
      const record = (service as any).buildSeedCleanupToolRecord();
      expect(record.status).toBe('Disabled');
    });

    it('returns Production locked in production without override', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_SEED_DATA_CLEANUP = 'true';
      process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS = 'false';
      const service = buildService();
      const record = (service as any).buildSeedCleanupToolRecord();
      expect(record.status).toBe('Production locked');
    });

    it('returns Guarded when enabled and not production', () => {
      process.env.ALLOW_SEED_DATA_CLEANUP = 'true';
      const service = buildService();
      const record = (service as any).buildSeedCleanupToolRecord();
      expect(record.status).toBe('Guarded');
    });

    it('returns Guarded when enabled in production with override', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_SEED_DATA_CLEANUP = 'true';
      process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS = 'true';
      const service = buildService();
      const record = (service as any).buildSeedCleanupToolRecord();
      expect(record.status).toBe('Guarded');
    });
  });

  describe('isSeedEmailAddress', () => {
    it('returns false for protected admin email', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('admin@projtrack.codes')).toBe(false);
    });

    it('returns true for projtrack.local domain', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('test@projtrack.local')).toBe(true);
    });

    it('returns true for .test domains', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('user@school.test')).toBe(true);
    });

    it('returns true for .example domains', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('user@demo.example')).toBe(true);
    });

    it('returns true for seed/demo/test/sample prefixed local parts', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('seed-user@school.edu')).toBe(true);
      expect((service as any).isSeedEmailAddress('demo_user@school.edu')).toBe(true);
      expect((service as any).isSeedEmailAddress('test.user@school.edu')).toBe(true);
    });

    it('returns false for regular emails', () => {
      const service = buildService();
      expect((service as any).isSeedEmailAddress('john.doe@school.edu')).toBe(false);
    });
  });

  describe('isSeedLabel', () => {
    it('returns true for labels containing seed/demo/test/sample', () => {
      const service = buildService();
      expect((service as any).isSeedLabel('Section A - demo')).toBe(true);
      expect((service as any).isSeedLabel('test subject')).toBe(true);
      expect((service as any).isSeedLabel('sample_data')).toBe(true);
    });

    it('returns false for regular labels', () => {
      const service = buildService();
      expect((service as any).isSeedLabel('Mathematics')).toBe(false);
      expect((service as any).isSeedLabel('Physics 101')).toBe(false);
    });
  });

  describe('toTitleWords', () => {
    it('converts snake_case to Title Case', () => {
      const service = buildService();
      expect((service as any).toTitleWords('seed_data_cleanup')).toBe('Seed Data Cleanup');
    });

    it('handles empty string', () => {
      const service = buildService();
      expect((service as any).toTitleWords('')).toBe('');
    });
  });

  describe('seedCleanupCountEntries', () => {
    it('returns ordered entries with counts', () => {
      const service = buildService();
      const result = (service as any).seedCleanupCountEntries({ users: 5, subjects: 3 });
      const usersEntry = result.find(([key]: [string]) => key === 'users');
      const subjectsEntry = result.find(([key]: [string]) => key === 'subjects');
      expect(usersEntry[1]).toBe(5);
      expect(subjectsEntry[1]).toBe(3);
      expect(result.find(([key]: [string]) => key === 'departments')[1]).toBe(0);
    });
  });

  describe('assertAdminRateLimit', () => {
    it('passes when no existing rate limit record', async () => {
      const prisma = buildMockPrisma();
      prisma.authRateLimit.findUnique.mockResolvedValue(null);
      prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 1 } as any);

      const service = buildService({ prisma });
      await expect(
        (service as any).assertAdminRateLimit('test-action', {}, 'test-key'),
      ).resolves.toBeUndefined();
      expect(prisma.authRateLimit.upsert).toHaveBeenCalled();
    });

    it('throws HttpException when blocked', async () => {
      const prisma = buildMockPrisma();
      const future = new Date(Date.now() + 60000);
      prisma.authRateLimit.findUnique.mockResolvedValue({
        blockedUntil: future,
        firstAttemptAt: new Date(),
        attempts: 100,
      });

      const service = buildService({ prisma });
      await expect(
        (service as any).assertAdminRateLimit('test-action', {}, 'test-key'),
      ).rejects.toThrow(HttpException);
    });

    it('resets window when expired', async () => {
      const prisma = buildMockPrisma();
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      prisma.authRateLimit.findUnique.mockResolvedValue({
        firstAttemptAt: past,
        attempts: 50,
        blockedUntil: null,
      });
      prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 1 } as any);

      const service = buildService({ prisma });
      await expect(
        (service as any).assertAdminRateLimit('test-action', {}, 'test-key'),
      ).resolves.toBeUndefined();
    });
  });
});
