import { spawn } from 'node:child_process';
import process from 'node:process';

const viteBin = process.platform === 'win32'
  ? '.\\node_modules\\.bin\\vite.cmd'
  : './node_modules/.bin/vite';

const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', '5173'], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    VITE_USE_BACKEND: process.env.VITE_USE_BACKEND || 'true',
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
    VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL || 'http://127.0.0.1:5173',
  },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
