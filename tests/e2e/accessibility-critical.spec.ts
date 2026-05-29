import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { smokeCredentials } from './helpers/smoke-credentials';

const accounts = {
  student: { role: 'student', identifierLabel: /Email or Student ID/i, buttonName: /^Sign In$/i, dashboardPath: '/student/dashboard', get identifier() { return smokeCredentials.student.identifier; }, get password() { return smokeCredentials.student.password; } },
  teacher: { role: 'teacher', identifierLabel: /Email or Teacher ID/i, buttonName: /Sign In as Teacher/i, dashboardPath: '/teacher/dashboard', get identifier() { return smokeCredentials.teacher.identifier; }, get password() { return smokeCredentials.teacher.password; } },
  admin: { role: 'admin', identifierLabel: /Email or Admin ID/i, buttonName: /Sign In as Admin/i, dashboardPath: '/admin/dashboard', get identifier() { return smokeCredentials.admin.identifier; }, get password() { return smokeCredentials.admin.password; } },
} as const;

async function login(page: Page, account: typeof accounts[keyof typeof accounts]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`), { timeout: 30_000 });
  await page.getByText('Signed in successfully.').waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
}

async function expectNoCriticalOrSeriousAxeViolations(page: Page, routeName: string) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-sonner-toaster]')
    .analyze();
  const blockers = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(blockers, `${routeName} has critical/serious axe violations: ${blockers.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
}

test.describe('critical accessibility checks', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ['/student/login', '/teacher/login', '/admin/login']) {
    test(`${route} has no critical or serious axe violations`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('form')).toBeVisible();
      await expectNoCriticalOrSeriousAxeViolations(page, route);
    });
  }

  for (const [role, account] of Object.entries(accounts)) {
    test(`${role} dashboard and drawer have no critical or serious axe violations`, async ({ page }) => {
      await login(page, account);
      await expectNoCriticalOrSeriousAxeViolations(page, `${role} dashboard`);
      await page.getByRole('button', { name: new RegExp(`Open .*${role}.*navigation`, 'i') }).click();
      await expectNoCriticalOrSeriousAxeViolations(page, `${role} mobile drawer`);
    });
  }
});
