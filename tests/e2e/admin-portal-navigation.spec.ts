import { expect, test, type Page } from "@playwright/test";
import { smokeCredentials } from "./helpers/smoke-credentials";

const adminAccount = {
  role: "admin",
  identifier: smokeCredentials.admin.identifier,
  password: smokeCredentials.admin.password,
  identifierLabel: /Email or Admin ID/i,
  buttonName: /Sign In as Admin/i,
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
} as const;

type RuntimeTracker = {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: string[];
};

function attachRuntimeTracker(page: Page): RuntimeTracker {
  const tracker: RuntimeTracker = {
    consoleErrors: [],
    pageErrors: [],
    serverErrors: [],
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

  page.on("response", (response) => {
    if (response.status() >= 500) {
      tracker.serverErrors.push(`${response.status()} ${response.url()}`);
    }
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
  expect(
    tracker.serverErrors,
    `Unexpected server errors: ${tracker.serverErrors.join("\n")}`,
  ).toEqual([]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const smokeAcademicYearName = String(
  process.env.SMOKE_ACADEMIC_YEAR_NAME ?? "Smoke AY 2026",
).trim();

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(adminAccount.identifierLabel).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: adminAccount.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(adminAccount.dashboardPath)}$`));
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

async function verifySidebarRoutes(page: Page, routes: readonly string[]) {
  for (const route of routes) {
    await clickSidebarLink(page, route);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}$`));
  }
}

async function openSidebarRoute(page: Page, route: string) {
  await clickSidebarLink(page, route);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}$`));
}

async function openSmokeSectionMasterList(page: Page) {
  await openSidebarRoute(page, "/admin/sections");
  const academicYearButton = page.getByRole("button", {
    name: new RegExp(`Open academic year\\s+${escapeRegExp(smokeAcademicYearName)}`, "i"),
  });
  await expect(academicYearButton).toBeVisible();
  await academicYearButton.click();
  await page.getByRole("button", { name: /Open course/i }).first().click();
  await page.getByRole("button", { name: /Open year level/i }).first().click();
  await page.getByRole("button", { name: /Open master list/i }).first().click();
}

test("admin portal navigation and section shortcuts resolve without dead clicks", async ({
  page,
}) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginAdmin(page);
  await verifySidebarRoutes(page, adminAccount.routes);
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

  await page.goto("/admin/notifications");
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await assertHealthy(page, tracker);

  await openSmokeSectionMasterList(page);
  await page.getByRole("button", { name: /^View Students$/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/students\?sectionId=[^&]+$/);
  await expect(page.getByRole("button", { name: /^Add Student$/ })).toBeVisible();
  await assertHealthy(page, tracker);

  await openSmokeSectionMasterList(page);
  await page.getByRole("button", { name: /^Manage Moves$/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/bulk-move\?sourceSectionId=[^&]+$/);
  await expect(
    page.getByRole("heading", { name: /Bulk Move Students/i }),
  ).toBeVisible();
  await assertHealthy(page, tracker);
});
