import { inspectRuntimeConfiguration } from './runtime-safety';

function prodEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://projtrack:prod-password@db.prod.example.com:5432/projtrack',
    JWT_ACCESS_SECRET: 'prod-access-secret-spec-fixture-not-real-0000000000000000',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-spec-fixture-not-real-000000000000000',
    JWT_ISSUER: 'projtrack-api',
    JWT_AUDIENCE: 'projtrack-web',
    JWT_KEY_ID: 'prod-spec',
    ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    APP_URL: 'https://www.projtrack.codes',
    FRONTEND_URL: 'https://www.projtrack.codes',
    BACKEND_URL: 'https://api.projtrack.codes',
    CORS_ORIGINS: 'https://www.projtrack.codes',
    TRUST_PROXY: 'true',
    MAIL_PROVIDER: 'mailrelay',
    TESTMAIL_ENABLED: 'false',
    MAIL_FROM_NAME: 'ProjTrack',
    MAIL_FROM_ADMIN: 'admin@projtrack.codes',
    MAIL_FROM_NOREPLY: 'support@projtrack.codes',
    MAIL_FROM_INVITE: 'support@projtrack.codes',
    MAIL_FROM_NOTIFY: 'notification@projtrack.codes',
    MAIL_FROM_SUPPORT: 'support@projtrack.codes',
    MAILRELAY_API_KEY: 'mailrelay-spec-not-real-0000000000000000',
    MAILRELAY_API_URL: 'https://projtrack.ipzmarketing.com/api/v1',
    MAIL_WORKER_ENABLED: 'false',
    MAIL_WORKER_POLL_MS: '60000',
    OBJECT_STORAGE_MODE: 's3',
    S3_BUCKET: 'projtrack-private-prod',
    S3_REGION: 'ap-southeast-1',
    S3_ENDPOINT: 'https://s3.ap-southeast-1.amazonaws.com',
    S3_ACCESS_KEY_ID: 'spec-access-key',
    S3_SECRET_ACCESS_KEY: 'spec-secret-key',
    S3_SIGNED_URL_TTL_SECONDS: '300',
    S3_BUCKET_PUBLIC: 'false',
    HTTP_RATE_LIMIT_STORE: 'database',
    FILE_MALWARE_SCAN_MODE: 'fail-closed',
    FILE_MALWARE_SCANNER: 'clamav',
    CLAMAV_HOST: 'clamav.spec.local',
    CLAMAV_PORT: '3310',
    BACKUP_WORKER_ENABLED: 'false',
    BACKUP_SCHEDULE_ENABLED: 'false',
    BACKUP_WORKER_POLL_MS: '3600000',
    ALLOW_DEMO_SEED: 'false',
    ALLOW_SEED_DATA_CLEANUP: 'false',
    ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
    ...overrides,
  };
}

describe('inspectRuntimeConfiguration (production)', () => {
  it('accepts a known-good production fixture', () => {
    const r = inspectRuntimeConfiguration(prodEnv());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.environment).toBe('production');
  });

  it.each([
    [
      'weak JWT_ACCESS_SECRET',
      { JWT_ACCESS_SECRET: 'short' },
      /JWT_ACCESS_SECRET/,
    ],
    [
      'shared access/refresh secret',
      { JWT_REFRESH_SECRET: prodEnv().JWT_ACCESS_SECRET },
      /JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different/,
    ],
    [
      'localhost FRONTEND_URL',
      { FRONTEND_URL: 'http://localhost:5173' },
      /FRONTEND_URL/,
    ],
    [
      'non-https APP_URL',
      { APP_URL: 'http://www.projtrack.codes' },
      /APP_URL must use https/,
    ],
    [
      'localhost in CORS_ORIGINS',
      { CORS_ORIGINS: 'https://www.projtrack.codes,http://localhost:5173' },
      /CORS_ORIGINS/,
    ],
    [
      'in-memory rate limit store',
      { HTTP_RATE_LIMIT_STORE: 'memory' },
      /HTTP_RATE_LIMIT_STORE/,
    ],
    [
      'malware scanning disabled',
      { FILE_MALWARE_SCAN_MODE: 'disabled' },
      /FILE_MALWARE_SCAN_MODE/,
    ],
    [
      'public S3 bucket',
      { S3_BUCKET_PUBLIC: 'true' },
      /S3_BUCKET_PUBLIC/,
    ],
    [
      'local file storage',
      { OBJECT_STORAGE_MODE: 'local' },
      /OBJECT_STORAGE_MODE/,
    ],
    [
      'mail provider stub',
      { MAIL_PROVIDER: 'stub' },
      /MAIL_PROVIDER/,
    ],
    [
      'TRUST_PROXY missing',
      { TRUST_PROXY: '' },
      /TRUST_PROXY/,
    ],
    [
      'mismatched NODE_ENV/APP_ENV',
      { NODE_ENV: 'production', APP_ENV: 'test' },
      /NODE_ENV and APP_ENV/,
    ],
    [
      'localhost DATABASE_URL',
      { DATABASE_URL: 'postgresql://x:y@localhost:5432/z' },
      /DATABASE_URL/,
    ],
    [
      'invalid ACCOUNT_ACTION_TOKEN_ENC_KEY length',
      { ACCOUNT_ACTION_TOKEN_ENC_KEY: 'too-short' },
      /ACCOUNT_ACTION_TOKEN_ENC_KEY/,
    ],
    [
      'missing CLAMAV_HOST when clamav scanner',
      { CLAMAV_HOST: '' },
      /CLAMAV_HOST/,
    ],
  ])('rejects %s', (_label, overrides, pattern) => {
    const r = inspectRuntimeConfiguration(prodEnv(overrides));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' | ')).toMatch(pattern);
  });

  it('reports all worker poll values must be configured', () => {
    const r = inspectRuntimeConfiguration(prodEnv({ MAIL_WORKER_POLL_MS: '' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' | ')).toMatch(/MAIL_WORKER_POLL_MS/);
  });

  it('reports a poll value below 1000ms', () => {
    const r = inspectRuntimeConfiguration(prodEnv({ MAIL_WORKER_POLL_MS: '50' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' | ')).toMatch(/MAIL_WORKER_POLL_MS/);
  });
});

describe('inspectRuntimeConfiguration (development)', () => {
  it('does not error on stub provider in development', () => {
    const r = inspectRuntimeConfiguration({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      DATABASE_URL: 'postgresql://projtrack:projtrack@localhost:5432/projtrack',
      JWT_ACCESS_SECRET: 'dev-access-secret-long-enough-to-pass-the-weak-check-aa',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-long-enough-to-pass-the-weak-check-aa',
      MAIL_PROVIDER: 'stub',
      MAIL_FROM: 'noreply@projtrack.local',
      MAIL_WORKER_ENABLED: 'false',
      MAIL_WORKER_POLL_MS: '60000',
      BACKUP_WORKER_ENABLED: 'false',
      BACKUP_SCHEDULE_ENABLED: 'false',
      BACKUP_WORKER_POLL_MS: '60000',
      OBJECT_STORAGE_MODE: 'local',
      FILE_STORAGE_MODE: 'local',
      HTTP_RATE_LIMIT_STORE: 'memory',
      FILE_MALWARE_SCAN_MODE: 'disabled',
    });
    expect(r.errors).toEqual([]);
  });
});
