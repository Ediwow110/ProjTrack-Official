import { spawn } from 'node:child_process';
import { backendDir, nodeCommand, terminateProcessTree } from './local-stack-utils.mjs';
import { detectLocalBackendEnvSources, withLocalBackendEnv } from './local-backend-env.mjs';

const backendEnv = withLocalBackendEnv({ MAIL_WORKER_ENABLED: 'false' });
const envSources = detectLocalBackendEnvSources();

console.log('[backend-local] Starting backend with local development settings.');
console.log(`[backend-local] DATABASE_URL=${backendEnv.DATABASE_URL.replace(/:([^:]+)@/, ':****@')}`);
console.log(
  `[backend-local] MAIL_PROVIDER=${backendEnv.MAIL_PROVIDER}; MAIL_WORKER_ENABLED=${backendEnv.MAIL_WORKER_ENABLED}; MAILRELAY_API_KEY=${backendEnv.MAILRELAY_API_KEY ? 'SET' : 'MISSING'}`,
);
console.log(
  envSources.length
    ? `[backend-local] Env sources: ${envSources.join(', ')}`
    : '[backend-local] Env sources: none; using defaults and current shell env.',
);

const child = spawn(nodeCommand, ['-r', 'ts-node/register', 'src/main.ts'], {
  cwd: backendDir,
  env: backendEnv,
  stdio: 'inherit',
});

const shutdown = async (signal) => {
  console.log(`[backend-local] Received ${signal}; stopping backend.`);
  await terminateProcessTree(child);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`[backend-local] Backend failed to start: ${error.message}`);
  process.exit(1);
});
