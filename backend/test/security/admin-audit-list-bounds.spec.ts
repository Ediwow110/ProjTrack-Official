import { AdminService } from '../../src/admin/admin.service';

function buildAdminService(overrides: Partial<{
  auditLog: { findMany: jest.Mock };
}> = {}) {
  const prisma = {
    auditLog: {
      findMany: overrides.auditLog?.findMany ?? jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(prisma)),
    user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(2) },
    subject: { findMany: jest.fn().mockResolvedValue([]) },
    group: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    groupMember: { delete: jest.fn(), updateMany: jest.fn() },
    notification: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    submission: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    submissionTask: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    announcement: { findMany: jest.fn().mockResolvedValue([]) },
    emailJob: { findMany: jest.fn().mockResolvedValue([]) },
    academicSetting: { findMany: jest.fn().mockResolvedValue([]) },
    systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
    systemTool: { findMany: jest.fn().mockResolvedValue([]) },
    section: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    teacherProfile: { findMany: jest.fn().mockResolvedValue([]) },
    studentProfile: { findUnique: jest.fn() },
    academicYear: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), findUnique: jest.fn() },
    academicYearLevel: { findMany: jest.fn().mockResolvedValue([]) },
    authRateLimit: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    authSession: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    accountActionToken: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    request: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  const auditLogs = { record: jest.fn() } as any;
  const mail = { queueAccountActivation: jest.fn(), queuePasswordReset: jest.fn(), queue: jest.fn() } as any;
  const accountActionTokens = { issueActivation: jest.fn(), issuePasswordReset: jest.fn() } as any;
  const notifications = { createInAppNotification: jest.fn() } as any;
  const files = { remove: jest.fn() } as any;
  const adminOpsRepository = { getAcademicSettings: jest.fn(), getSystemSettings: jest.fn(), getSystemTools: jest.fn(), listSections: jest.fn(), listAnnouncements: jest.fn(), listRequests: jest.fn(), listAcademicYears: jest.fn(), listDepartments: jest.fn(), ensureDepartmentName: jest.fn(), resolveSectionPlacement: jest.fn() } as any;
  const adminReportsRepository = { summary: jest.fn(), currentView: jest.fn(), exportCsv: jest.fn(), reportBundle: jest.fn() } as any;

  return new AdminService(prisma, auditLogs, mail, accountActionTokens, notifications, files, adminOpsRepository, adminReportsRepository);
}

describe('AdminService.auditList', () => {
  it('defaults to bounded result size', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('respects max cap', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 9999);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it('respects explicit take below max', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 50);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('preserves module filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

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
    const service = buildAdminService({ auditLog: { findMany } });

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
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 20, 40);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 40 }),
    );
  });

  it('supports from date filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

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
    const service = buildAdminService({ auditLog: { findMany } });

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
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('includes actor with safe select', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ actor: expect.any(Object) }),
      }),
    );
  });

  it('normalizes skip to minimum 0', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 10, -5);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('normalizes take to minimum 1', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList(undefined, undefined, 0);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it('passes module All as undefined (no filter)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

    await service.auditList('All');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('passes role All as undefined (no filter)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildAdminService({ auditLog: { findMany } });

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
    const service = buildAdminService({ auditLog: { findMany } });

    const result = await service.auditList();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});
