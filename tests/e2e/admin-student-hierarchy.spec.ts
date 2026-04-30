import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(fileURLToPath(new URL("../../backend/", import.meta.url)));
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const { config: loadDotenv } = backendRequire("dotenv") as {
  config: (input: { path: string; override?: boolean }) => void;
};
loadDotenv({ path: path.join(backendRoot, ".env"), override: false });
const { PrismaClient } = backendRequire("@prisma/client") as {
  PrismaClient: new () => {
    user: {
      findFirst: (input: unknown) => Promise<{ id: string } | null>;
    };
    $disconnect: () => Promise<void>;
  };
};
const prisma = new PrismaClient();

const adminCandidates = [
  process.env.SMOKE_ADMIN_IDENTIFIER,
  "admin@projtrack.codes",
  "admin@projtrack.local",
].filter(Boolean) as string[];

const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "Admin123!ChangeMe";

async function loginAsAdmin(page: Page) {
  for (const identifier of adminCandidates) {
    await page.goto("/admin/login");
    await page.getByLabel(/Admin Email/i).fill(identifier);
    await page.getByLabel(/^Password$/i).fill(adminPassword);
    await page.getByRole("button", { name: /Sign In as Admin/i }).click();

    try {
      await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 5000 });
      return;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to log in as admin with identifiers: ${adminCandidates.join(", ")}`);
}

test("admin student hierarchy surfaces use the same academic placement flow", async ({ page }) => {
  test.slow();
  await loginAsAdmin(page);

  await page.goto("/admin/students");
  await expect(page.getByText(/Course/i).first()).toBeVisible();
  await expect(page.getByText(/Year Level/i).first()).toBeVisible();
  await expect(page.getByText(/Section/i).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download Template/i }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath, "The student template should download as a file.").toBeTruthy();
  const templateCsv = await readFile(String(downloadPath), "utf8");
  expect(templateCsv).toContain(
    "student_id,first_name,middle_initial,last_name,email,academic_year,course_code,course_name,year_level,section",
  );

  await page.getByRole("button", { name: /Import Students/i }).click();
  await expect(page.getByText(/Course Code must match an existing Course \/ Program/i)).toBeVisible();
  await expect(page.getByText(/Pending Activation/i).first()).toBeVisible();
  await page.getByRole("button", { name: /^Cancel$/i }).click();

  await page.goto("/admin/bulk-move");
  await expect(
    page.getByText(/Follow the academic hierarchy: Academic Year, Course \/ Program, Year Level, then Section./i).first(),
  ).toBeVisible();
  await expect(page.getByText(/Course \/ Program/i).first()).toBeVisible();

  const firstStudent = await prisma.user.findFirst({
    where: { role: "STUDENT" },
    select: { id: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  expect(firstStudent?.id, "A student record is required for the student detail hierarchy check.").toBeTruthy();
  await page.goto(`/admin/students/${firstStudent.id}`);
  await page.getByRole("button", { name: /^Edit$/i }).click();
  const editDialog = page.getByRole("dialog").last();
  await expect(editDialog.getByText(/^Academic Year$/i)).toBeVisible();
  await expect(editDialog.getByText(/^Course \/ Program$/i)).toBeVisible();
  await expect(editDialog.getByText(/^Year Level$/i)).toBeVisible();
  await expect(editDialog.getByText(/^Section$/i)).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
