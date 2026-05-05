import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { MailLimitService } from '../mail/mail-limit.service';
import { MailTransportService } from '../mail/mail.transport.service';
import { BackupsService } from '../backups/backups.service';
import { BackupWorkerService } from '../backups/backup-worker.service';
import { MailWorker } from '../mail/mail.worker';

function buildPrisma(opts: {
  databaseInfoRows?: Array<{ currentDatabase: string; currentSchema: string; migrationsTable: string | null }>;
  migrationInfoRows?: Array<{ appliedCount: number; unresolvedCount: number }>;
  rawError?: Error;
}) {
  const queries: string[] = [];
  const queryRawUnsafe = jest.fn(async (sql: string) => {
    queries.push(sql);
    if (opts.rawError) throw opts.rawError;
    if (sql.includes('current_database()')) {
      return opts.databaseInfoRows ?? [];
    }
    if (sql.includes('_prisma_migrations')) {
      return opts.migrationInfoRows ?? [];
    }
    return [];
  });
  return {
    prisma: { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService,
    queries,
  };
}

function buildFiles(ok: boolean): FilesService {
  return { healthCheck: jest.fn(() => ({ ok })) } as unknown as FilesService;
}

function buildBackups(opts: {
  history?: { latestSuccessful: any; failedBackups: number; totalBackups: number; storageUsedBytes: number; nextAutomaticBackup: string | null };
}): BackupsService {
  return {
    listHistory: jest.fn(async () => opts.history ?? {
      latestSuccessful: null,
      failedBackups: 0,
      totalBackups: 0,
      storageUsedBytes: 0,
      nextAutomaticBackup: null,
    }),
  } as unknown as BackupsService;
}

function buildBackupWorker(): BackupWorkerService {
  return { status: jest.fn(() => ({ enabled: false, running: false, pollMs: 60000 })) } as unknown as BackupWorkerService;
}

// MailLimit / MailTransport / MailWorker are needed to construct HealthService
// but mailStatus() is intentionally not exercised here; see deferred section.
function buildMailDeps() {
  const transport = {} as unknown as MailTransportService;
  const limits = {} as unknown as MailLimitService;
  const worker = {} as unknown as MailWorker;
  return { transport, limits, worker };
}

describe('HealthService.live', () => {
  it('returns ok=true with service name and timestamp', () => {
    const { prisma } = buildPrisma({});
    const { transport, limits, worker } = buildMailDeps();
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      transport,
      limits,
      buildBackups({}),
      buildBackupWorker(),
      worker,
    );
    const r = svc.live();
    expect(r.ok).toBe(true);
    expect(r.service).toBe('projtrack-backend');
    expect(typeof r.uptimeSeconds).toBe('number');
    expect(r.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof r.timestamp).toBe('string');
  });
});

