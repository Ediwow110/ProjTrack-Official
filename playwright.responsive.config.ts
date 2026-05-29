import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const frontendPort = Number(process.env.PLAYWRIGHT_RESPONSIVE_PORT || 4174);
const backendPort = Number(process.env.PLAYWRIGHT_RESPONSIVE_BACKEND_PORT || 3102);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true'
  ? true
  : !process.env.CI;
const backendCwd = resolve(rootDir, 'backend');
const frontendViteCommand =
  process.platform === 'win32'
    ? 'scripts\\run-playwright-frontend.cmd'
    : `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${frontendPort}`;
const backendCommand =
  process.platform === 'win32'
    ? '..\\scripts\\run-playwright-backend.cmd'
    : 'node -r ts-node/register src/main.ts';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:authenticated-responsive|responsive-critical-pages|portal-drawer-responsive|touch-targets|mobile-forms|accessibility-critical)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      cwd: backendCwd,
      url: `${backendUrl}/health/live`,
      timeout: 120000,
      reuseExistingServer,
      env: {
        ...process.env,
        PORT: String(backendPort),
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://projtrack:projtrack@localhost:5432/projtrack',
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'responsive-playwright-access-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'responsive-playwright-refresh-secret',
        APP_URL: frontendUrl,
        FRONTEND_URL: frontendUrl,
        BACKEND_URL: backendUrl,
        CORS_ORIGINS: `${frontendUrl},http://localhost:${frontendPort}`,
        MAIL_PROVIDER: process.env.MAIL_PROVIDER || 'stub',
        MAIL_FROM: process.env.MAIL_FROM || 'noreply@projtrack.local',
        MAIL_WORKER_ENABLED: process.env.MAIL_WORKER_ENABLED || 'false',
        MAIL_WORKER_POLL_MS: process.env.MAIL_WORKER_POLL_MS || '60000',
        FILE_STORAGE_MODE: process.env.FILE_STORAGE_MODE || 'local',
        OBJECT_STORAGE_MODE: process.env.OBJECT_STORAGE_MODE || 'local',
        HTTP_RATE_LIMIT_STORE: process.env.HTTP_RATE_LIMIT_STORE || 'memory',
        FILE_MALWARE_SCAN_MODE: process.env.FILE_MALWARE_SCAN_MODE || 'disabled',
        BACKUP_WORKER_ENABLED: process.env.BACKUP_WORKER_ENABLED || 'false',
        BACKUP_SCHEDULE_ENABLED: process.env.BACKUP_SCHEDULE_ENABLED || 'false',
        BACKUP_WORKER_POLL_MS: process.env.BACKUP_WORKER_POLL_MS || '60000',
      },
    },
    {
      command: frontendViteCommand,
      cwd: rootDir,
      url: `${frontendUrl}/student/login`,
      timeout: 120000,
      reuseExistingServer,
      env: {
        ...process.env,
        PLAYWRIGHT_FRONTEND_PORT: String(frontendPort),
        VITE_USE_BACKEND: 'true',
        VITE_API_BASE_URL: backendUrl,
      },
    },
  ],
});
