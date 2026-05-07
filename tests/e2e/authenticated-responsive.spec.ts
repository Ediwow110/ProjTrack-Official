import { expect, test, type Page } from '@playwright/test';
import { smokeCredentials } from './helpers/smoke-credentials';

/**
 * Authenticated responsive QA across the three role dashboards.
 *
 * Requires the SMOKE_* env vars and the smoke fixtures (`npm run seed:smoke`).
 * Test list is intentionally narrow: log in as each role, hit the role's
 * dashboard at three target viewports, and assert there is no body-level
 * horizontal overflow plus the primary shell is visible.
 *
 * No brittle text assertions, no role-specific page deep-dives. Treat this as
 * the "roof check" for authenticated pages; deeper authenticated QA belongs in
 * portal-navigation.spec.ts and workflow-smoke.spec.ts.
 */

const accounts = [
  {
    role: 'student',
    identifier: smokeCredentials.student.identifier,
    password: smokeCredentials.student.password,
    identifierLabel: /Email or Student ID/i,
    buttonName: /^Sign In$/i,
    dashboardPath: '/student/dashboard',
  },
  {
    role: 'teacher',
    identifier: smokeCredentials.teacher.identifier,
    password: smokeCredentials.teacher.password,
    identifierLabel: /Email or Teacher ID/i,
    buttonName: /Sign In as Teacher/i,
    dashboardPath: '/teacher/dashboard',
  },
  {
    role: 'admin',
    identifier: smokeCredentials.admin.identifier,
    password: smokeCredentials.admin.password,
    identifierLabel: /Email or Admin ID/i,
    buttonName: /Sign In as Admin/i,
    dashboardPath: '/admin/dashboard',
  },
] as const;

const viewports = [
  { width: 390, height: 844, label: 'mobile-iphone-12' },
  { width: 768, height: 1024, label: 'tablet-ipad' },
  { width: 1440, height: 900, label: 'desktop-1440' },
] as const;


async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`), {
    timeout: 30_000,
  });
}

for (const account of accounts) {
  for (const viewport of viewports) {
    test(`${account.role} dashboard fits at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      try {
        await login(page, account);
        // Wait for any role landing animation/data to settle.
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

        // 1. No body/document horizontal overflow.
        const overflow = await page.evaluate(() => ({
          documentScrollWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
        }));
        expect(overflow.documentScrollWidth, `documentElement horizontal overflow on ${account.role} dashboard at ${viewport.width}x${viewport.height}`)
          .toBeLessThanOrEqual(overflow.documentClientWidth + 1);
        expect(overflow.bodyScrollWidth, `body horizontal overflow on ${account.role} dashboard at ${viewport.width}x${viewport.height}`)
          .toBeLessThanOrEqual(overflow.bodyClientWidth + 1);

        // 2. App shell is visible (any <main> element should exist and be displayed).
        const mainCount = await page.locator('main').count();
        expect(mainCount, `expected at least one <main> on ${account.role} dashboard`).toBeGreaterThan(0);

        // 3. We are not on an obvious error page.
        await expect(page.getByText(/Unexpected Application Error!/i)).toHaveCount(0);
        await expect(page.getByText(/\[plugin:vite:esbuild\]|The service is no longer running/i)).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
}
