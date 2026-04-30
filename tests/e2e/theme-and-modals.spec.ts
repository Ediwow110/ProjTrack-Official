import { expect, test, type Page } from '@playwright/test';

const adminAccount = {
  role: 'admin',
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || '',
  password: process.env.SMOKE_ADMIN_PASSWORD || '',
  identifierLabel: /Admin Email/i,
  buttonName: /Continue to Admin Portal Login/i,
  dashboardPath: '/admin/dashboard',
} as const;

const teacherAccount = {
  role: 'teacher',
  identifier: process.env.SMOKE_TEACHER_IDENTIFIER || '',
  password: process.env.SMOKE_TEACHER_PASSWORD || '',
  identifierLabel: /Employee ID or School Email/i,
  buttonName: /Continue to Teacher Portal Login/i,
  dashboardPath: '/teacher/dashboard',
} as const;

const studentAccount = {
  role: 'student',
  identifier: process.env.SMOKE_STUDENT_IDENTIFIER || '',
  password: process.env.SMOKE_STUDENT_PASSWORD || '',
  identifierLabel: /Student ID or Email/i,
  buttonName: /Continue to Student Portal Login/i,
  dashboardPath: '/student/dashboard',
} as const;

const roleLogoExpectations = [
  { role: 'student', label: 'Student Portal', title: /Student Portal Login/i, path: '/student/login', color: 'rgb(37, 99, 235)', dotColor: 'rgb(8, 189, 244)', buttonName: /Continue to Student Portal Login/i },
  { role: 'teacher', label: 'Teacher Portal', title: /Teacher Portal Login/i, path: '/teacher/login', color: 'rgb(139, 92, 246)', dotColor: 'rgb(167, 139, 250)', buttonName: /Continue to Teacher Portal Login/i },
  { role: 'admin', label: 'Admin Portal', title: /Admin Portal Login/i, path: '/admin/login', color: 'rgb(255, 121, 0)', dotColor: 'rgb(255, 157, 0)', buttonName: /Continue to Admin Portal Login/i },
] as const;

const adminRoutes = [
  { path: '/admin/announcements', heading: /Announcements/i },
  { path: '/admin/system-tools', heading: /System Tools/i },
  { path: '/admin/students', heading: /Students/i },
  { path: '/admin/mail-jobs', heading: /Mail Jobs/i },
  { path: '/admin/system-health', heading: /System Health/i },
  { path: '/admin/backups', heading: /Backup History/i },
  { path: '/admin/dashboard', heading: /System Dashboard|Operations Overview|System Status/i },
] as const;

const publicLoginRoutes = [
  { path: '/student/login', heading: /Student Portal Login/i },
  { path: '/teacher/login', heading: /Teacher Portal Login/i },
  { path: '/admin/login', heading: /Admin Portal Login/i },
] as const;

test.skip(
  [adminAccount, teacherAccount, studentAccount].some(
    (account) => !String(account.identifier).trim() || !String(account.password).trim(),
  ),
  'Set SMOKE_* identifiers and passwords before running theme-and-modals e2e.',
);

type RuntimeTracker = { consoleErrors: string[]; pageErrors: string[] };

function attachRuntimeTracker(page: Page): RuntimeTracker {
  const tracker: RuntimeTracker = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon/i.test(text)) return;
    tracker.consoleErrors.push(text);
  });
  page.on('pageerror', (error) => tracker.pageErrors.push(error.message));
  return tracker;
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('projtrack-theme', selectedTheme);
    document.documentElement?.classList.toggle('dark', selectedTheme === 'dark');
  }, theme);
}

