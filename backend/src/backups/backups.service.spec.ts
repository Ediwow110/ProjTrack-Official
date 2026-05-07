import { existsSync, readFileSync } from 'fs';
import { BackupsService } from './backups.service';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('BackupsService backup settings persistence', () => {
  const existsSyncMock = existsSync as any;
  const readFileSyncMock = readFileSync as any;

  function createService() {
    const prisma = {
      backupRun: {
        findFirst: jest.fn(),
      },
      systemSetting: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    } as any;

    const storage = {
      getProvider: jest.fn(() => 'local'),
      getRoot: jest.fn(() => '/app/data/system-tools/backups'),
    } as any;

    const auditLogs = {
      record: jest.fn(),
    } as any;

    return {
      service: new BackupsService(prisma, storage, auditLogs),
      prisma,
      storage,
      auditLogs,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers DB-backed backup settings when present', async () => {
    const { service, prisma } = createService();
    prisma.systemSetting.findFirst.mockResolvedValueOnce({
      backupSettingsJson: {
        enabled: true,
        frequency: 'weekly',
        timeOfDay: '03:30',
        timezone: 'UTC',
        weeklyDay: 2,
        monthlyDay: 1,
        customIntervalHours: 24,
        retentionDays: 14,
        retentionCount: 5,
      },
    });
    prisma.backupRun.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await service.getBackupSettings();

    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe('weekly');
    expect(result.timezone).toBe('UTC');
    expect(result.weeklyDay).toBe(2);
    expect(prisma.systemSetting.update).not.toHaveBeenCalled();
    expect(existsSyncMock).not.toHaveBeenCalled();
  });

  it('migrates valid legacy backup-settings.json into DB when DB value is missing', async () => {
    const { service, prisma } = createService();
    prisma.systemSetting.findFirst
      .mockResolvedValueOnce({ id: 'sys1', backupSettingsJson: null })
      .mockResolvedValueOnce({ id: 'sys1' });
    prisma.systemSetting.update.mockResolvedValueOnce({});
    prisma.backupRun.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    existsSyncMock.mockReturnValueOnce(true);
    readFileSyncMock.mockReturnValueOnce(
      JSON.stringify({
        enabled: true,
        frequency: 'monthly',
        timeOfDay: '04:45',
        timezone: 'Asia/Manila',
        weeklyDay: 1,
        monthlyDay: 7,
        customIntervalHours: 12,
        retentionDays: 21,
        retentionCount: 8,
      }) as any,
    );

    const result = await service.getBackupSettings();

    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe('monthly');
    expect(result.monthlyDay).toBe(7);
    expect(prisma.systemSetting.update).toHaveBeenCalledWith({
      where: { id: 'sys1' },
      data: {
        backupSettingsJson: expect.objectContaining({
          enabled: true,
          frequency: 'monthly',
          timeOfDay: '04:45',
          timezone: 'Asia/Manila',
          retentionDays: 21,
          retentionCount: 8,
        }),
      },
    });
  });

  it('falls back to safe defaults when DB JSON is malformed', async () => {
    const { service, prisma } = createService();
    prisma.systemSetting.findFirst.mockResolvedValueOnce({
      backupSettingsJson: 'not-an-object',
    });
    prisma.backupRun.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    existsSyncMock.mockReturnValueOnce(true);

    const result = await service.getBackupSettings();

    expect(result.enabled).toBe(false);
    expect(result.frequency).toBe('daily');
    expect(existsSyncMock).not.toHaveBeenCalled();
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });
});
