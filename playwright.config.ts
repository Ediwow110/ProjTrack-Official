import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const frontendPort = 4173;
const backendPort = 3101;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;
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
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
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
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: String(backendPort),
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://projtrack:projtrack@localhost:5432/projtrack',
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'playwright-access-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'playwright-refresh-secret',
        APP_URL: frontendUrl,
        FRONTEND_URL: frontendUrl,
        CORS_ORIGINS: `${frontendUrl},http://localhost:${frontendPort}`,
        MAIL_PROVIDER: process.env.MAIL_PROVIDER || 'stub',
        MAIL_FROM: process.env.MAIL_FROM || 'noreply@projtrack.local',
        FILE_STORAGE_MODE: process.env.FILE_STORAGE_MODE || 'local',
        OBJECT_STORAGE_MODE: process.env.OBJECT_STORAGE_MODE || 'local',
      },
    },
    {
      command: frontendViteCommand,
      url: `${frontendUrl}/login/student`,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PLAYWRIGHT_FRONTEND_PORT: String(frontendPort),
        VITE_USE_BACKEND: 'true',
        VITE_API_BASE_URL: backendUrl,
      },
    },
  ],
});
