import { expect, test, type Page } from "@playwright/test";

const adminAccount = {
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
  password: process.env.SMOKE_ADMIN_PASSWORD || "",
};

test.skip(
  !String(adminAccount.identifier).trim() || !String(adminAccount.password).trim(),
  "Set SMOKE_ADMIN_IDENTIFIER and SMOKE_ADMIN_PASSWORD before running admin users e2e.",
);

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

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Email or Admin ID/i).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function navigateReady(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
}

test("Admin Users page title, search, role and status filters render without runtime errors", async ({ page }) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginAdmin(page);

  await navigateReady(page, "/admin/users");

  await expect(page.getByRole("heading", { name: /Users/i, level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Manage admin, teacher, and student accounts/i)).toBeVisible();

  const searchInput = page.getByPlaceholder(/Search by name, email/i);
  await expect(searchInput).toBeVisible();

  const roleSelect = page.getByLabel(/Role/i);
  await expect(roleSelect).toBeVisible();

  const statusSelect = page.getByLabel(/Status/i);
  await expect(statusSelect).toBeVisible();

  const refreshBtn = page.getByRole("button", { name: /Refresh/i });
  await expect(refreshBtn).toBeVisible();

  const addAdminBtn = page.getByRole("button", { name: /Add Admin/i });
  await expect(addAdminBtn).toBeVisible();

  await assertHealthy(page, tracker);
});

test("Admin Users page loads data and user table renders without errors", async ({ page }) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginAdmin(page);

  await navigateReady(page, "/admin/users");

  const heading = page.getByRole("heading", { name: /Users/i, level: 1 });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const loadingSkeleton = page.locator(".animate-pulse");
  await expect(loadingSkeleton.first()).not.toBeVisible({ timeout: 15_000 });

  const noData = page.getByText(/No users match this view/i);
  const userTable = page.locator("table");
  const hasDataOrEmpty = noData.or(userTable).first();
  await expect(hasDataOrEmpty).toBeVisible({ timeout: 10_000 });

  await assertHealthy(page, tracker);
});

test("Admin Users role and status filter selects change and trigger data reload", async ({ page }) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginAdmin(page);

  await navigateReady(page, "/admin/users");

  const heading = page.getByRole("heading", { name: /Users/i, level: 1 });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const roleSelect = page.getByLabel(/Role/i);
  await roleSelect.selectOption("ADMIN");
  await page.waitForTimeout(1500);
  await assertHealthy(page, tracker);

  await roleSelect.selectOption("All");
  await page.waitForTimeout(1500);
  await assertHealthy(page, tracker);

  const statusSelect = page.getByLabel(/Status/i);
  await statusSelect.selectOption("Active");
  await page.waitForTimeout(1500);
  await assertHealthy(page, tracker);
});

test("Admin Users Refresh button reloads data without errors", async ({ page }) => {
  test.slow();
  const tracker = attachRuntimeTracker(page);
  await loginAdmin(page);

  await navigateReady(page, "/admin/users");

  const heading = page.getByRole("heading", { name: /Users/i, level: 1 });
  await expect(heading).toBeVisible({ timeout: 15_000 });

  const refreshBtn = page.getByRole("button", { name: /Refresh/i });
  await refreshBtn.click();
  await page.waitForTimeout(2000);

  await assertHealthy(page, tracker);
});
