const fs = require('node:fs');
const path = require('node:path');

require('ts-node/register/transpile-only');

const backendRoot = path.resolve(__dirname, '..');
const failures = [];

const { inspectRuntimeConfiguration } = require(path.join(
  backendRoot,
  'src/config/runtime-safety.ts',
));

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://projtrack:prod-password@db.prod.example.com:5432/projtrack',
    JWT_ACCESS_SECRET: 'prod-access-secret-for-boot-check-only-000000000000000000000000',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-for-boot-check-only-0000000000000000000000',
    JWT_ISSUER: 'projtrack-api',
    JWT_AUDIENCE: 'projtrack-web',
    JWT_KEY_ID: 'prod-boot-check',
    ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    APP_URL: 'https://www.projtrack.codes',
    FRONTEND_URL: 'https://www.projtrack.codes',
    BACKEND_URL: 'https://api.projtrack.codes',
    CORS_ORIGINS: 'https://www.projtrack.codes,https://projtrack.codes',
    TRUST_PROXY: 'true',
    MAIL_PROVIDER: 'mailrelay',
    MAIL_FROM_NAME: 'ProjTrack',
    MAIL_FROM_ADMIN: 'admin@projtrack.codes',
    MAIL_FROM_NOREPLY: 'support@projtrack.codes',
    MAIL_FROM_INVITE: 'support@projtrack.codes',
    MAIL_FROM_NOTIFY: 'notification@projtrack.codes',
    MAIL_FROM_SUPPORT: 'support@projtrack.codes',
    MAILRELAY_API_KEY: 'mailrelay-boot-check-key-not-real-000000000000',
    MAILRELAY_API_URL: 'https://projtrack.ipzmarketing.com/api/v1',
    TESTMAIL_ENABLED: 'false',
    MAIL_WORKER_ENABLED: 'false',
    MAIL_WORKER_POLL_MS: '60000',
    OBJECT_STORAGE_MODE: 's3',
    S3_BUCKET: 'projtrack-private-prod',
    S3_REGION: 'ap-southeast-1',
    S3_ENDPOINT: 'https://s3.ap-southeast-1.amazonaws.com',
    S3_ACCESS_KEY_ID: 'prod-storage-access-key-boot-check',
    S3_SECRET_ACCESS_KEY: 'prod-storage-secret-key-boot-check',
    S3_SIGNED_URL_TTL_SECONDS: '300',
    S3_BUCKET_PUBLIC: 'false',
    HTTP_RATE_LIMIT_STORE: 'database',
    FILE_MALWARE_SCAN_MODE: 'fail-closed',
    FILE_MALWARE_SCANNER: 'clamav',
    CLAMAV_HOST: 'clamav.prod.example.com',
    CLAMAV_PORT: '3310',
    BACKUP_WORKER_ENABLED: 'false',
    BACKUP_SCHEDULE_ENABLED: 'false',
    BACKUP_WORKER_POLL_MS: '60000',
    ALLOW_DEMO_SEED: 'false',
    ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
    ...overrides,
  };
}

const result = inspectRuntimeConfiguration(productionEnv());
assert(result.ok, `Production boot configuration fixture failed: ${result.errors.join('; ')}`);

const localDatabaseResult = inspectRuntimeConfiguration(
  productionEnv({ DATABASE_URL: 'postgresql://projtrack:projtrack@localhost:5432/projtrack' }),
);
assert(
  !localDatabaseResult.ok &&
    localDatabaseResult.errors.some((error) => error.includes('DATABASE_URL cannot point to localhost')),
  'Production boot check must reject localhost DATABASE_URL values.',
);

const weakSecretResult = inspectRuntimeConfiguration(productionEnv({ JWT_ACCESS_SECRET: 'short' }));
assert(
  !weakSecretResult.ok &&
    weakSecretResult.errors.some((error) => error.includes('JWT_ACCESS_SECRET is using a default or weak value')),
  'Production boot check must reject weak JWT_ACCESS_SECRET values.',
);

assert(
  fs.existsSync(path.join(backendRoot, 'dist/main.js')),
  'Compiled backend entrypoint dist/main.js is missing. Run npm run build before check:boot:production.',
);

if (failures.length) {
  console.error('Production boot check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production boot check passed.');