describe('HealthService.database', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns ok=false and configured=false when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    const { prisma } = buildPrisma({});
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({}),
      buildBackupWorker(),
      {} as MailWorker,
    );
    const r = await svc.database();
    expect(r.ok).toBe(false);
    expect(r.configured).toBe(false);
    expect(r.reachable).toBe(false);
    expect(r.detail).toBe('DATABASE_URL is not set.');
    expect(r.migrationTablePresent).toBe(false);
    expect(r.pendingMigrations).toBeNull();
    expect(r.appliedMigrations).toBeNull();
  });

  it('returns ok=false, reachable=false with a probe error when Prisma throws (DB-down simulation)', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@db.example.com:5432/z';
    const { prisma } = buildPrisma({ rawError: new Error("Can't reach database server at db.example.com:5432") });
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({}),
      buildBackupWorker(),
      {} as MailWorker,
    );
    const r = await svc.database();
    expect(r.ok).toBe(false);
    expect(r.configured).toBe(true);
    expect(r.reachable).toBe(false);
    expect(r.detail).toMatch(/Database probe failed: Can't reach database server/);
  });

  it('returns ok=false when migrations table is missing even though DB is reachable', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@db.example.com:5432/z';
    const { prisma } = buildPrisma({
      databaseInfoRows: [{ currentDatabase: 'projtrack', currentSchema: 'public', migrationsTable: null }],
    });
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({}),
      buildBackupWorker(),
      {} as MailWorker,
    );
    const r = await svc.database();
    expect(r.ok).toBe(false);
    expect(r.configured).toBe(true);
    expect(r.reachable).toBe(true);
    expect(r.migrationTablePresent).toBe(false);
    expect(r.detail).toMatch(/migrations table is missing/);
  });

  it('returns ok=false when there are pending/unresolved migrations', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@db.example.com:5432/z';
    const { prisma } = buildPrisma({
      databaseInfoRows: [{ currentDatabase: 'projtrack', currentSchema: 'public', migrationsTable: 'public._prisma_migrations' }],
      migrationInfoRows: [{ appliedCount: 12, unresolvedCount: 1 }],
    });
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({}),
      buildBackupWorker(),
      {} as MailWorker,
    );
    const r = await svc.database();
    expect(r.ok).toBe(false);
    expect(r.migrationTablePresent).toBe(true);
    expect(r.appliedMigrations).toBe(12);
    expect(r.pendingMigrations).toBe(1);
    expect(r.detail).toMatch(/migration record\(s\) still need attention/);
  });

  it('returns ok=true when migrations table is present and zero pending', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@db.example.com:5432/z';
    const { prisma } = buildPrisma({
      databaseInfoRows: [{ currentDatabase: 'projtrack', currentSchema: 'public', migrationsTable: 'public._prisma_migrations' }],
      migrationInfoRows: [{ appliedCount: 42, unresolvedCount: 0 }],
    });
    const svc = new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({}),
      buildBackupWorker(),
      {} as MailWorker,
    );
    const r = await svc.database();
    expect(r.ok).toBe(true);
    expect(r.appliedMigrations).toBe(42);
    expect(r.pendingMigrations).toBe(0);
    expect(r.detail).toMatch(/42 migration\(s\) applied/);
  });
});

describe('HealthService.backupStatus', () => {
  function svcWith(history: any) {
    const { prisma } = buildPrisma({});
    return new HealthService(
      prisma,
      buildFiles(true),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({ history }),
      buildBackupWorker(),
      {} as MailWorker,
    );
  }

  it('returns ok=true when there is a latest successful backup, even if older failures exist', async () => {
    const r = await svcWith({
      latestSuccessful: { id: 'b1', completedAt: '2026-05-02T00:00:00Z', startedAt: '2026-05-02T00:00:00Z' },
      failedBackups: 3,
      totalBackups: 10,
      storageUsedBytes: 12345,
      nextAutomaticBackup: '2026-05-04T00:00:00Z',
    }).backupStatus();
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/Latest successful backup completed at/);
    expect(r.failedBackups).toBe(3);
  });

  it('returns ok=true (fresh install) when there are no backups and no failures yet', async () => {
    const r = await svcWith({
      latestSuccessful: null,
      failedBackups: 0,
      totalBackups: 0,
      storageUsedBytes: 0,
      nextAutomaticBackup: null,
    }).backupStatus();
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/No successful backup has been recorded yet/);
  });

  it('returns ok=false when failures have accumulated and no successful backup is on record', async () => {
    const r = await svcWith({
      latestSuccessful: null,
      failedBackups: 2,
      totalBackups: 2,
      storageUsedBytes: 0,
      nextAutomaticBackup: null,
    }).backupStatus();
    expect(r.ok).toBe(false);
    expect(r.failedBackups).toBe(2);
  });
});

