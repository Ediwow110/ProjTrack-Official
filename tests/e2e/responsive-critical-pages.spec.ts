import { expect, test, type Page, type Browser } from '@playwright/test';
import { smokeCredentials } from './helpers/smoke-credentials';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const accounts = {
  student: {
    role: 'student',
    get identifier() { return smokeCredentials.student.identifier; },
    get password() { return smokeCredentials.student.password; },
    identifierLabel: /Email or Student ID/i,
    buttonName: /^Sign In$/i,
    dashboardPath: '/student/dashboard',
  },
  teacher: {
    role: 'teacher',
    get identifier() { return smokeCredentials.teacher.identifier; },
    get password() { return smokeCredentials.teacher.password; },
    identifierLabel: /Email or Teacher ID/i,
    buttonName: /Sign In as Teacher/i,
    dashboardPath: '/teacher/dashboard',
  },
  admin: {
    role: 'admin',
    get identifier() { return smokeCredentials.admin.identifier; },
    get password() { return smokeCredentials.admin.password; },
    identifierLabel: /Email or Admin ID/i,
    buttonName: /Sign In as Admin/i,
    dashboardPath: '/admin/dashboard',
  },
} as const;

const criticalPages = {
  student: [
    { path: '/student/dashboard', title: /Dashboard|Submit Project|Welcome/i },
    { path: '/student/subjects', title: /Subjects/i },
    { path: '/student/submissions', title: /Submissions/i },
    { path: '/student/submit', title: /Submit/i },
    { path: '/student/calendar', title: /Calendar/i },
    { path: '/student/profile', title: /Profile/i },
  ],
  teacher: [
    { path: '/teacher/dashboard', title: /Dashboard|Review Submissions|Welcome/i },
    { path: '/teacher/subjects', title: /Subjects/i },
    { path: '/teacher/students', title: /Students/i },
    { path: '/teacher/submissions', title: /Submissions/i },
    { path: '/teacher/profile', title: /Profile/i },
  ],
  admin: [
    { path: '/admin/dashboard', title: /Dashboard|System Status|Operations/i },
    { path: '/admin/users', title: /Users/i },
    { path: '/admin/students', title: /Students/i },
    { path: '/admin/teachers', title: /Teachers/i },
    { path: '/admin/subjects', title: /Subjects/i },
    { path: '/admin/submissions', title: /Submissions/i },
    { path: '/admin/reports', title: /Reports/i },
    { path: '/admin/settings', title: /Settings/i },
    { path: '/admin/system-health', title: /System Health/i },
    { path: '/admin/backups', title: /Backups/i },
  ],
} as const;

type Role = keyof typeof accounts;

async function login(page: Page, role: Role) {
  const account = accounts[role];
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole('button', { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, '\\/')}$`), { timeout: 30_000 });
}

async function authenticatedPage(browser: Browser, role: Role, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await login(page, role);
  return { context, page };
}

async function assertResponsivePage(page: Page, role: Role, route: { path: string; title: RegExp }, viewport: { width: number; height: number }) {
  await page.goto(route.path);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);

  await expect(page.locator('main'), `main landmark missing on ${route.path}`).toBeVisible();
  await expect(page.getByText(/Unexpected Application Error!/i), `unexpected app error on ${route.path}`).toHaveCount(0);
  await expect(page.getByText(/Loading page…/i), `blank loading dead-end on ${route.path}`).toHaveCount(0);
  await expect(page.getByText(route.title).first(), `primary page title missing on ${route.path}`).toBeVisible({ timeout: 15_000 });

  const menuButton = page.getByRole('button', { name: new RegExp(`Open .*${role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student'}.*navigation`, 'i') });
  if (viewport.width < 1024) {
    await expect(menuButton, `mobile navigation button missing on ${route.path} at ${viewport.width}x${viewport.height}`).toBeVisible();
  }

  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    mainBottom: document.querySelector('main')?.getBoundingClientRect().bottom ?? 0,
    viewportHeight: window.innerHeight,
  }));

  expect(overflow.documentScrollWidth, `document overflow on ${route.path} at ${viewport.width}x${viewport.height}`)
    .toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth, `body overflow on ${route.path} at ${viewport.width}x${viewport.height}`)
    .toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
  expect(overflow.mainBottom, `main content clipped above viewport on ${route.path}`).toBeGreaterThan(120);
}

for (const role of Object.keys(criticalPages) as Role[]) {
  for (const viewport of viewports) {
    test(`${role} critical pages fit at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
      const { context, page } = await authenticatedPage(browser, role, viewport);
      try {
        for (const route of criticalPages[role]) {
          await assertResponsivePage(page, role, route, viewport);
          if (route.path.endsWith('/dashboard')) {
            await testInfo.attach(`${role}-${viewport.width}x${viewport.height}-dashboard`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: 'image/png',
            });
          }
        }
      } finally {
        await context.close();
      }
    });
  }
}
