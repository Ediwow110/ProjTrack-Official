import { expect, test, type Page } from "@playwright/test";
import { smokeCredentials } from "./helpers/smoke-credentials";

const teacherAccount = {
  role: "teacher",
  identifier: smokeCredentials.teacher.identifier,
  password: smokeCredentials.teacher.password,
  identifierLabel: /Email or Teacher ID/i,
  buttonName: /Sign In as Teacher/i,
  dashboardPath: "/teacher/dashboard",
  routes: [
    "/teacher/dashboard",
    "/teacher/subjects",
    "/teacher/students",
    "/teacher/submissions",
    "/teacher/notifications",
    "/teacher/profile",
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

async function loginTeacher(page: Page) {
  await page.goto(`/${teacherAccount.role}/login`);
  await page.getByLabel(teacherAccount.identifierLabel).fill(teacherAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(teacherAccount.password);
  await page.getByRole("button", { name: teacherAccount.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teacherAccount.dashboardPath)}$`));
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

test("teacher portal navigation resolves from real sidebar and topbar controls", async ({
  page,
}) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginTeacher(page);
  await verifySidebarRoutes(page, teacherAccount.routes);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, teacherAccount.dashboardPath);
  await page.getByRole("button", { name: /Open teacher notifications/i }).click();
  await page.getByRole("button", { name: /View all notifications/i }).click();
  await expect(page).toHaveURL(/\/teacher\/notifications$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, teacherAccount.dashboardPath);
  await page.getByRole("button", { name: /Open teacher profile from sidebar/i }).click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await assertHealthy(page, tracker);

  await openSidebarRoute(page, teacherAccount.dashboardPath);
  await page.getByRole("button", { name: /^Open teacher profile$/i }).click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await assertHealthy(page, tracker);
});