describe('HealthService.ready (composition)', () => {
  function makeReadyService(opts: {
    databaseUrlSet: boolean;
    dbThrows?: boolean;
    migrationsOk?: boolean;
    storageOk: boolean;
    backupHistory?: any;
  }) {
    if (opts.databaseUrlSet) {
      process.env.DATABASE_URL = 'postgresql://x:y@db.example.com:5432/z';
    } else {
      delete process.env.DATABASE_URL;
    }
    const { prisma } = buildPrisma({
      rawError: opts.dbThrows ? new Error('connection refused') : undefined,
      databaseInfoRows: opts.migrationsOk
        ? [{ currentDatabase: 'projtrack', currentSchema: 'public', migrationsTable: 'public._prisma_migrations' }]
        : undefined,
      migrationInfoRows: opts.migrationsOk ? [{ appliedCount: 1, unresolvedCount: 0 }] : undefined,
    });
    // mailStatus() needs a working transport; we stub it on the instance instead.
    const svc = new HealthService(
      prisma,
      buildFiles(opts.storageOk),
      {} as MailTransportService,
      {} as MailLimitService,
      buildBackups({ history: opts.backupHistory }),
      buildBackupWorker(),
      {} as MailWorker,
    );
    return svc;
  }

  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns ok=false when database is unreachable, regardless of other checks', async () => {
    const svc = makeReadyService({ databaseUrlSet: true, dbThrows: true, storageOk: true });
    // Stub the parts of ready() we are not testing here.
    (svc as any).mailStatus = async () => ({ ok: true });
    (svc as any).configuration = () => ({ ok: true });
    const r = await svc.ready();
    expect(r.ok).toBe(false);
    expect(r.checks.database).toBe(false);
    expect(r.checks.storage).toBe(true);
  });

  it('returns ok=false when storage healthCheck reports not-ok', async () => {
    const svc = makeReadyService({ databaseUrlSet: true, migrationsOk: true, storageOk: false });
    (svc as any).mailStatus = async () => ({ ok: true });
    (svc as any).configuration = () => ({ ok: true });
    const r = await svc.ready();
    expect(r.ok).toBe(false);
    expect(r.checks.database).toBe(true);
    expect(r.checks.storage).toBe(false);
  });

  it('returns ok=false when configuration reports not-ok', async () => {
    const svc = makeReadyService({ databaseUrlSet: true, migrationsOk: true, storageOk: true });
    (svc as any).mailStatus = async () => ({ ok: true });
    (svc as any).configuration = () => ({ ok: false });
    const r = await svc.ready();
    expect(r.ok).toBe(false);
    expect(r.checks.configuration).toBe(false);
  });

  it('returns ok=false when mail status reports not-ok', async () => {
    const svc = makeReadyService({ databaseUrlSet: true, migrationsOk: true, storageOk: true });
    (svc as any).mailStatus = async () => ({ ok: false });
    (svc as any).configuration = () => ({ ok: true });
    const r = await svc.ready();
    expect(r.ok).toBe(false);
    expect(r.checks.mail).toBe(false);
  });

  it('returns ok=false when backup status reports not-ok (failed backups, no success)', async () => {
    const svc = makeReadyService({
      databaseUrlSet: true,
      migrationsOk: true,
      storageOk: true,
      backupHistory: { latestSuccessful: null, failedBackups: 1, totalBackups: 1, storageUsedBytes: 0, nextAutomaticBackup: null },
    });
    (svc as any).mailStatus = async () => ({ ok: true });
    (svc as any).configuration = () => ({ ok: true });
    const r = await svc.ready();
    expect(r.ok).toBe(false);
    expect(r.checks.backup).toBe(false);
  });

  it('returns ok=true only when every sub-check passes', async () => {
    const svc = makeReadyService({ databaseUrlSet: true, migrationsOk: true, storageOk: true });
    (svc as any).mailStatus = async () => ({ ok: true });
    (svc as any).configuration = () => ({ ok: true });
    const r = await svc.ready();
    expect(r.ok).toBe(true);
    expect(r.checks).toEqual({ database: true, storage: true, mail: true, configuration: true, backup: true });
  });
});
