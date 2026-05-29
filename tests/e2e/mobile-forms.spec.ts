import { expect, test, type Page } from '@playwright/test';
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
}

async function assertNoOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  expect(overflow.documentScrollWidth, `document overflow on ${path}`).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth, `body overflow on ${path}`).toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
}

test.describe('mobile form UX smoke', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const loginPath of ['/student/login', '/teacher/login', '/admin/login']) {
    test(`${loginPath} form fits and exposes validation on mobile`, async ({ page }) => {
      await page.goto(loginPath);
      await expect(page.locator('form')).toBeVisible();
      await expect(page.getByLabel(/Email or/i)).toBeVisible();
      await expect(page.getByLabel(/^Password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByText(/required|enter/i).first()).toBeVisible();
      await assertNoOverflow(page, loginPath);
    });
  }

  test('student submit form shell fits on mobile', async ({ page }) => {
    await login(page, accounts.student);
    await page.goto('/student/submit');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/submit/i).first()).toBeVisible();
    await expect(page.locator('input, textarea, button, [role="combobox"]').first()).toBeVisible();
    await assertNoOverflow(page, '/student/submit');
  });

  test('admin user management form controls fit on mobile', async ({ page }) => {
    await login(page, accounts.admin);
    await page.goto('/admin/users');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/users/i).first()).toBeVisible();
    await expect(page.locator('input, button, [role="combobox"]').first()).toBeVisible();
    await assertNoOverflow(page, '/admin/users');
  });
});
