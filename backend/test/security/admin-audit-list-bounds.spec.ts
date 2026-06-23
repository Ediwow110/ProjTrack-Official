import { AdminAuditLogsService } from '../../src/admin/admin-audit-logs.service';

function buildService(overrides: Partial<{
  auditLog: { findMany: jest.Mock };
}> = {}) {
  const prisma = {
    auditLog: {
      findMany: overrides.auditLog?.findMany ?? jest.fn().mockResolvedValue([]),
    },
  } as any;

  return new AdminAuditLogsService(prisma);
}

describe('AdminAuditLogsService.auditList', () => {
  it('defaults to bounded result size', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('respects max cap', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 9999);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it('respects explicit take below max', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 50);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('preserves module filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList('Users');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ module: 'Users' }),
        take: 100,
      }),
    );
  });

  it('preserves role filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, 'Admin');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorRole: 'ADMIN' }),
        take: 100,
      }),
    );
  });

  it('supports skip offset', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 20, 40);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 40 }),
    );
  });

  it('supports from date filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, undefined, undefined, '2026-01-01');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('supports to date filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, undefined, undefined, undefined, '2026-06-01');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('orders newest first deterministically with id tie-breaker', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('includes actor with safe select', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ actor: expect.any(Object) }),
      }),
    );
  });

  it('normalizes skip to minimum 0', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 10, -5);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('normalizes take to minimum 1', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 0);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it('passes module All as undefined (no filter)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList('All');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('passes role All as undefined (no filter)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({ auditLog: { findMany } });

    await service.auditList(undefined, 'All');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('returns array result type (backward compatible)', async () => {
    const mockRows = [
      { id: '1', action: 'CREATE', module: 'Users', actorRole: 'ADMIN', createdAt: new Date(), actor: null },
    ];
    const findMany = jest.fn().mockResolvedValue(mockRows);
    const service = buildService({ auditLog: { findMany } });

    const result = await service.auditList();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});
