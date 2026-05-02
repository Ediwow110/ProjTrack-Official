import { expect, test, type Page } from "@playwright/test";

const adminAccount = {
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "admin@projtrack.codes",
  password: process.env.SMOKE_ADMIN_PASSWORD || "Admin123!ChangeMe",
};

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0GQAAAAASUVORK5CYII=",
  "base64",
);

function oversizedPng() {
  return Buffer.alloc((2 * 1024 * 1024) + 16, 1);
}

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Admin Email/i).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: /Continue to Admin Portal Login/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test("branding uploads validate and flow into login and sidebar surfaces", async ({ page }) => {
  test.slow();
  await loginAsAdmin(page);
  await page.goto("/admin/settings");

  await expect(
    page.getByText(/PNG, SVG, and WEBP preserve transparent backgrounds/i),
  ).toBeVisible();
  await expect(
    page.getByText(/JPG does not support transparent backgrounds/i),
  ).toBeVisible();

  await page.getByLabel(/Upload Full logo/i).setInputFiles({
    name: "transparent-logo.png",
    mimeType: "image/png",
    buffer: transparentPng,
  });
  await page.getByLabel(/Upload Icon logo/i).setInputFiles({
    name: "transparent-icon.png",
    mimeType: "image/png",
    buffer: transparentPng,
  });

  await page.getByRole("button", { name: /Save Branding/i }).click();
  await expect(page.getByText(/Branding saved successfully/i)).toBeVisible();

  await page.goto("/admin/dashboard");
  await expect(page.locator('[data-testid="portal-sidebar-brand"] img').first()).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/admin/login");
  await expect(page.locator('[data-testid="projtrack-logo"] img').first()).toBeVisible();

  await loginAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/Upload Full logo/i).setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image", "utf8"),
  });
  await expect(page.getByText(/Invalid file type/i)).toBeVisible();

  await page.getByLabel(/Upload Full logo/i).setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: oversizedPng(),
  });
  await expect(page.getByText(/2MB or smaller/i)).toBeVisible();

  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await page.getByRole("button", { name: /Reset to Default/i }).click();
  await expect(page.getByText(/Branding reset to the default ProjTrack assets/i)).toBeVisible();
});
