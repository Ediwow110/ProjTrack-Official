import { expect, test, type Page } from "@playwright/test";

const adminAccount = {
  role: "admin",
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "admin@projtrack.local",
  password: process.env.SMOKE_ADMIN_PASSWORD || "Admin123!ChangeMe",
  identifierLabel: /Admin Email/i,
  buttonName: /Sign In as Admin/i,
  dashboardPath: "/admin/dashboard",
};

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

async function gotoWithRetry(page: Page, url: string, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      lastError = error;
      if (!/ERR_ABORTED/i.test(String(error)) || attempt === attempts) {
        throw error;
      }
      await page.waitForTimeout(400 * attempt);
    }
  }

  throw lastError;
}

async function login(page: Page) {
  await gotoWithRetry(page, `/${adminAccount.role}/login`);
  await page.getByLabel(adminAccount.identifierLabel).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: adminAccount.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(adminAccount.dashboardPath)}$`));
}

async function openPreviewIfRowsExist(page: Page, actionName: RegExp, closeMatcher: RegExp) {
  const noData = page.getByText(/No .* match this view|No audit events match this view/i).first();
  if (await noData.count()) {
    return;
  }

  const action = page.getByRole("button", { name: actionName }).first();
  await expect(action).toBeVisible();
  await action.click();
  await expect(page.getByRole("button", { name: closeMatcher }).first()).toBeVisible();
  await page.getByRole("button", { name: closeMatcher }).first().click();
}

test("admin shared list pages open preview drawers without runtime errors", async ({ page }) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await login(page);

  await page.goto("/admin/students");
  await openPreviewIfRowsExist(page, /^View Student$/i, /^Close details$|^Close$/i);
  await assertHealthy(page, tracker);

  await page.goto("/admin/teachers");
  await openPreviewIfRowsExist(page, /^Preview$/i, /^Close$/i);
  await assertHealthy(page, tracker);

  await page.goto("/admin/submissions");
  await openPreviewIfRowsExist(page, /^Preview$/i, /^Close$/i);
  await assertHealthy(page, tracker);

  await page.goto("/admin/requests");
  await openPreviewIfRowsExist(page, /^Review$/i, /^Close$/i);
  await assertHealthy(page, tracker);

  await page.goto("/admin/audit-logs");
  await openPreviewIfRowsExist(page, /View details/i, /^Close$/i);
  await assertHealthy(page, tracker);

  await page.goto("/admin/file-inventory");
  await openPreviewIfRowsExist(page, /^Preview$/i, /^Close$/i);
  await assertHealthy(page, tracker);
});
