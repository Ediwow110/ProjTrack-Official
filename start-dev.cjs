#!/usr/bin/env node
/**
 * start-dev.cjs
 *
 * One-command dev launcher for ProjTrack.
 * Kills stale processes on ports 3001 and 5173, then starts:
 *   1. Backend (with watchdog — auto-restarts on crash)
 *   2. Frontend (Vite dev server)
 *
 * Usage:
 *   node start-dev.cjs
 *
 * Both processes run in the foreground. Press Ctrl+C to stop both.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname);
const BACKEND_SCRIPT = path.join(ROOT, 'backend', 'start-with-watchdog.cjs');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

function log(tag, msg) {
  console.error(`[${tag}] ${msg}`);
}

// ── Kill stale processes ──────────────────────────────────────────────
function killProcess(port) {
  try {
    const { execSync } = require('child_process');
    execSync(`npx kill-port ${port}`, { stdio: 'ignore', timeout: 5000 });
  } catch {}
  log('init', `Killed stale process on port ${port}`);
}

log('init', '=== ProjTrack Dev Launcher ===');
killProcess(3001);
killProcess(5173);

// ── Start backend with watchdog ───────────────────────────────────────
const backend = spawn(process.execPath, [BACKEND_SCRIPT], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
  cwd: path.join(ROOT, 'backend'),
});
backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
backend.stderr.on('data', (d) => process.stderr.write(`[watchdog] ${d}`));
log('init', `Backend watchdog started (PID ${backend.pid})`);

// ── Start frontend (Vite) ─────────────────────────────────────────────
const frontend = spawn(process.execPath, [VITE_BIN, '--port', '5173', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
  cwd: ROOT,
});
frontend.stdout.on('data', (d) => process.stdout.write(`[frontend] ${d}`));
frontend.stderr.on('data', (d) => process.stderr.write(`[frontend] ${d}`));
log('init', `Frontend Vite started (PID ${frontend.pid})`);

// ── Graceful shutdown ─────────────────────────────────────────────────
function shutdown(signal) {
  log('init', `Received ${signal} — shutting down...`);
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Keep running
setInterval(() => {}, 2 ** 31).unref();
