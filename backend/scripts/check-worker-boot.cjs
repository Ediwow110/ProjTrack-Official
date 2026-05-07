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

const workerEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://projtrack:prod-password@db.prod.example.com:5432/projtrack',
  JWT_ACCESS_SECRET: 'prod-access-secret-for-worker-check-only-0000000000000000000000',
  JWT_REFRESH_SECRET: 'prod-refresh-secret-for-worker-check-only-000000000000000000000',
  JWT_ISSUER: 'projtrack-api',
  JWT_AUDIENCE: 'projtrack-web',
  JWT_KEY_ID: 'prod-worker-check',
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
  MAILRELAY_API_KEY: 'mailrelay-worker-check-key-not-real-000000000000',
  MAILRELAY_API_URL: 'https://projtrack.ipzmarketing.com/api/v1',
  TESTMAIL_ENABLED: 'false',
  MAIL_WORKER_ENABLED: 'true',
  MAIL_WORKER_POLL_MS: '60000',
  OBJECT_STORAGE_MODE: 's3',
  S3_BUCKET: 'projtrack-private-prod',
  S3_REGION: 'ap-southeast-1',
  S3_ENDPOINT: 'https://s3.ap-southeast-1.amazonaws.com',
  S3_ACCESS_KEY_ID: 'prod-storage-access-key-worker-check',
  S3_SECRET_ACCESS_KEY: 'prod-storage-secret-key-worker-check',
  S3_SIGNED_URL_TTL_SECONDS: '300',
  S3_BUCKET_PUBLIC: 'false',
  HTTP_RATE_LIMIT_STORE: 'database',
  FILE_MALWARE_SCAN_MODE: 'fail-closed',
  FILE_MALWARE_SCANNER: 'clamav',
  CLAMAV_HOST: 'clamav.prod.example.com',
  CLAMAV_PORT: '3310',
  BACKUP_WORKER_ENABLED: 'true',
  BACKUP_SCHEDULE_ENABLED: 'true',
  BACKUP_WORKER_POLL_MS: '60000',
  ALLOW_DEMO_SEED: 'false',
  ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
};

const result = inspectRuntimeConfiguration(workerEnv);
assert(result.ok, `Worker production configuration fixture failed: ${result.errors.join('; ')}`);
assert(
  fs.existsSync(path.join(backendRoot, 'dist/worker.js')),
  'Compiled worker entrypoint dist/worker.js is missing. Run npm run build before check:boot:worker.',
);

if (failures.length) {
  console.error('Worker boot check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Worker boot check passed.');
