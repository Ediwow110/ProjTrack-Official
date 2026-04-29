import { execFileSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { backendDir, backendUrl, tryFetchJson } from './local-stack-utils.mjs';
import { localBackendEnv } from './local-backend-env.mjs';

function exists(relativePath) {
  return fs.existsSync(path.join(backendDir, relativePath));
}

function commandOk(command, args) {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function portOpen(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function status(label, ok, detail = '') {
  console.log(`${ok ? '[OK]  ' : '[WARN]'} ${label}${detail ? ` - ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.log(`[FAIL] ${label}${detail ? ` - ${detail}` : ''}`);
}

async function main() {
  console.log('ProjTrack backend local doctor');
  console.log('This check does not print secrets. It verifies the local development path only.');

  const hasRootNodeModules = fs.existsSync(path.resolve(backendDir, '..', 'node_modules'));
  const hasBackendNodeModules = exists('node_modules');
  const hasPrismaClient = exists('node_modules/.prisma/client/index.js') || exists('node_modules/@prisma/client');
  const hasBackendEnv = exists('.env');
  const dockerInstalled = commandOk(process.platform === 'win32' ? 'docker.exe' : 'docker', ['--version']);
  const dockerRunning = commandOk(process.platform === 'win32' ? 'docker.exe' : 'docker', ['info']);
  const postgresOpen = await portOpen(5432);
  const backendLive = await tryFetchJson(`${backendUrl}/health/live`);

  status('Root dependencies', hasRootNodeModules, hasRootNodeModules ? 'root node_modules exists' : 'run npm install from project root');
  status('Backend dependencies', hasBackendNodeModules, hasBackendNodeModules ? 'backend node_modules exists' : 'run npm --prefix backend install');
  status('Prisma client', hasPrismaClient, hasPrismaClient ? 'generated client found' : 'run npm run prepare:local or npm --prefix backend run prisma:generate');
  status('backend/.env file', hasBackendEnv, hasBackendEnv ? 'present; local start scripts override unsafe production-like values' : 'not required for local start because scripts inject safe local env');
  status('Docker CLI', dockerInstalled, dockerInstalled ? 'available' : 'install/start Docker Desktop, or point DATABASE_URL at your own Postgres');
  status('Docker engine', dockerRunning, dockerRunning ? 'running' : 'start Docker Desktop before npm start');
  status('PostgreSQL port 5432', postgresOpen, postgresOpen ? 'reachable on 127.0.0.1' : 'run npm run prepare:local');
  status('Backend /health/live', Boolean(backendLive.ok), backendLive.ok ? 'backend is running' : 'backend not responding on port 3001');

  console.log('');
  console.log('Local backend env used by npm start / npm run backend:local:');
  console.log(`- NODE_ENV=${localBackendEnv.NODE_ENV}`);
  console.log(`- APP_ENV=${localBackendEnv.APP_ENV}`);
  console.log('- DATABASE_URL=postgresql://projtrack:****@127.0.0.1:5432/projtrack?schema=public');
  console.log(`- MAIL_PROVIDER=${localBackendEnv.MAIL_PROVIDER}`);
  console.log(`- MAIL_WORKER_ENABLED=${localBackendEnv.MAIL_WORKER_ENABLED}`);
  console.log(`- OBJECT_STORAGE_MODE=${localBackendEnv.OBJECT_STORAGE_MODE}`);

  if (!dockerInstalled || !dockerRunning || !postgresOpen || !hasBackendNodeModules || !hasPrismaClient || !backendLive.ok) {
    console.log('');
    console.log('Recommended repair sequence:');
    console.log('1. npm install');
    console.log('2. npm --prefix backend install');
    console.log('3. Start Docker Desktop');
    console.log('4. npm run prepare:local');
    console.log('5. npm run backend:local');
    console.log('6. npm run doctor:local');
  }

  if (!dockerInstalled || !dockerRunning || !postgresOpen || !hasBackendNodeModules || !hasPrismaClient) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  fail('Backend doctor crashed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
