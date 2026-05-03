#!/usr/bin/env node
/**
 * Staging smoke wrapper.
 *
 * Runs the existing `npm run smoke:real` workflow against a STAGING backend
 * and prints a clear PASS/FAIL summary suitable for CI logs and operator
 * eyeballs.
 *
 * Required env:
 *   - SMOKE_ADMIN_EMAIL
 *   - SMOKE_ADMIN_PASSWORD
 *   - DATABASE_URL (a STAGING database, not production)
 *
 * Optional env:
 *   - SMOKE_TEACHER_EMAIL / SMOKE_TEACHER_PASSWORD
 *   - SMOKE_STUDENT_EMAIL / SMOKE_STUDENT_PASSWORD
 *
 * Refuses to run when env smells like production. This is a defence-in-depth
 * guard; you must still point DATABASE_URL at a staging cluster.
 *
 * Local invocation:
 *   cd backend
 *   SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... \
 *     node scripts/staging-smoke-summary.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

function failGuard(reason) {
  console.error(`staging-smoke-summary REFUSED to run: ${reason}`);
  process.exit(2);
}

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) failGuard('DATABASE_URL is required and must point at staging.');
if (/projtrack-prod|projtrack_prod|prod\.projtrack|production\.projtrack/i.test(dbUrl)) {
  failGuard('DATABASE_URL looks like production. Refusing.');
}
if (!process.env.SMOKE_ADMIN_EMAIL || !process.env.SMOKE_ADMIN_PASSWORD) {
  failGuard('SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required.');
}

if (process.env.NODE_ENV === 'production' && !process.env.STAGING_SMOKE_OVERRIDE) {
  failGuard('NODE_ENV=production detected. Set STAGING_SMOKE_OVERRIDE=YES_I_AM_ON_STAGING to proceed.');
}

const env = {
  ...process.env,
  SMOKE_USE_REAL_ACCOUNTS: 'true',
  SMOKE_DEBUG_ERRORS: process.env.SMOKE_DEBUG_ERRORS || 'true',
};

const child = spawn('node', ['scripts/smoke.js', '--real-accounts'], {
  cwd: backendRoot,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (c) => { stdout += c; process.stdout.write(c); });
child.stderr.on('data', (c) => { stderr += c; process.stderr.write(c); });

child.on('exit', (code) => {
  const ok = code === 0;
  const combined = `${stdout}\n${stderr}`;
  const checks = [
    { id: 'login',       hit: /login/i.test(combined) },
    { id: 'refresh',     hit: /refresh/i.test(combined) },
    { id: 'logout',      hit: /logout/i.test(combined) },
    { id: 'profile',     hit: /profile/i.test(combined) },
    { id: 'health',      hit: /health/i.test(combined) },
  ];

  console.log('\n=== staging-smoke-summary ===');
  console.log(`overall:   ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`exit code: ${code}`);
  console.log('checks observed in smoke output:');
  for (const c of checks) {
    console.log(`  ${c.hit ? '✓' : '·'} ${c.id}`);
  }
  if (!ok) {
    console.log('\nSmoke run failed. Inspect the smoke output above for the failing assertion.');
  }
  process.exit(ok ? 0 : 1);
});
