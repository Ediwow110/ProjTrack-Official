import { BackupWorkerService } from './backup-worker.service';
import { BackupsService } from './backups.service';
import { BackupRetentionService } from './backup-retention.service';

function makeBackups(opts: {
  settings?: Partial<{
    enabled: boolean;
    frequency: string;
    timeOfDay: string;
    timezone: string;
    nextScheduledBackup: string | null;
    retentionDays: number;
    retentionCount: number;
  }>;
  ran?: boolean;
  reason?: string;
}) {
  const settings = {
    enabled: true,
    frequency: 'daily',
    timeOfDay: '02:00',
    timezone: 'UTC',
    nextScheduledBackup: '2026-05-04T02:00:00Z',
    retentionDays: 30,
    retentionCount: 60,
    ...(opts.settings ?? {}),
  };
  const tickResult = { ran: opts.ran ?? false, reason: opts.reason ?? 'not yet due' };
  return {
    instance: {
      getBackupSettings: jest.fn(async () => settings),
      createAutomaticBackupIfDue: jest.fn(async () => tickResult),
    } as unknown as BackupsService,
    settings,
  };
}

function makeRetention() {
  return {
    instance: {
      cleanupExpired: jest.fn(async () => ({ removed: 0 })),
    } as unknown as BackupRetentionService,
  };
}

describe('BackupWorkerService.status', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('reports disabled by default', () => {
    delete process.env.BACKUP_WORKER_ENABLED;
    const { instance: backups } = makeBackups({});
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    const s = w.status();
    expect(s.enabled).toBe(false);
    expect(s.running).toBe(false);
    expect(s.pollMs).toBeGreaterThanOrEqual(10_000);
  });

  it('reports enabled when BACKUP_WORKER_ENABLED=true', () => {
    process.env.BACKUP_WORKER_ENABLED = 'true';
    const { instance: backups } = makeBackups({});
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    expect(w.status().enabled).toBe(true);
  });

  it('floors poll interval to 10 seconds even if BACKUP_WORKER_POLL_MS is smaller', () => {
    process.env.BACKUP_WORKER_POLL_MS = '500';
    const { instance: backups } = makeBackups({});
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    expect(w.status().pollMs).toBe(10_000);
  });
});

describe('BackupWorkerService.onModuleInit', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('does not start a timer when disabled', () => {
    process.env.BACKUP_WORKER_ENABLED = 'false';
    const { instance: backups } = makeBackups({});
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    w.onModuleInit();
    expect(w.status().running).toBe(false);
    expect((backups.getBackupSettings as jest.Mock)).not.toHaveBeenCalled();
  });

  it('starts a timer and runs an initial tick when enabled, and clears the timer on destroy', async () => {
    process.env.BACKUP_WORKER_ENABLED = 'true';
    process.env.BACKUP_WORKER_POLL_MS = '60000';
    const { instance: backups } = makeBackups({ ran: false, reason: 'not yet due' });
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    w.onModuleInit();
    // Initial tick is async (fire-and-forget); flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect((backups.getBackupSettings as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((backups.createAutomaticBackupIfDue as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(w.status().running).toBe(true);
    w.onModuleDestroy();
    expect(w.status().running).toBe(false);
  });
});

describe('BackupWorkerService tick behaviour', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('runs retention cleanup after a successful automatic backup', async () => {
    process.env.BACKUP_WORKER_ENABLED = 'true';
    const { instance: backups, settings } = makeBackups({ ran: true });
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    // Invoke private tick via the public init path and immediately destroy
    // (the initial tick fires fire-and-forget on init).
    w.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    w.onModuleDestroy();
    expect((retention.cleanupExpired as jest.Mock)).toHaveBeenCalledWith({
      retentionDays: settings.retentionDays,
      retentionCount: settings.retentionCount,
    });
  });

  it('does not run retention cleanup when no automatic backup was due', async () => {
    process.env.BACKUP_WORKER_ENABLED = 'true';
    const { instance: backups } = makeBackups({ ran: false, reason: 'not yet due' });
    const { instance: retention } = makeRetention();
    const w = new BackupWorkerService(backups, retention);
    w.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    w.onModuleDestroy();
    expect((retention.cleanupExpired as jest.Mock)).not.toHaveBeenCalled();
  });
});
