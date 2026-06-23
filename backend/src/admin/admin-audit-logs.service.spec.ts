import { AdminAuditLogsService } from './admin-audit-logs.service';

function buildMockPrisma() {
  return {
    auditLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  return new AdminAuditLogsService(prisma);
}

const mockAuditLogRow = {
  id: 'log-1',
  action: 'CREATE',
  module: 'Users',
  actorRole: 'ADMIN',
  actorUserId: 'actor-1',
  target: 'Test User',
  entityId: 'user-1',
  result: 'Success',
  details: 'Created user.',
  createdAt: new Date('2025-01-15T10:00:00Z'),
  updatedAt: new Date('2025-01-15T10:00:00Z'),
  beforeValue: null,
  afterValue: 'PENDING_ACTIVATION',
  ipAddress: '127.0.0.1',
  requestId: 'req-1',
  actor: { id: 'actor-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
};

describe('AdminAuditLogsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('auditList', () => {
    it('returns paginated audit logs ordered by newest first', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLogRow]);
      const service = buildService({ prisma });

      const result = await service.auditList();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
          skip: 0,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('log-1');
    });

    it('clamps take between 1 and 500', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([]);
      const service = buildService({ prisma });

      await service.auditList(undefined, undefined, 1000);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );

      await service.auditList(undefined, undefined, 0);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('filters by module when not "All"', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([]);
      const service = buildService({ prisma });

      await service.auditList('Users');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: 'Users' }),
        }),
      );
    });

    it('omits module filter when module is "All"', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([]);
      const service = buildService({ prisma });

      await service.auditList('All');
      const callArg = prisma.auditLog.findMany.mock.calls[0][0];
      expect(callArg.where.module).toBeUndefined();
    });

    it('normalizes role to uppercase', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([]);
      const service = buildService({ prisma });

      await service.auditList(undefined, 'admin');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorRole: 'ADMIN' }),
        }),
      );
    });

    it('applies date range filters', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([]);
      const service = buildService({ prisma });

      await service.auditList(undefined, undefined, undefined, undefined, '2025-01-01', '2025-01-31');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
          }),
        }),
      );
    });

    it('uses SAFE_USER_SELECT for actor include', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLogRow]);
      const service = buildService({ prisma });

      await service.auditList();
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { actor: { select: expect.any(Object) } },
        }),
      );
    });
  });

  describe('auditDetail', () => {
    it('returns audit log when found', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findUnique.mockResolvedValue(mockAuditLogRow);
      const service = buildService({ prisma });

      const result = await service.auditDetail('log-1');
      expect(result).toEqual(mockAuditLogRow);
      expect(prisma.auditLog.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'log-1' } }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      const prisma = buildMockPrisma();
      prisma.auditLog.findUnique.mockResolvedValue(null);
      const service = buildService({ prisma });

      await expect(service.auditDetail('bad-id')).rejects.toThrow('Audit log not found.');
    });
  });
});
