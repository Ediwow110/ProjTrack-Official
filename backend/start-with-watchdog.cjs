#!/usr/bin/env node
/**
 * start-with-watchdog.cjs
 *
 * Spawns the NestJS backend (dist/main.js) and automatically restarts it
 * if it exits unexpectedly. Logs restart events to stderr.
 *
 * Usage:
 *   node start-with-watchdog.cjs            # starts with default port 3001
 *   PORT=3002 node start-with-watchdog.cjs  # starts on custom port
 *
 * The watchdog only restarts if the exit code is non-zero AND the process
 * ran for at least 5 seconds (avoids infinite loops on permanent failures).
 * It gives up after 10 consecutive restarts within 60 seconds.
 */

const { spawn } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, 'dist/main.js');
const RESTART_DELAY_MS = 2000;
const MIN_UPTIME_MS_FOR_RESTART = 5000;
const MAX_RESTARTS_IN_WINDOW = 10;
const RESTART_WINDOW_MS = 60_000;

let startCount = 0;
let lastRestartTimestamps = [];

function pruneRestartWindow() {
  const now = Date.now();
  lastRestartTimestamps = lastRestartTimestamps.filter((ts) => now - ts < RESTART_WINDOW_MS);
}

function shouldRestart(exitCode, uptimeMs) {
  if (exitCode === 0) return false;       // intentional shutdown
  if (uptimeMs < MIN_UPTIME_MS_FOR_RESTART) return false; // crash-on-boot, don't loop
  pruneRestartWindow();
  return lastRestartTimestamps.length < MAX_RESTARTS_IN_WINDOW;
}

function start() {
  startCount++;
  const child = spawn(process.execPath, [SCRIPT], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env },
  });

  const startedAt = Date.now();

  child.on('exit', (code, signal) => {
    const uptimeMs = Date.now() - startedAt;
    const signalMsg = signal ? `signal=${signal}` : '';
    const exitMsg = `exit code=${code} ${signalMsg} (uptime=${uptimeMs}ms, start=${startCount})`;

    if (shouldRestart(code, uptimeMs)) {
      console.error(`[watchdog] Process exited: ${exitMsg} — restarting in ${RESTART_DELAY_MS}ms`);
      lastRestartTimestamps.push(Date.now());
      setTimeout(start, RESTART_DELAY_MS);
    } else if (code !== 0) {
      console.error(`[watchdog] Process exited: ${exitMsg} — NOT restarting (rate limit or crash-on-boot)`);
    } else {
      console.error(`[watchdog] Process exited cleanly: ${exitMsg} — not restarting`);
    }
  });

  child.on('error', (err) => {
    console.error(`[watchdog] Failed to spawn process: ${err.message}`);
    // Retry on spawn error too
    lastRestartTimestamps.push(Date.now());
    setTimeout(start, RESTART_DELAY_MS);
  });
}

console.error(`[watchdog] Starting ProjTrack backend: ${SCRIPT}`);
start();
