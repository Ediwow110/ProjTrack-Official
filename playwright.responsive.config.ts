import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const frontendPort = Number(process.env.PLAYWRIGHT_RESPONSIVE_PORT || 4174);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true'
  ? true
  : !process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /auth-responsive\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
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
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${frontendPort}`,
    cwd: rootDir,
    url: `${frontendUrl}/student/login`,
    timeout: 120000,
    reuseExistingServer,
    env: {
      ...process.env,
      VITE_USE_BACKEND: 'false',
      VITE_API_BASE_URL: '',
    },
  },
});
