import { expect, test, type Page } from "@playwright/test";

const accounts = {
  student: {
    role: "student",
    identifier: process.env.SMOKE_STUDENT_IDENTIFIER || "",
    password: process.env.SMOKE_STUDENT_PASSWORD || "",
    identifierLabel: /Student ID or Email/i,
    buttonName: /Continue to Student Portal Login/i,
    dashboardPath: "/student/dashboard",
    routes: [
      "/student/dashboard",
      "/student/subjects",
      "/student/submissions",
      "/student/calendar",
      "/student/notifications",
      "/student/profile",
    ],
  },
  teacher: {
    role: "teacher",
    identifier: process.env.SMOKE_TEACHER_IDENTIFIER || "",
    password: process.env.SMOKE_TEACHER_PASSWORD || "",
    identifierLabel: /Employee ID or School Email/i,
    buttonName: /Continue to Teacher Portal Login/i,
    dashboardPath: "/teacher/dashboard",
    routes: [
      "/teacher/dashboard",
      "/teacher/subjects",
      "/teacher/students",
      "/teacher/submissions",
      "/teacher/notifications",
      "/teacher/profile",
    ],
  },
  admin: {
    role: "admin",
    identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
    password: process.env.SMOKE_ADMIN_PASSWORD || "",
    identifierLabel: /Admin Email/i,
    buttonName: /Continue to Admin Portal Login/i,
    dashboardPath: "/admin/dashboard",
    routes: [
      "/admin/dashboard",
      "/admin/students",
      "/admin/teachers",
      "/admin/subjects",
      "/admin/sections",
      "/admin/submissions",
      "/admin/reports",
      "/admin/groups",
      "/admin/announcements",
      "/admin/calendar",
      "/admin/academic-settings",
      "/admin/notifications",
      "/admin/audit-logs",
      "/admin/settings",
      "/admin/system-tools",
      "/admin/mail-jobs",
      "/admin/file-inventory",
      "/admin/system-health",
      "/admin/release-status",
      "/admin/bootstrap-guide",
      "/admin/profile",
    ],
  },
} as const;

const hasSmokeCredentials = [accounts.student, accounts.teacher, accounts.admin].every(
  (account) => Boolean(String(account.identifier).trim()) && Boolean(String(account.password).trim()),
);

test.skip(!hasSmokeCredentials, 'Set SMOKE_* identifiers and passwords before running e2e portal smoke.');

type RuntimeTracker = {
  consoleErrors: string[];
  pageErrors: string[];
};

function attachRuntimeTracker(page: Page): RuntimeTracker {
  const tracker: RuntimeTracker = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon/i.test(text)) return;
    tracker.consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    tracker.pageErrors.push(error.message);
  });

  return tracker;
}

async function assertHealthy(page: Page, tracker: RuntimeTracker) {
  await expect(page.getByText(/Unexpected Application Error!/i)).toHaveCount(0);
  expect(
    tracker.pageErrors,
    `Unexpected page errors: ${tracker.pageErrors.join("\n")}`,
  ).toEqual([]);
  expect(
    tracker.consoleErrors,
    `Unexpected console errors: ${tracker.consoleErrors.join("\n")}`,
  ).toEqual([]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function login(page: Page, account: (typeof accounts)[keyof typeof accounts]) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole("button", { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(account.dashboardPath)}$`));
}

async function clickSidebarLink(page: Page, route: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const link = page.locator(`a[href="${route}"]`).first();
    await expect(link).toBeVisible();

    try {
      await link.click();
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(150);
    }
  }

  throw lastError;
}

async function verifySidebarRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    await clickSidebarLink(page, route);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}$`));
  }
}

async function openSidebarRoute(page: Page, route: string) {
  await clickSidebarLink(page, route);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}$`));
}

test("public entry points resolve to student login without portal chooser UI", async ({
  page,
}) => {
  const forbiddenChooserCopy =
    /Choose another portal|Choose your portal|Back to portals|Change portal|Not your portal|Portal selector/i;

  for (const route of ["/", "/login", "/portals"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/student\/login$/);
    await expect(page.getByRole("heading", { name: /^Student Portal Login$/i })).toBeVisible();
    await expect(page.getByText(forbiddenChooserCopy)).toHaveCount(0);
    await expect(page.getByText(/^Teacher Portal$/i)).toHaveCount(0);
    await expect(page.getByText(/^Admin Portal$/i)).toHaveCount(0);
  }

  for (const route of ["/student/login", "/teacher/login", "/admin/login"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}$`));
    await expect(page.getByText(forbiddenChooserCopy)).toHaveCount(0);
  }
});

test("student portal navigation resolves from real sidebar and topbar controls", async ({
  page,
}) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await login(page, accounts.student);
  await verifySidebarRoutes(page, accounts.student.routes);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.student.dashboardPath);
  await page.getByRole("button", { name: /Open student notifications/i }).click();
  await page.getByRole("button", { name: /View all notifications/i }).click();
  await expect(page).toHaveURL(/\/student\/notifications$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.student.dashboardPath);
  await page.getByRole("button", { name: /Open student profile from sidebar/i }).click();
  await expect(page).toHaveURL(/\/student\/profile$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.student.dashboardPath);
  await page.getByRole("button", { name: /^Open student profile$/i }).click();
  await expect(page).toHaveURL(/\/student\/profile$/);
  await assertHealthy(page, tracker);
});

test("teacher portal navigation resolves from real sidebar and topbar controls", async ({
  page,
}) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await login(page, accounts.teacher);
  await verifySidebarRoutes(page, accounts.teacher.routes);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.teacher.dashboardPath);
  await page.getByRole("button", { name: /Open teacher notifications/i }).click();
  await page.getByRole("button", { name: /View all notifications/i }).click();
  await expect(page).toHaveURL(/\/teacher\/notifications$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.teacher.dashboardPath);
  await page.getByRole("button", { name: /Open teacher profile from sidebar/i }).click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, accounts.teacher.dashboardPath);
  await page.getByRole("button", { name: /^Open teacher profile$/i }).click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await assertHealthy(page, tracker);
});

test("admin portal navigation and section shortcuts resolve without dead clicks", async ({
  page,
}) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await login(page, accounts.admin);
  await verifySidebarRoutes(page, accounts.admin.routes);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, "/admin/dashboard");
  await page.getByRole("button", { name: /Open admin notifications/i }).click();
  await page.getByRole("button", { name: /View all notifications/i }).click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, "/admin/dashboard");
  await page.getByRole("button", { name: /Open admin profile from sidebar/i }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, "/admin/dashboard");
  await page.getByRole("button", { name: /^Open admin profile$/i }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await assertHealthy(page, tracker);

  await page.goto("/admin/requests");
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, "/admin/sections");
  await page.getByRole("button", { name: /Open academic year/i }).first().click();
  await page.getByRole("button", { name: /Open year level/i }).first().click();
  await page.getByRole("button", { name: /Open master list/i }).first().click();
  await page.getByRole("button", { name: /^View Students$/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/students\?sectionId=[^&]+$/);
  await expect(page.getByRole("button", { name: /^Add Student$/ })).toBeVisible();
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, "/admin/sections");
  await page.getByRole("button", { name: /Open academic year/i }).first().click();
  await page.getByRole("button", { name: /Open year level/i }).first().click();
  await page.getByRole("button", { name: /Open master list/i }).first().click();
  await page.getByRole("button", { name: /^Manage Moves$/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/bulk-move\?sourceSectionId=[^&]+$/);
  await expect(
    page.getByRole("heading", { name: /Bulk Move Students/i }),
  ).toBeVisible();
  await assertHealthy(page, tracker);
});
