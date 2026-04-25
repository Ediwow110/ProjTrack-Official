import { expect, test, type Page } from '@playwright/test';

const accounts = [
  {
    role: 'student',
    identifier: process.env.SMOKE_STUDENT_IDENTIFIER || 'student@projtrack.local',
    password: process.env.SMOKE_STUDENT_PASSWORD || 'Student123!ChangeMe',
    identifierLabel: /Student ID or Email/i,
    dashboardPath: '/student/dashboard',
    buttonName: /Continue to Student Login/i,
    dashboardAssertion: /Submit Project/i,
  },
  {
    role: 'teacher',
    identifier: process.env.SMOKE_TEACHER_IDENTIFIER || 'teacher@projtrack.local',
    password: process.env.SMOKE_TEACHER_PASSWORD || 'Teacher123!ChangeMe',
    identifierLabel: /Employee ID or School Email/i,
    dashboardPath: '/teacher/dashboard',
    buttonName: /Continue to Teacher Login/i,
    dashboardAssertion: /Review Submissions/i,
  },
  {
    role: 'admin',
    identifier: process.env.SMOKE_ADMIN_IDENTIFIER || 'admin@projtrack.local',
    password: process.env.SMOKE_ADMIN_PASSWORD || 'Admin123!ChangeMe',
    identifierLabel: /Admin Email/i,
    dashboardPath: '/admin/dashboard',
    buttonName: /Continue to Admin Login/i,
    dashboardAssertion: /^System Status$/i,
  },
] as const;

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
}

test('home route lands directly on the student login portal', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.waitForURL(/\/student\/login$/);
  await expect(page.getByRole('heading', { name: /Student Login/i, level: 2 })).toBeVisible({
    timeout: 60_000,
  });
});

test('protected routes redirect unauthenticated users to the matching login page', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: /Admin Login/i, level: 2 })).toBeVisible();
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
