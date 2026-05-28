import { HealthController } from '../../src/health/health.controller';
import { HealthService } from '../../src/health/health.service';
import { inspectRuntimeConfiguration } from '../../src/config/runtime-safety';

function stringify(value: unknown) {
  return JSON.stringify(value);
}

describe('health redaction security gate', () => {
  it('public liveness response exposes no secrets or dependency details', () => {
    const health = {
      live: jest.fn(() => ({
        ok: true,
        service: 'projtrack-backend',
        uptimeSeconds: 12,
        timestamp: '2026-05-14T00:00:00.000Z',
      })),
    } as unknown as HealthService;
    const controller = new HealthController(health);

    const result = controller.live();
    const body = stringify(result);

    expect(result).toMatchObject({ ok: true, service: 'projtrack-backend' });
    expect(body).not.toMatch(/DATABASE_URL|JWT|SECRET|TOKEN|PASSWORD|S3_SECRET|API_KEY/i);
  });

  it('public readiness response exposes booleans rather than raw secret/config values', async () => {
    const health = {
      ready: jest.fn(async () => ({
        ok: true,
        service: 'projtrack-backend',
        checks: {
          database: true,
          storage: true,
          mail: true,
          configuration: true,
          backup: true,
        },
        timestamp: '2026-05-14T00:00:00.000Z',
      })),
    } as unknown as HealthService;
    const controller = new HealthController(health);

    const result = await controller.ready();
    const body = stringify(result);

    expect(result).toMatchObject({ checks: expect.objectContaining({ database: true, configuration: true }) });
    expect(body).not.toMatch(/postgresql:\/\/|DATABASE_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|S3_SECRET_ACCESS_KEY|MAILRELAY_API_KEY/i);
  });

  it('runtime configuration inspection reports key names but not actual secret values', () => {
    const result = inspectRuntimeConfiguration({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://private-user:private-pass@db.example.com:5432/projtrack',
      JWT_ACCESS_SECRET: 'short-secret-access',
      JWT_REFRESH_SECRET: 'short-secret-refresh',
      ACCOUNT_ACTION_TOKEN_ENC_KEY: 'bad-key',
      APP_URL: 'https://www.projtrack.codes',
      FRONTEND_URL: 'https://www.projtrack.codes',
      BACKEND_URL: 'https://api.projtrack.codes',
      CORS_ORIGINS: 'https://www.projtrack.codes',
      MAIL_PROVIDER: 'mailrelay',
      MAIL_FROM_NAME: 'ProjTrack',
      MAIL_FROM_ADMIN: 'admin@projtrack.codes',
      MAIL_FROM_NOREPLY: 'noreply@projtrack.codes',
      MAIL_FROM_INVITE: 'invite@projtrack.codes',
      MAIL_FROM_NOTIFY: 'notify@projtrack.codes',
      MAIL_FROM_SUPPORT: 'support@projtrack.codes',
      MAILRELAY_API_KEY: 'super-private-mailrelay-key',
      MAILRELAY_API_URL: 'https://mailrelay.example.com',
      OBJECT_STORAGE_MODE: 's3',
      S3_BUCKET: 'projtrack-files',
      S3_REGION: 'ap-southeast-1',
      S3_ACCESS_KEY_ID: 'private-access-key-id',
      S3_SECRET_ACCESS_KEY: 'private-secret-access-key',
      S3_SIGNED_URL_TTL_SECONDS: '300',
      MAIL_WORKER_ENABLED: 'true',
      BACKUP_WORKER_ENABLED: 'true',
      BACKUP_SCHEDULE_ENABLED: 'true',
      MAIL_WORKER_POLL_MS: '5000',
      BACKUP_WORKER_POLL_MS: '60000',
      HTTP_RATE_LIMIT_STORE: 'database',
      FILE_MALWARE_SCAN_MODE: 'fail-closed',
      FILE_MALWARE_SCANNER: 'clamav',
      CLAMAV_HOST: 'clamav.example.internal',
      CLAMAV_PORT: '3310',
      TRUST_PROXY: 'true',
      JWT_ISSUER: 'projtrack',
      JWT_AUDIENCE: 'projtrack-users',
      JWT_KEY_ID: 'key-2026-05',
    } as any);

    const body = stringify(result);

    expect(body).toMatch(/JWT_ACCESS_SECRET/i);
    expect(body).toMatch(/JWT_REFRESH_SECRET/i);
    expect(body).not.toContain('postgresql://private-user:private-pass@db.example.com:5432/projtrack');
    expect(body).not.toContain('short-secret-access');
    expect(body).not.toContain('short-secret-refresh');
    expect(body).not.toContain('super-private-mailrelay-key');
    expect(body).not.toContain('private-secret-access-key');
  });

  it('admin database health payload shape must not include database URLs or credentials', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          { currentDatabase: 'projtrack', currentSchema: 'public', migrationsTable: '_prisma_migrations' },
        ])
        .mockResolvedValueOnce([{ appliedCount: 4, unresolvedCount: 0 }]),
    } as any;
    const service = new HealthService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://private-user:private-pass@db.example.com:5432/projtrack';
    try {
      const result = await service.database();
      const body = stringify(result);

      expect(result).toMatchObject({ ok: true, configured: true, reachable: true });
      expect(body).not.toContain('private-pass');
      expect(body).not.toContain('postgresql://');
      expect(body).not.toContain(process.env.DATABASE_URL);
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
