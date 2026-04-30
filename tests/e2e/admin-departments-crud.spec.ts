import { expect, test } from "@playwright/test";

const adminAccount = {
  identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
  password: process.env.SMOKE_ADMIN_PASSWORD || "",
};

test.skip(
  !String(adminAccount.identifier).trim() || !String(adminAccount.password).trim(),
  "Set SMOKE_ADMIN_IDENTIFIER and SMOKE_ADMIN_PASSWORD before running admin departments e2e.",
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Admin Email/i).fill(adminAccount.identifier);
  await page.getByLabel(/^Password$/i).fill(adminAccount.password);
  await page.getByRole("button", { name: /Sign In as Admin/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test("admin can create, edit, and delete a department from the Departments page", async ({ page }) => {
  test.slow();
  const unique = `E2E Department ${Date.now()}`;
  const renamed = `${unique} Updated`;

  await loginAdmin(page);
  await page.goto("/admin/departments");
  await expect(page.getByRole("heading", { name: /Departments/i })).toBeVisible();

  await page.getByRole("button", { name: /Add Department/i }).click();
  await page.getByLabel(/Department Name/i).fill(unique);
  await page.getByLabel(/Description/i).fill("Created by Playwright CRUD coverage.");
  await page.getByRole("button", { name: /Create Department/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const editCreatedDepartment = page.getByRole("button", {
    name: new RegExp(`^Edit ${escapeRegExp(unique)}$`),
  });
  await expect(editCreatedDepartment).toBeVisible();

  await editCreatedDepartment.click();
  await page.getByLabel(/Department Name/i).fill(renamed);
  await page.getByLabel(/Description/i).fill("Updated by Playwright CRUD coverage.");
  await page.getByRole("button", { name: /Save Changes/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const deleteRenamedDepartment = page.getByRole("button", {
    name: new RegExp(`^Delete ${escapeRegExp(renamed)}$`),
  });
  await expect(deleteRenamedDepartment).toBeVisible();

  await deleteRenamedDepartment.click();
  await page.getByPlaceholder("DELETE DEPARTMENT").fill("DELETE DEPARTMENT");
  await page.getByRole("button", { name: /Delete Department/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(deleteRenamedDepartment).toHaveCount(0);
});
