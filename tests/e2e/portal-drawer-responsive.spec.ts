import { expect, test, type Page } from '@playwright/test';
import { smokeCredentials } from './helpers/smoke-credentials';

const accounts = [
  {
    role: 'student',
    get identifier() { return smokeCredentials.student.identifier; },
    get password() { return smokeCredentials.student.password; },
    identifierLabel: /Email or Student ID/i,
    buttonName: /^Sign In$/i,
    dashboardPath: '/student/dashboard',
    nextPath: '/student/subjects',
    navLabel: /^Subjects$/i,
  },
  {
    role: 'teacher',
    get identifier() { return smokeCredentials.teacher.identifier; },
    get password() { return smokeCredentials.teacher.password; },
    identifierLabel: /Email or Teacher ID/i,
    buttonName: /Sign In as Teacher/i,
    dashboardPath: '/teacher/dashboard',
    nextPath: '/teacher/students',
    navLabel: /^Students$/i,
  },
  {
    role: 'admin',
    get identifier() { return smokeCredentials.admin.identifier; },
    get password() { return smokeCredentials.admin.password; },
    identifierLabel: /Email or Admin ID/i,
    buttonName: /Sign In as Admin/i,
    dashboardPath: '/admin/dashboard',
    nextPath: '/admin/users',
    navLabel: /^Users$/i,
  },
] as const;

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`), { timeout: 30_000 });
}

for (const account of accounts) {
  test(`${account.role} mobile drawer opens, closes, and navigates`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await login(page, account);

      const menuButton = page.getByRole('button', { name: new RegExp(`Open .*${account.role}.*navigation`, 'i') });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(page.getByRole('button', { name: new RegExp(`Close .*${account.role}.*navigation`, 'i') })).toBeVisible();

      await page.locator('.portal-mobile-drawer-backdrop').evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole('button', { name: new RegExp(`Close .*${account.role}.*navigation`, 'i') })).toHaveCount(0);
      await expect(page.locator('.portal-mobile-drawer-backdrop')).toHaveCount(0);

      await menuButton.evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole('button', { name: new RegExp(`Close .*${account.role}.*navigation`, 'i') })).toBeVisible();
      if (account.role === 'admin') {
        await page.getByText('People', { exact: true }).click();
      }
      await page.waitForFunction(() => {
        const drawer = document.querySelector('.portal-mobile-drawer');
        if (!drawer) return false;
        const rect = drawer.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= window.innerWidth + 1;
      });
      const navLink = page.getByRole('link', { name: account.navLabel });
      await expect(navLink).toBeVisible();
      await navLink.click();
      await expect(page).toHaveURL(new RegExp(`${account.nextPath.replace(/\//g, '\\/')}$`), { timeout: 30_000 });
      await expect(page.getByRole('button', { name: new RegExp(`Close .*${account.role}.*navigation`, 'i') })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

test('admin grouped mobile drawer exposes every admin route', async ({ browser }) => {
  const admin = accounts[2];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await login(page, admin);
    await page.getByRole('button', { name: /Open .*admin.*navigation/i }).click();

    for (const group of ['Dashboard', 'People', 'Academics', 'Submissions', 'Communication', 'Reports', 'System', 'Settings']) {
      const groupSummary = page.locator('summary', { hasText: group }).first();
      await expect(groupSummary).toBeVisible();
    }
    await page.locator('.portal-mobile-drawer details').evaluateAll((details) => {
      for (const detail of details) (detail as HTMLDetailsElement).open = true;
    });

    for (const label of [
      'Dashboard',
      'Users',
      'Students',
      'Teachers',
      'Departments',
      'Subjects',
      'Academic Years',
      'Academic Settings',
      'Submissions',
      'Groups',
      'Announcements',
      'Calendar',
      'Notifications',
      'Mail Jobs',
      'Reports',
      'Audit Logs',
      'System Tools',
      'Backups',
      'File Inventory',
      'System Health',
      'Release Status',
      'Deployment Checklist',
      'Settings',
      'Profile',
    ]) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
