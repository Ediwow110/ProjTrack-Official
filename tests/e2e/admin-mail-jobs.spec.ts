import { expect, test, type Page } from "@playwright/test";

const adminAccount = {
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
  password: process.env.SMOKE_ADMIN_PASSWORD || "",
};

test.skip(
  !String(adminAccount.identifier).trim() || !String(adminAccount.password).trim(),
  "Set SMOKE_ADMIN_IDENTIFIER and SMOKE_ADMIN_PASSWORD before running admin mail-jobs e2e.",
);

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Admin Email/i).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test("Admin Mail Jobs is backend-backed and explains provider and worker state", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/mail-jobs");

  await expect(page.getByRole("heading", { name: /Mail Jobs/i })).toBeVisible();
  await expect(page.getByText(/API process worker flag/i)).toBeVisible();
  await expect(page.getByText(/Dedicated worker heartbeat/i)).toBeVisible();
  await expect(page.getByText(/Queue Test Email/i)).toBeVisible();
  await expect(
    page.getByText(/Local stub provider active; no real email delivery|Mailrelay provider active/i),
  ).toBeVisible();

  const hrefPlaceholders = await page.locator('a[href="#"]').count();
  expect(hrefPlaceholders).toBe(0);
});

test("Admin test email creates a real queued MailJob row", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/mail-jobs");

  const recipient = `playwright-mail-${Date.now()}@example.com`;
  await page.getByPlaceholder(/recipient@example.com/i).fill(recipient);
  await page.getByRole("button", { name: /Queue test email/i }).click();

  await expect(page.getByText(/MailJob/i)).toBeVisible();
  const createdRow = page.locator("tr").filter({ hasText: recipient }).first();
  await expect(createdRow).toBeVisible();
  await expect(createdRow.getByText("queued", { exact: true }).first()).toBeVisible();
});
