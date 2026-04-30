import { expect, test } from "@playwright/test";

const adminAccount = {
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
  password: process.env.SMOKE_ADMIN_PASSWORD || "",
};

test.skip(
  !String(adminAccount.identifier).trim() || !String(adminAccount.password).trim(),
  "Set SMOKE_ADMIN_IDENTIFIER and SMOKE_ADMIN_PASSWORD before running admin backups e2e.",
);

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Admin Email/i).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test("admin backups page creates a real backup, survives reload, and guards destructive actions", async ({ page }) => {
  test.slow();

  await loginAdmin(page);
  await page.goto("/admin/backups");
  await expect(page.getByRole("heading", { name: /Backups/i })).toBeVisible();

  const rows = page.locator("tbody tr");
  const initialCount = await rows.count();
  const initialFirstStorageCell = initialCount > 0
    ? await rows.first().locator("td").nth(5).innerText()
    : "";

  await page.getByRole("button", { name: /Run Backup Now/i }).click();
  await expect(page.getByText(/Backup completed\./i)).toBeVisible();

  let afterRunCount = await rows.count();
  if (initialCount === 0) {
    expect(afterRunCount).toBe(1);
  } else {
    expect(afterRunCount).toBe(initialCount + 1);
  }

  const latestRow = rows.first();
  await expect(latestRow.getByText(/COMPLETED/i)).toBeVisible();
  await expect(latestRow.getByText(/Artifact Ready/i)).toBeVisible();
  const latestStorageCell = await latestRow.locator("td").nth(5).innerText();
  expect(latestStorageCell).not.toBe(initialFirstStorageCell);

  await latestRow.getByRole("button", { name: /View backup details/i }).click();
  await expect(page.getByText(/Real metadata from backend history and artifact manifest\./i)).toBeVisible();
  await expect(page.getByText(/Manifest Record Counts/i)).toBeVisible();
  await page.getByRole("button", { name: /^Close$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await latestRow.getByRole("button", { name: /Download backup/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("projtrack-backup-");

  await latestRow.getByRole("button", { name: /Protect backup/i }).click();
  await expect(page.getByText(/is now protected\./i)).toBeVisible();
  await expect(latestRow.getByRole("button", { name: /Unprotect backup/i })).toBeVisible();

  await latestRow.getByRole("button", { name: /Unprotect backup/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel(/Backup action confirmation/i).fill("UNPROTECT BACKUP");
  await page.getByRole("button", { name: /Confirm Unprotect/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/is no longer protected\./i)).toBeVisible();

  await latestRow.getByRole("button", { name: /Restore backup/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Restore is destructive/i)).toBeVisible();
  await page.getByRole("button", { name: /^Cancel$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: /Backups/i })).toBeVisible();
  await expect(rows.first().locator("td").nth(5)).toContainText(latestStorageCell.split("\n").pop() || latestStorageCell);

  afterRunCount = await rows.count();
  if (afterRunCount > 1) {
    const olderRow = rows.nth(1);
    await olderRow.getByRole("button", { name: /Delete backup/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Type DELETE BACKUP to continue/i)).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
