#!/usr/bin/env node
/**
 * Backup/restore drill.
 *
 * Performs a `pg_dump` of `BACKUP_DRILL_SOURCE_DATABASE_URL` and restores it
 * into `BACKUP_DRILL_TARGET_DATABASE_URL`. The TARGET must be marked as
 * disposable; the script refuses to touch a target that even smells like a
 * production database.
 *
 * After restore, the script verifies that a list of expected tables exists
 * and that none of them are empty (configurable). Exits 0 only when every
 * verification passes.
 *
 * Required env:
 *   - BACKUP_DRILL_SOURCE_DATABASE_URL  (read-only is fine)
 *   - BACKUP_DRILL_TARGET_DATABASE_URL  (will be CLOBBERED)
 *   - BACKUP_DRILL_CONFIRM_DISPOSABLE   (must equal "YES_I_UNDERSTAND")
 *
 * Optional env:
 *   - BACKUP_DRILL_EXPECTED_TABLES  (comma-separated; default below)
 *
 * This script wraps `pg_dump` and `psql` from the host. It does not run
 * unattended in CI by default; CI uses the lighter worker/runtime checks.
 *
 * Run locally:
 *   BACKUP_DRILL_SOURCE_DATABASE_URL=...staging... \
 *   BACKUP_DRILL_TARGET_DATABASE_URL=...disposable... \
 *   BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND \
 *     node backend/scripts/backup-restore-drill.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function fail(msg, code = 2) {
  console.error(`backup-restore-drill: ${msg}`);
  process.exit(code);
}

const SOURCE = process.env.BACKUP_DRILL_SOURCE_DATABASE_URL;
const TARGET = process.env.BACKUP_DRILL_TARGET_DATABASE_URL;
const CONFIRM = process.env.BACKUP_DRILL_CONFIRM_DISPOSABLE;

if (!SOURCE) fail('BACKUP_DRILL_SOURCE_DATABASE_URL is required.');
if (!TARGET) fail('BACKUP_DRILL_TARGET_DATABASE_URL is required.');
if (CONFIRM !== 'YES_I_UNDERSTAND') {
  fail('BACKUP_DRILL_CONFIRM_DISPOSABLE must equal "YES_I_UNDERSTAND" to acknowledge the target will be clobbered.');
}

// Hard guard against accidental production target.
const PROD_PATTERNS = [
  /projtrack-prod/i,
  /projtrack_prod/i,
  /prod\.projtrack/i,
  /production\.projtrack/i,
  /production-host/i,
  /\.projtrack\.codes/i,
];
for (const p of PROD_PATTERNS) {
  if (p.test(TARGET)) {
    fail(`Target URL appears to be production (matched ${p}). REFUSING.`);
  }
}

// Soft guard: target should look disposable.
const DISPOSABLE_HINTS = /(disposable|drill|scratch|throwaway|tmp|temp|test)/i;
if (!DISPOSABLE_HINTS.test(TARGET)) {
  fail('Target URL must contain one of: disposable, drill, scratch, throwaway, tmp, temp, test. REFUSING.');
}

const EXPECTED_TABLES = (process.env.BACKUP_DRILL_EXPECTED_TABLES ||
  'User,StudentProfile,TeacherProfile,Submission,SubjectSection,EmailJob,BackupRun')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function which(bin) {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

if (!which('pg_dump')) fail('pg_dump not found on PATH. Install postgresql-client.');
if (!which('psql')) fail('psql not found on PATH. Install postgresql-client.');

const workdir = mkdtempSync(path.join(tmpdir(), 'projtrack-backup-drill-'));
const dumpFile = path.join(workdir, 'source.sql');
console.log(`drill workdir: ${workdir}`);

function step(label, cmd, args, opts = {}) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd} ${args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) fail(`step "${label}" failed with exit ${result.status}`, 1);
}

try {
  step('dump source', 'pg_dump', ['--no-owner', '--no-privileges', '--clean', '--if-exists', '-f', dumpFile, SOURCE]);
  if (!existsSync(dumpFile) || statSync(dumpFile).size === 0) fail('dump file is empty.', 1);
  const dumpBytes = statSync(dumpFile).size;
  console.log(`  dump size: ${dumpBytes} bytes`);

  step('restore into disposable target', 'psql', ['--quiet', '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', dumpFile, TARGET]);

  console.log('\n▶ verify expected tables present and non-empty');
  const failures = [];
  for (const t of EXPECTED_TABLES) {
    const r = spawnSync('psql', ['-tA', '-c', `SELECT count(*) FROM "${t}"`, TARGET], { encoding: 'utf8' });
    if (r.status !== 0) {
      failures.push(`${t}: query failed (${(r.stderr || '').trim().slice(0, 200)})`);
      continue;
    }
    const n = Number((r.stdout || '').trim());
    if (!Number.isFinite(n)) {
      failures.push(`${t}: non-numeric row count (${(r.stdout || '').trim()})`);
      continue;
    }
    console.log(`  ${t}: ${n} rows`);
    if (n === 0 && process.env.BACKUP_DRILL_ALLOW_EMPTY !== 'true') {
      failures.push(`${t}: 0 rows (set BACKUP_DRILL_ALLOW_EMPTY=true to permit empty)`);
    }
  }

  if (failures.length) {
    console.error('\nbackup-restore-drill FAILED:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('\nbackup-restore-drill PASSED');
} finally {
  try { rmSync(workdir, { recursive: true, force: true }); } catch (_) {}
}