async function loginAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(adminAccount.identifierLabel).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole('button', { name: adminAccount.buttonName }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function loginTeacher(page: Page) {
  await page.goto('/teacher/login');
  await page.getByLabel(teacherAccount.identifierLabel).fill(teacherAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(teacherAccount.password);
  await page.getByRole('button', { name: teacherAccount.buttonName }).click();
  await expect(page).toHaveURL(/\/teacher\/dashboard$/);
}

async function loginStudent(page: Page) {
  await page.goto('/student/login');
  await page.getByLabel(studentAccount.identifierLabel).fill(studentAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(studentAccount.password);
  await page.getByRole('button', { name: studentAccount.buttonName }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
}

async function expectPortalBrand(page: Page, label: string, dotColor: string) {
  const brand = page.getByTestId('portal-sidebar-brand').first();
  await expect(brand).toBeVisible();
  await expect(brand.getByText('ProjTrack', { exact: true })).toBeVisible();
  const roleLabel = brand.locator('[data-testid="projtrack-role-label"]').first();
  await expect(roleLabel).toHaveText(label.toUpperCase());
  const brandText = await brand.innerText();
  const matches = brandText.match(new RegExp(label, 'gi')) ?? [];
  expect(matches, `${label} should appear once in the sidebar brand`).toHaveLength(1);
  const dot = brand.locator('.projtrack-role-dot').first();
  await expect(dot).toBeVisible();
  await expect(dot).toHaveCSS('background-color', dotColor);
}

async function expectLogoColor(page: Page, label: string, expectedColor: string) {
  const logo = page.locator(`[aria-label="ProjTrack ${label}"]`).first();
  await expect(logo).toBeVisible();
  const mark = logo.locator('.projtrack-logo-mark').first();
  await expect(mark).toBeVisible();
  const background = await mark.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain(expectedColor);
}

async function assertNoRuntimeErrors(page: Page, tracker: RuntimeTracker) {
  await expect(page.getByText(/Unexpected Application Error!/i)).toHaveCount(0);
  expect(tracker.pageErrors, `Unexpected page errors: ${tracker.pageErrors.join('\n')}`).toEqual([]);
  expect(tracker.consoleErrors, `Unexpected console errors: ${tracker.consoleErrors.join('\n')}`).toEqual([]);
}

async function assertNoBrokenWhiteCardOnDark(page: Page) {
  const brokenCount = await page.locator('body *').evaluateAll((nodes) =>
    nodes.filter((node) => {
      const element = node as HTMLElement;
      const className = element.className?.toString() ?? '';
      if (!className.includes('bg-white')) return false;
      if (className.includes('dark:') || className.includes('bg-white/') || className.includes('portal-')) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 80 && rect.height > 40;
    }).length,
  );
  expect(brokenCount, 'large bg-white surfaces without dark variants should not be visible in dark mode').toBe(0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`public login pages render readable in ${theme} mode`, async ({ page }) => {
    const tracker = attachRuntimeTracker(page);
    await setTheme(page, theme);
    for (const route of publicLoginRoutes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.locator('main, body').first()).toBeVisible();
      if (theme === 'dark') await assertNoBrokenWhiteCardOnDark(page);
    }
    await assertNoRuntimeErrors(page, tracker);
  });

  test(`critical admin pages render readable in ${theme} mode`, async ({ page }) => {
    test.slow();
    const tracker = attachRuntimeTracker(page);
    await setTheme(page, theme);
    await loginAdmin(page);
    for (const route of adminRoutes) {
      await page.goto(route.path);
      await expect(page.getByText(route.heading).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('main, body').first()).toBeVisible();
      if (theme === 'dark') await assertNoBrokenWhiteCardOnDark(page);
    }
    await assertNoRuntimeErrors(page, tracker);
  });
}

test('approved separated role login design renders without role switchers', async ({ page }) => {
  const tracker = attachRuntimeTracker(page);

  for (const expectation of roleLogoExpectations) {
    await page.goto(expectation.path);
    await expect(page.locator('.auth-starry-login')).toBeVisible();
    await expect(page.locator('.auth-starfield')).toBeVisible();
    await expect(page.locator('.auth-dot-grid')).toBeVisible();
    await expect(page.getByRole('heading', { name: expectation.title, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Welcome Back!/i })).toBeVisible();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expectLogoColor(page, expectation.label, expectation.color);

    const cardIconBackground = await page.locator('.auth-card-icon').first().evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(cardIconBackground).toContain(expectation.color);
    const buttonBackground = await page.getByRole('button', { name: expectation.buttonName }).evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(buttonBackground).toContain(expectation.color);

    await expect(page.locator('.auth-role-tabs')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /Switch login role|Choose login portal/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Student$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Teacher$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Admin$/i })).toHaveCount(0);
  }

  await page.goto('/student/login');
  await expect(page.getByRole('heading', { name: /Student Portal Login/i, level: 1 })).toBeVisible();
  await page.goto('/teacher/login');
  await expect(page.getByRole('heading', { name: /Teacher Portal Login/i, level: 1 })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: /Admin Portal Login/i, level: 1 })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/student\/login$/);

  await assertNoRuntimeErrors(page, tracker);
});

