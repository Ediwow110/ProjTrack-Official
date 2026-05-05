import { expect, test, type Page } from '@playwright/test';

const accounts = [
  {
    role: 'student',
    identifier: process.env.SMOKE_STUDENT_IDENTIFIER || '',
    password: process.env.SMOKE_STUDENT_PASSWORD || '',
    identifierLabel: /Email or Student ID/i,
    dashboardPath: '/student/dashboard',
    buttonName: /^Sign In$/i,
    cardKicker: /Student Portal Login/i,
    dashboardAssertion: /Submit Project/i,
  },
  {
    role: 'teacher',
    identifier: process.env.SMOKE_TEACHER_IDENTIFIER || '',
    password: process.env.SMOKE_TEACHER_PASSWORD || '',
    identifierLabel: /Email or Teacher ID/i,
    dashboardPath: '/teacher/dashboard',
    buttonName: /Sign In as Teacher/i,
    cardKicker: /Teacher Portal Login/i,
    dashboardAssertion: /Review Submissions/i,
  },
  {
    role: 'admin',
    identifier: process.env.SMOKE_ADMIN_IDENTIFIER || '',
    password: process.env.SMOKE_ADMIN_PASSWORD || '',
    identifierLabel: /Email or Admin ID/i,
    dashboardPath: '/admin/dashboard',
    buttonName: /Sign In as Admin/i,
    cardKicker: /Admin Portal Login/i,
    dashboardAssertion: /^System Status$/i,
  },
] as const;

const hasSmokeCredentials = accounts.every(
  (account) => Boolean(String(account.identifier).trim()) && Boolean(String(account.password).trim()),
);

test.skip(!hasSmokeCredentials, 'Set SMOKE_* identifiers and passwords before running e2e auth smoke.');

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto(`/${account.role}/login`);
  await assertNoViteOverlay(page);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
}

async function assertNoViteOverlay(page: Page) {
  await expect(page.getByText(/\[plugin:vite:esbuild\]|The service is no longer running/i)).toHaveCount(0);
}

test('home route lands directly on the student login portal', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.waitForURL(/\/student\/login$/);
  await assertNoViteOverlay(page);
  await expect(page.getByRole('heading', { name: /Welcome Back!/i, level: 2 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/Student Portal Login/i)).toBeVisible();
});

test('protected routes redirect unauthenticated users to the matching login page', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await assertNoViteOverlay(page);
  await expect(page.getByRole('heading', { name: /Welcome Back!/i, level: 2 })).toBeVisible();
  await expect(page.getByText(/Admin Portal Login/i)).toBeVisible();
});

for (const account of accounts) {
  test(`${account.role} can sign in and reach the dashboard`, async ({ page }) => {
    await login(page, account);
    await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`));
    if (account.role === 'admin') {
      await expect(page.getByRole('heading', { name: account.dashboardAssertion })).toBeVisible();
      return;
    }
    await expect(page.getByText(account.dashboardAssertion)).toBeVisible();
  });
}
