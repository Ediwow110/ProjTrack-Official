import { expect, test, type Locator, type Page } from '@playwright/test';
import { smokeCredentials } from './helpers/smoke-credentials';

const accounts = [
  { role: 'student', identifierLabel: /Email or Student ID/i, buttonName: /^Sign In$/i, dashboardPath: '/student/dashboard', get identifier() { return smokeCredentials.student.identifier; }, get password() { return smokeCredentials.student.password; } },
  { role: 'teacher', identifierLabel: /Email or Teacher ID/i, buttonName: /Sign In as Teacher/i, dashboardPath: '/teacher/dashboard', get identifier() { return smokeCredentials.teacher.identifier; }, get password() { return smokeCredentials.teacher.password; } },
  { role: 'admin', identifierLabel: /Email or Admin ID/i, buttonName: /Sign In as Admin/i, dashboardPath: '/admin/dashboard', get identifier() { return smokeCredentials.admin.identifier; }, get password() { return smokeCredentials.admin.password; } },
] as const;

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`), { timeout: 30_000 });
}

async function expectMinTarget(locator: Locator, name: string, minimum = 40) {
  const box = await locator.boundingBox();
  expect(box, `${name} has no bounding box`).not.toBeNull();
  expect(box!.height, `${name} height is below ${minimum}px`).toBeGreaterThanOrEqual(minimum);
  expect(box!.width, `${name} width is below ${minimum}px`).toBeGreaterThanOrEqual(minimum);
}

for (const account of accounts) {
  test(`${account.role} critical mobile controls have usable touch targets`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await login(page, account);
      await expectMinTarget(page.getByRole('button', { name: new RegExp(`Open .*${account.role}.*navigation`, 'i') }), 'mobile nav button');
      await expectMinTarget(page.getByRole('button', { name: /Switch to (dark|light) mode/i }), 'theme toggle');
      await expectMinTarget(page.getByRole('button', { name: /notifications/i }).first(), 'notification control');
      await expectMinTarget(page.getByRole('button', { name: new RegExp(`Open ${account.role} profile`, 'i') }), 'profile avatar button');

      await page.getByRole('button', { name: new RegExp(`Open .*${account.role}.*navigation`, 'i') }).click();
      await expectMinTarget(page.getByRole('button', { name: new RegExp(`Close .*${account.role}.*navigation`, 'i') }), 'drawer close button');
      const firstNavLink = page.locator('.portal-mobile-drawer a').first();
      await expect(firstNavLink).toBeVisible();
      const firstNavBox = await firstNavLink.boundingBox();
      expect(firstNavBox?.height ?? 0, 'first drawer nav link height').toBeGreaterThanOrEqual(40);
    } finally {
      await context.close();
    }
  });
}
