import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const backendDir = path.join(rootDir, 'backend');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const output = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }

  return output;
}

const useTestBackendEnv = /^(1|true|yes|on)$/i.test(
  String(process.env.PROJTRACK_USE_TEST_BACKEND_ENV ?? '').trim(),
);

const localEnvCandidates = [
  path.join(rootDir, '.env'),
  path.join(backendDir, '.env'),
  path.join(rootDir, 'backend.env.local-private'),
  ...(useTestBackendEnv ? [path.join(rootDir, 'backend.env.local-test')] : []),
];

const loadedLocalEnvSources = localEnvCandidates.filter((candidate) => fs.existsSync(candidate));
const loadedLocalEnv = loadedLocalEnvSources.reduce(
  (accumulator, candidate) => ({ ...accumulator, ...parseEnvFile(candidate) }),
  {},
);

function resolveMailProvider(env) {
  const explicitProvider = String(env.MAIL_PROVIDER ?? '').trim();
  if (explicitProvider) return explicitProvider;
  return 'mailrelay';
}

export const localBackendDefaults = {
  NODE_ENV: 'development',
  APP_ENV: 'development',
  PORT: '3001',
  DATABASE_URL: 'postgresql://projtrack:projtrack@127.0.0.1:5432/projtrack?schema=public',
  APP_URL: 'http://127.0.0.1:5173',
  FRONTEND_URL: 'http://127.0.0.1:5173',
  BACKEND_URL: 'http://127.0.0.1:3001',
  CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  JWT_ACCESS_SECRET: 'local-dev-access-secret-change-before-production-1234567890',
  JWT_REFRESH_SECRET: 'local-dev-refresh-secret-change-before-production-1234567890',
  JWT_ISSUER: 'projtrack-api-local',
  JWT_AUDIENCE: 'projtrack-web-local',
  JWT_KEY_ID: 'local-dev',
  ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  MAIL_WORKER_ENABLED: 'false',
  MAIL_WORKER_POLL_MS: '60000',
  TESTMAIL_ENABLED: 'false',
  MAIL_FROM_NAME: 'ProjTrack',
  MAIL_FROM_ADMIN: 'admin@projtrack.codes',
  MAIL_FROM_NOREPLY: 'support@projtrack.codes',
  MAIL_FROM_INVITE: 'support@projtrack.codes',
  MAIL_FROM_NOTIFY: 'notification@projtrack.codes',
  MAIL_FROM_SUPPORT: 'support@projtrack.codes',
  OBJECT_STORAGE_MODE: 'local',
  FILE_STORAGE_MODE: 'local',
  FILE_MALWARE_SCAN_MODE: 'disabled',
  HTTP_RATE_LIMIT_STORE: 'memory',
  TRUST_PROXY: 'false',
  S3_BUCKET: '',
  S3_REGION: '',
  S3_ENDPOINT: '',
  S3_ACCESS_KEY_ID: '',
  S3_SECRET_ACCESS_KEY: '',
  BACKUP_WORKER_ENABLED: 'false',
  BACKUP_SCHEDULE_ENABLED: 'false',
  BACKUP_WORKER_POLL_MS: '60000',
  BACKUP_LOCAL_DIR: 'data/system-tools/backups',
  ALLOW_DEMO_SEED: 'false',
  ALLOW_SEED_DATA_CLEANUP: 'false',
  ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
};

export function withLocalBackendEnv(overrides = {}) {
  const merged = {
    ...localBackendDefaults,
    ...loadedLocalEnv,
    ...process.env,
    ...overrides,
  };
  merged.MAIL_PROVIDER = resolveMailProvider(merged);
  return merged;
}

export function detectLocalBackendEnvSources() {
  return [...loadedLocalEnvSources];
}
