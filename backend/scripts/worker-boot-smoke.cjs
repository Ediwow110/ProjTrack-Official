#!/usr/bin/env node
/**
 * Worker boot smoke check.
 *
 * Verifies:
 *   1. `node dist/worker.js` boots cleanly under a worker-shaped dev env
 *      (DB reachable, mail/backup workers enabled), logs the "Dedicated
 *      worker process started" line, and exits 0 on SIGTERM.
 *   2. With DATABASE_URL stripped, the worker fails fast with a non-zero
 *      exit and a runtime-safety error mentioning DATABASE_URL.
 *
 * Required env (positive case):
 *   - DATABASE_URL (the CI backend job's Postgres service container)
 *
 * The worker poll intervals are forced very high so the worker never
 * actually processes a job during the smoke window.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DIST_WORKER = path.join(BACKEND_ROOT, 'dist', 'worker.js');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('worker-boot-smoke: DATABASE_URL is required.');
  process.exit(2);
}

const READY_LINE = 'Dedicated worker process started';
const BOOT_TIMEOUT_MS = 30_000;

function workerDevEnv(overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    APP_ENV: 'development',
    DATABASE_URL,
    PORT: '3092',
    JWT_ACCESS_SECRET: 'worker-smoke-access-secret-not-real-0000000000000000000000',
    JWT_REFRESH_SECRET: 'worker-smoke-refresh-secret-not-real-000000000000000000000',
    ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    APP_URL: 'http://localhost:5173',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3092',
    CORS_ORIGINS: 'http://localhost:5173',
    MAIL_PROVIDER: 'stub',
    MAIL_FROM: 'noreply@projtrack.local',
    MAIL_WORKER_ENABLED: 'true',
    MAIL_WORKER_POLL_MS: '3600000',
    BACKUP_WORKER_ENABLED: 'true',
    BACKUP_SCHEDULE_ENABLED: 'true',
    BACKUP_WORKER_POLL_MS: '3600000',
    BACKUP_LOCAL_DIR: 'data/system-tools/backups',
    OBJECT_STORAGE_MODE: 'local',
    FILE_STORAGE_MODE: 'local',
    HTTP_RATE_LIMIT_STORE: 'memory',
    FILE_MALWARE_SCAN_MODE: 'disabled',
    TESTMAIL_ENABLED: 'false',
    ...overrides,
  };
}

function bootWorker(env, { expectReady }) {
  return new Promise((resolve) => {
    const child = spawn('node', [DIST_WORKER], {
      cwd: BACKEND_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let ready = false;
    let resolved = false;

    const onReady = () => {
      if (resolved) return;
      ready = true;
      // Send SIGTERM and wait for clean exit.
      try { child.kill('SIGTERM'); } catch (_) {}
    };

    child.stdout.on('data', (c) => {
      stdout += c;
      if (!ready && stdout.includes(READY_LINE)) onReady();
    });
    child.stderr.on('data', (c) => {
      stderr += c;
      if (!ready && stderr.includes(READY_LINE)) onReady();
    });

    const killTimer = setTimeout(() => {
      if (resolved) return;
      try { child.kill('SIGKILL'); } catch (_) {}
    }, BOOT_TIMEOUT_MS);

    child.on('exit', (code, signal) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(killTimer);
      resolve({ code, signal, ready, stdout, stderr });
    });
  });
}

async function main() {
  const failures = [];

  console.log('▶ positive: worker should boot, log ready, exit 0 on SIGTERM');
  const positive = await bootWorker(workerDevEnv(), { expectReady: true });
  if (!positive.ready) {
    failures.push({
      case: 'worker did not log ready line',
      stderr: positive.stderr.slice(-1500),
      stdout: positive.stdout.slice(-1500),
    });
  } else if (positive.code !== 0 && positive.signal !== 'SIGTERM') {
    failures.push({
      case: `worker exit code ${positive.code} (signal=${positive.signal}) after SIGTERM`,
      stderr: positive.stderr.slice(-1500),
    });
  } else {
    console.log('  ✓ worker booted and exited cleanly');
  }

  console.log('▶ negative: worker should refuse boot when DATABASE_URL missing');
  const negEnv = workerDevEnv();
  delete negEnv.DATABASE_URL;
  const negative = await bootWorker(negEnv, { expectReady: false });
  const negCombined = `${negative.stdout}\n${negative.stderr}`;
  if (negative.ready) {
    failures.push({ case: 'negative case unexpectedly reported ready' });
  } else if (negative.code === 0) {
    failures.push({ case: 'negative case exited 0 (expected non-zero)' });
  } else if (!/DATABASE_URL/.test(negCombined)) {
    failures.push({
      case: 'negative case did not mention DATABASE_URL in output',
      stderr: negative.stderr.slice(-1500),
    });
  } else {
    console.log('  ✓ refused boot with DATABASE_URL error');
  }

  if (failures.length) {
    console.error(`\nworker-boot-smoke FAILED (${failures.length} case(s)):`);
    for (const f of failures) {
      console.error(`- ${f.case}`);
      if (f.stderr) console.error(`  stderr tail: ${f.stderr.replace(/\n/g, '\n    ')}`);
      if (f.stdout) console.error(`  stdout tail: ${f.stdout.replace(/\n/g, '\n    ')}`);
    }
    process.exit(1);
  }

  console.log('\nworker-boot-smoke PASSED');
}

main().catch((err) => {
  console.error('worker-boot-smoke crashed:', err);
  process.exit(1);
});
