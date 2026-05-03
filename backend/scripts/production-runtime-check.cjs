#!/usr/bin/env node
/**
 * Production runtime boot check.
 *
 * Spawns `node dist/main.js` under a synthetic production-like env and
 * verifies that:
 *   1. `inspectRuntimeConfiguration` does NOT block boot for a known-good
 *      production-like config.
 *   2. The server reaches HTTP listening state and `/health` returns 200.
 *   3. Boot is rejected (non-zero exit, runtime-safety error in stderr) for
 *      each known-bad production config permutation. This proves fail-closed
 *      behaviour end-to-end, not just at the unit level.
 *
 * Required env when invoked from CI:
 *   - DATABASE_URL  (a reachable Postgres; CI backend job already has one)
 *
 * No real mail / S3 / ClamAV connectivity is required: the configured
 * production validators only check that env values are *present and shaped*,
 * not that they are reachable. Outbound traffic to Mailrelay / S3 / ClamAV
 * never happens during the boot probe because no mail send / file upload
 * traffic is generated.
 *
 * Run locally:
 *   cd backend
 *   npm run build
 *   DATABASE_URL=postgresql://... node scripts/production-runtime-check.cjs
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DIST_MAIN = path.join(BACKEND_ROOT, 'dist', 'main.js');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('production-runtime-check: DATABASE_URL is required.');
  process.exit(2);
}

const PORT = process.env.RUNTIME_CHECK_PORT || '3091';

/**
 * Build a known-good production-like env. Values are non-real placeholders
 * that satisfy every static check in runtime-safety.ts. They are NOT real
 * credentials and the process never opens an outbound connection that uses
 * them within the boot window we measure.
 */
function goodProdEnv(overrides = {}) {
  return {
    ...process.env,
    PORT,
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL,
    JWT_ACCESS_SECRET: 'prod-access-secret-runtime-check-not-real-000000000000000000',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-runtime-check-not-real-00000000000000000',
    JWT_ISSUER: 'projtrack-api',
    JWT_AUDIENCE: 'projtrack-web',
    JWT_KEY_ID: 'runtime-check',
    ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    APP_URL: 'https://www.projtrack.codes',
    FRONTEND_URL: 'https://www.projtrack.codes',
    BACKEND_URL: 'https://api.projtrack.codes',
    CORS_ORIGINS: 'https://www.projtrack.codes',
    TRUST_PROXY: 'true',
    MAIL_PROVIDER: 'mailrelay',
    MAIL_FROM_NAME: 'ProjTrack',
    MAIL_FROM_ADMIN: 'admin@projtrack.codes',
    MAIL_FROM_NOREPLY: 'support@projtrack.codes',
    MAIL_FROM_INVITE: 'support@projtrack.codes',
    MAIL_FROM_NOTIFY: 'notification@projtrack.codes',
    MAIL_FROM_SUPPORT: 'support@projtrack.codes',
    MAILRELAY_API_KEY: 'mailrelay-runtime-check-not-real-00000000000000',
    MAILRELAY_API_URL: 'https://projtrack.ipzmarketing.com/api/v1',
    MAIL_WORKER_ENABLED: 'false',
    MAIL_WORKER_POLL_MS: '60000',
    OBJECT_STORAGE_MODE: 's3',
    S3_BUCKET: 'projtrack-runtime-check',
    S3_REGION: 'ap-southeast-1',
    S3_ENDPOINT: 'https://s3.ap-southeast-1.amazonaws.com',
    S3_ACCESS_KEY_ID: 'runtime-check-access-key-id',
    S3_SECRET_ACCESS_KEY: 'runtime-check-secret-access-key',
    S3_SIGNED_URL_TTL_SECONDS: '300',
    S3_BUCKET_PUBLIC: 'false',
    HTTP_RATE_LIMIT_STORE: 'database',
    FILE_MALWARE_SCAN_MODE: 'fail-closed',
    FILE_MALWARE_SCANNER: 'clamav',
    CLAMAV_HOST: 'clamav.runtime-check.local',
    CLAMAV_PORT: '3310',
    RUNTIME_SAFETY_ALLOW_LOCALHOST_DB: 'true',
    BACKUP_WORKER_ENABLED: 'false',
    BACKUP_SCHEDULE_ENABLED: 'false',
    BACKUP_WORKER_POLL_MS: '3600000',
    ALLOW_DEMO_SEED: 'false',
    ALLOW_SEED_DATA_CLEANUP: 'false',
    ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
    TESTMAIL_ENABLED: 'false',
    ...overrides,
  };
}

function fetchHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('health timeout')));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bootAndProbe(env, { expectOk, label, expectStderrIncludes }) {
  return new Promise((resolve) => {
    const child = spawn('node', [DIST_MAIN], {
      cwd: BACKEND_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));

    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      resolve(result);
    };

    child.on('exit', (code, signal) => {
      finish({ phase: 'exit', code, signal, stdout, stderr });
    });

    if (expectOk) {
      // Poll /health until 200 or timeout.
      (async () => {
        const deadline = Date.now() + 25_000;
        while (Date.now() < deadline) {
          await sleep(500);
          if (resolved) return;
          try {
            const r = await fetchHealth();
            if (r.status === 200) {
              try { child.kill('SIGTERM'); } catch (_) {}
              await sleep(2000);
              finish({ phase: 'healthy', code: 0, stdout, stderr });
              return;
            }
          } catch (_) { /* keep trying */ }
        }
        try { child.kill('SIGKILL'); } catch (_) {}
        finish({ phase: 'timeout', stdout, stderr });
      })();
    } else {
      // Should fail fast; give it 15s max.
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        finish({ phase: 'timeout', stdout, stderr });
      }, 15_000);
    }
  });
}

async function main() {
  const failures = [];

  // 1. Known-good prod env should boot and serve /health.
  console.log('▶ positive: known-good production env should boot');
  const good = await bootAndProbe(goodProdEnv(), { expectOk: true, label: 'good' });
  if (good.phase !== 'healthy') {
    failures.push({
      case: 'positive boot',
      detail: `phase=${good.phase} code=${good.code} signal=${good.signal}`,
      stderr: good.stderr.slice(-2000),
      stdout: good.stdout.slice(-2000),
    });
  } else {
    console.log('  ✓ booted and /health returned 200');
  }

  // 2. Known-bad permutations must fail boot with the expected error string.
  const negativeCases = [
    {
      label: 'weak JWT_ACCESS_SECRET',
      overrides: { JWT_ACCESS_SECRET: 'short' },
      expect: 'JWT_ACCESS_SECRET',
    },
    {
      label: 'localhost FRONTEND_URL',
      overrides: { FRONTEND_URL: 'http://localhost:5173' },
      expect: 'FRONTEND_URL',
    },
    {
      label: 'http (non-https) APP_URL',
      overrides: { APP_URL: 'http://www.projtrack.codes' },
      expect: 'APP_URL must use https',
    },
    {
      label: 'in-memory rate limit',
      overrides: { HTTP_RATE_LIMIT_STORE: 'memory' },
      expect: 'HTTP_RATE_LIMIT_STORE',
    },
    {
      label: 'malware scan disabled',
      overrides: { FILE_MALWARE_SCAN_MODE: 'disabled' },
      expect: 'FILE_MALWARE_SCAN_MODE',
    },
    {
      label: 'public S3 bucket',
      overrides: { S3_BUCKET_PUBLIC: 'true' },
      expect: 'S3_BUCKET_PUBLIC',
    },
    {
      label: 'TRUST_PROXY missing',
      overrides: { TRUST_PROXY: '' },
      expect: 'TRUST_PROXY',
    },
    {
      label: 'mail provider stub in production',
      overrides: { MAIL_PROVIDER: 'stub' },
      expect: 'MAIL_PROVIDER',
    },
    {
      label: 'shared access/refresh secret',
      overrides: { JWT_REFRESH_SECRET: 'prod-access-secret-runtime-check-not-real-000000000000000000' },
      expect: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET',
    },
    {
      label: 'local file storage',
      overrides: { OBJECT_STORAGE_MODE: 'local' },
      expect: 'OBJECT_STORAGE_MODE',
    },
  ];

  for (const c of negativeCases) {
    console.log(`▶ negative: ${c.label} should fail boot`);
    const r = await bootAndProbe(goodProdEnv(c.overrides), { expectOk: false, label: c.label });
    const combined = `${r.stdout}\n${r.stderr}`;
    const exitedNonZero = (typeof r.code === 'number' && r.code !== 0) || r.signal === 'SIGKILL'
      || r.phase === 'exit';
    const mentionsExpected = combined.includes(c.expect);
    if (!exitedNonZero || !mentionsExpected) {
      failures.push({
        case: `negative ${c.label}`,
        detail: `phase=${r.phase} code=${r.code} signal=${r.signal} mentionsExpected=${mentionsExpected}`,
        stderr: r.stderr.slice(-1500),
      });
    } else {
      console.log(`  ✓ refused boot, error mentioned "${c.expect}"`);
    }
  }

  if (failures.length) {
    console.error(`\nproduction-runtime-check FAILED (${failures.length} case(s)):`);
    for (const f of failures) {
      console.error(`- ${f.case}: ${f.detail}`);
      if (f.stderr) console.error(`  stderr tail: ${f.stderr.replace(/\n/g, '\n    ')}`);
      if (f.stdout) console.error(`  stdout tail: ${f.stdout.replace(/\n/g, '\n    ')}`);
    }
    process.exit(1);
  }

  console.log('\nproduction-runtime-check PASSED');
}

main().catch((err) => {
  console.error('production-runtime-check crashed:', err);
  process.exit(1);
});