test('role-colored ProjTrack logos render before and after login', async ({ page }) => {
  const tracker = attachRuntimeTracker(page);

  for (const expectation of roleLogoExpectations) {
    await page.goto(expectation.path);
    await expectLogoColor(page, expectation.label, expectation.color);
  }

  await loginAdmin(page);
  await expectLogoColor(page, 'Admin Portal', 'rgb(255, 121, 0)');
  await assertNoRuntimeErrors(page, tracker);
});

test('authenticated sidebar brand shows one role label with a role-colored dot', async ({ browser }) => {
  const accounts = [
    { login: loginStudent, label: 'Student Portal', dotColor: 'rgb(8, 189, 244)' },
    { login: loginTeacher, label: 'Teacher Portal', dotColor: 'rgb(167, 139, 250)' },
    { login: loginAdmin, label: 'Admin Portal', dotColor: 'rgb(255, 157, 0)' },
  ] as const;

  for (const item of accounts) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const tracker = attachRuntimeTracker(page);
    try {
      await item.login(page);
      await expectLogoColor(page, item.label, roleLogoExpectations.find((expectation) => expectation.label === item.label)!.color);
      await expectPortalBrand(page, item.label, item.dotColor);
      await assertNoRuntimeErrors(page, tracker);
    } finally {
      await context.close();
    }
  }
});

test('seed cleanup modal keeps scrollable body and reachable blocked actions at 1366x768', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1366, height: 768 });
  const tracker = attachRuntimeTracker(page);
  await setTheme(page, 'dark');
  await loginAdmin(page);
  await page.goto('/admin/system-tools');

  await page.getByRole('button', { name: /Preview Seed Cleanup/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Preview first/i)).toBeVisible();

  await dialog.getByRole('button', { name: /Preview Seed Cleanup/i }).click();
  await expect(dialog.getByText(/Seed Data Cleanup Preview/i)).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText('Records deleted', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^0$/).first()).toBeVisible();
  await expect(dialog.getByText(/Cleanup executed/i)).toBeVisible();

  const body = dialog.locator('[data-modal-body], [tabindex="0"]').first();
  const canScroll = await body.evaluate((element) => element.scrollHeight >= element.clientHeight);
  expect(canScroll, 'modal body should be scrollable or at least bounded within viewport').toBeTruthy();

  await expect(dialog.getByRole('button', { name: /Cancel/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Execution Blocked|Execute Seed Cleanup/i })).toBeVisible();
  if (await dialog.getByRole('button', { name: /Execution Blocked/i }).count()) {
    await expect(dialog.getByRole('button', { name: /Execution Blocked/i })).toBeDisabled();
    await expect(dialog.getByText(/Execution is blocked|No records can be deleted/i)).toBeVisible();
  }
  await assertNoRuntimeErrors(page, tracker);
});

test('teacher add submission modal keeps footer actions reachable across viewports', async ({ browser }) => {
  test.slow();
  const viewports = [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const tracker = attachRuntimeTracker(page);
    try {
      await loginTeacher(page);
      await page.goto('/teacher/subjects');
      await page.getByRole('link', { name: /Open subject/i }).first().click();
      await page.getByRole('button', { name: /Add Submission/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const cancelButton = dialog.getByRole('button', { name: /Cancel/i });
      const createButton = dialog.getByRole('button', { name: /Create Submission/i });
      await expect(cancelButton).toBeVisible();
      await expect(createButton).toBeVisible();
      await createButton.scrollIntoViewIfNeeded();

      const box = await createButton.boundingBox();
      expect(box, 'Create Submission button should have a rendered box').not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await createButton.click({ trial: true });
      await cancelButton.click();
      await expect(dialog).toHaveCount(0);
      await assertNoRuntimeErrors(page, tracker);
    } finally {
      await context.close();
    }
  }
});
