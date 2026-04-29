#!/usr/bin/env node
const path = require('path');

Object.assign(process.env, {
  NODE_ENV: 'development',
  APP_ENV: 'development',
  PORT: process.env.PORT || '3001',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://projtrack:projtrack@127.0.0.1:5432/projtrack?schema=public',
  APP_URL: process.env.APP_URL || 'http://127.0.0.1:5173',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'local-dev-access-secret-change-before-production-1234567890',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'local-dev-refresh-secret-change-before-production-1234567890',
  MAIL_PROVIDER: process.env.MAIL_PROVIDER || 'stub',
  MAIL_WORKER_ENABLED: process.env.MAIL_WORKER_ENABLED || 'false',
  TESTMAIL_ENABLED: process.env.TESTMAIL_ENABLED || 'false',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'ProjTrack',
  MAIL_FROM_ADMIN: process.env.MAIL_FROM_ADMIN || 'admin@projtrack.codes',
  MAIL_FROM_NOREPLY: process.env.MAIL_FROM_NOREPLY || 'support@projtrack.codes',
  MAIL_FROM_INVITE: process.env.MAIL_FROM_INVITE || 'support@projtrack.codes',
  MAIL_FROM_NOTIFY: process.env.MAIL_FROM_NOTIFY || 'notification@projtrack.codes',
  MAIL_FROM_SUPPORT: process.env.MAIL_FROM_SUPPORT || 'support@projtrack.codes',
  OBJECT_STORAGE_MODE: process.env.OBJECT_STORAGE_MODE || 'local',
  FILE_STORAGE_MODE: process.env.FILE_STORAGE_MODE || 'local',
  BACKUP_WORKER_ENABLED: process.env.BACKUP_WORKER_ENABLED || 'false',
  BACKUP_LOCAL_DIR: process.env.BACKUP_LOCAL_DIR || 'data/system-tools/backups',
  ALLOW_DEMO_SEED: process.env.ALLOW_DEMO_SEED || 'true',
  ALLOW_SEED_DATA_CLEANUP: process.env.ALLOW_SEED_DATA_CLEANUP || 'false',
  ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS || 'false',
});

console.log('[backend-dev-local] Starting backend with local development defaults.');
console.log('[backend-dev-local] DATABASE_URL=postgresql://projtrack:****@127.0.0.1:5432/projtrack?schema=public');
console.log(`[backend-dev-local] MAIL_PROVIDER=${process.env.MAIL_PROVIDER}; MAIL_WORKER_ENABLED=${process.env.MAIL_WORKER_ENABLED}`);

require('ts-node/register');
require(path.resolve(__dirname, '../src/main.ts'));
