import { spawn } from 'node:child_process';
import { backendDir, nodeCommand, terminateProcessTree } from './local-stack-utils.mjs';
import { detectLocalBackendEnvSources, withLocalBackendEnv } from './local-backend-env.mjs';

const workerEnv = withLocalBackendEnv({
  MAIL_WORKER_ENABLED: 'true',
  BACKUP_WORKER_ENABLED: 'false',
});
const envSources = detectLocalBackendEnvSources();

console.log('[start-worker-local] Starting dedicated ProjTrack worker with local development settings.');
console.log(`[start-worker-local] DATABASE_URL=${workerEnv.DATABASE_URL.replace(/:([^:]+)@/, ':****@')}`);
console.log(`[start-worker-local] MAIL_PROVIDER=${workerEnv.MAIL_PROVIDER}`);
console.log(
  `[start-worker-local] MAILRELAY_API_KEY=${workerEnv.MAILRELAY_API_KEY ? 'SET' : 'MISSING'}`,
);
console.log(`[start-worker-local] MAIL_WORKER_ENABLED=${workerEnv.MAIL_WORKER_ENABLED}`);
console.log(
  envSources.length
    ? `[start-worker-local] Env sources: ${envSources.join(', ')}`
    : '[start-worker-local] Env sources: none; using defaults and current shell env.',
);

const child = spawn(nodeCommand, ['-r', 'ts-node/register', 'src/worker.ts'], {
  cwd: backendDir,
  env: workerEnv,
  stdio: 'inherit',
});

const shutdown = async (signal) => {
  console.log(`[start-worker-local] Received ${signal}; stopping worker.`);
  await terminateProcessTree(child);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`[start-worker-local] Worker failed to start: ${error.message}`);
  process.exit(1);
});
