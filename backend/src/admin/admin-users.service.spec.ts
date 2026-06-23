import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  const mock: any = {
    user: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    emailJob: { findMany: jest.fn() },
    submission: { findMany: jest.fn(), count: jest.fn() },
    subject: { findMany: jest.fn() },
    authRateLimit: { deleteMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  return mock as PrismaService;
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildMockMail() {
  return { queueAccountActivation: jest.fn(), queuePasswordReset: jest.fn() };
}

function buildMockAccountActionTokens() {
  return { issueActivation: jest.fn(), issuePasswordReset: jest.fn() };
}

function buildMockNotifications() {
  return { createInAppNotification: jest.fn() };
}

function buildMockAdminOpsRepository() {
  return { resolveSectionPlacement: jest.fn(), ensureDepartmentName: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  const mail = overrides?.mail ?? buildMockMail();
  const accountActionTokens = overrides?.accountActionTokens ?? buildMockAccountActionTokens();
  const notifications = overrides?.notifications ?? buildMockNotifications();
  const adminOpsRepository = overrides?.adminOpsRepository ?? buildMockAdminOpsRepository();
  const files = overrides?.files ?? {};
  return new AdminUsersService(prisma, auditLogs as any, mail as any, accountActionTokens as any, notifications as any, adminOpsRepository as any, files as any);
}

describe('AdminUsersService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('normalizeSearch', () => {
    it('returns empty string for undefined/empty input', () => {
      const service = buildService();
      expect((service as any).normalizeSearch()).toBe('');
      expect((service as any).normalizeSearch('')).toBe('');
      expect((service as any).normalizeSearch('   ')).toBe('');
    });

    it('returns lowered trimmed string for valid input', () => {
      const service = buildService();
      expect((service as any).normalizeSearch('Hello World')).toBe('hello world');
    });

    it('returns empty string for invalid characters', () => {
      const service = buildService();
      expect((service as any).normalizeSearch('<script>')).toBe('');
    });

    it('returns empty string for too-long input', () => {
      const service = buildService();
      expect((service as any).normalizeSearch('a'.repeat(101))).toBe('');
    });
  });

  describe('formatUserStatus', () => {
    it('maps known statuses to display labels', () => {
      const service = buildService();
      expect((service as any).formatUserStatus('ACTIVE')).toBe('Active');
      expect((service as any).formatUserStatus('PENDING_SETUP')).toBe('Pending Setup');
      expect((service as any).formatUserStatus('INACTIVE')).toBe('Inactive');
    });

    it('returns raw status for unknown values', () => {
      const service = buildService();
      expect((service as any).formatUserStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });
  });

  describe('userName', () => {
    it('returns full name when both names present', () => {
      const service = buildService();
      expect((service as any).userName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
    });

    it('returns email when no names', () => {
      const service = buildService();
      expect((service as any).userName({ email: 'user@test.com' })).toBe('user@test.com');
    });

    it('returns Unknown for null user', () => {
      const service = buildService();
      expect((service as any).userName(null)).toBe('Unknown');
    });
  });

  describe('requireUser', () => {
    it('throws NotFoundException when user not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect((service as any).requireUser('bad-id', 'TEACHER')).rejects.toThrow('User not found.');
    });

    it('throws NotFoundException when role does not match', async () => {
      const prisma = buildMockPrisma();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: 'STUDENT' });
      const service = buildService({ prisma });
      await expect((service as any).requireUser('u1', 'TEACHER')).rejects.toThrow('TEACHER not found.');
    });

    it('returns user when role matches', async () => {
      const prisma = buildMockPrisma();
      const user = { id: 'u1', role: 'TEACHER' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      const service = buildService({ prisma });
      await expect((service as any).requireUser('u1', 'TEACHER')).resolves.toEqual(user);
    });
  });
});
