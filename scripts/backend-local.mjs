import { spawn } from 'node:child_process';
import { backendDir, nodeCommand, terminateProcessTree } from './local-stack-utils.mjs';
import { withLocalBackendEnv } from './local-backend-env.mjs';

console.log('[backend-local] Starting backend with local development settings.');
console.log(`[backend-local] DATABASE_URL=${withLocalBackendEnv().DATABASE_URL.replace(/:([^:]+)@/, ':****@')}`);
console.log('[backend-local] Mail provider is stub and the HTTP mail worker is disabled.');

const child = spawn(nodeCommand, ['-r', 'ts-node/register', 'src/main.ts'], {
  cwd: backendDir,
  env: withLocalBackendEnv(),
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
