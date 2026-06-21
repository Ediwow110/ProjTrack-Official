import { expect, test, type Page } from "@playwright/test";
import { smokeCredentials } from "./helpers/smoke-credentials";

const accounts = {
  student: {
    role: "student",
    identifier: smokeCredentials.student.identifier,
    password: smokeCredentials.student.password,
    identifierLabel: /Email or Student ID/i,
    buttonName: /^Sign In$/i,
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
    await expect(page.getByRole("heading", { name: /Manage\. Submit\. Stay Ready\. Stay On Track\./i, level: 1 })).toBeVisible();
    await expect(page.getByText(/Student Portal Login/i)).toBeVisible();
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
