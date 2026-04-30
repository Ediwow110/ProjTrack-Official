import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const adminIdentifier = process.env.SMOKE_ADMIN_IDENTIFIER || "";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "";
const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX0XW0AAAAASUVORK5CYII=";

async function loginAdmin(page) {
  assert.ok(adminIdentifier.trim(), "SMOKE_ADMIN_IDENTIFIER is required.");
  assert.ok(adminPassword.trim(), "SMOKE_ADMIN_PASSWORD is required.");
  await page.goto(`${baseUrl}/admin/login`);
  await page.getByLabel(/Admin Email/i).fill(adminIdentifier);
  await page.getByLabel(/^Password$/i).fill(adminPassword);
  await page.getByRole("button", { name: /Continue to Admin Login/i }).click();
  await page.waitForURL(/\/admin\/dashboard$/);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    await loginAdmin(page);

    await page.goto(`${baseUrl}/admin/students`);
    await page.getByRole("button", { name: /^Add Student$/i }).click();

    const dialog = page.getByRole("dialog", { name: /Add Student/i });
    await dialog.waitFor({ state: "visible" });

    await assert.doesNotReject(async () => {
      await dialog.getByRole("button", { name: /^Create Student$/i }).waitFor();
    });
    assert.equal(
      await dialog.getByText(/Create & Send Link/i).count(),
      0,
      "Legacy create button text should not be rendered.",
    );
    assert.equal(
      await dialog.getByText(/Send activation link immediately/i).count(),
      0,
      "Legacy activation checkbox should not be rendered.",
    );

    const labels = (await dialog.locator("label").allTextContents())
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 8);
    assert.deepEqual(labels, [
      "First Name",
      "M.I.",
      "Last Name",
      "Email",
      "Student Number / Student ID",
      "Course",
      "Year Level",
      "Section",
    ]);

    const selects = dialog.locator("select");
    const yearLevelSelect = selects.nth(0);
    const sectionSelect = selects.nth(1);
    assert.equal(await sectionSelect.isDisabled(), true, "Section should be disabled before year level is selected.");

    await dialog.locator("input").nth(5).fill("NONEXISTENT COURSE");
    const firstYearLevelValue = await yearLevelSelect
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => option.getAttribute("value") || "")
          .find((value) => value.trim().length > 0) || "",
      );
    assert.notEqual(firstYearLevelValue, "", "At least one year level should be available in the active academic year.");
    await yearLevelSelect.selectOption(firstYearLevelValue);
    await dialog.getByText(/No sections available for this year level\./i).waitFor();

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });

    await assert.doesNotReject(async () => {
      await page.locator('button[title="View Student"]').first().waitFor();
      await page.locator('button[title="Edit Student"]').first().waitFor();
      const sendLinkButtons = page.locator('button[title="Send Setup Link"], button[title="Send Reset Link"]');
      await sendLinkButtons.first().waitFor();
    });

    await page.locator('input[aria-label^="Select row"]').first().check();
    await page.getByRole("button", { name: /Send setup links to selected students/i }).waitFor();

    await page.goto(`${baseUrl}/admin/profile`);
    const topbarAvatarImage = page.locator('button[aria-label="Open admin profile"] img');
    const sidebarAvatarImage = page.locator('button[aria-label="Open admin profile from sidebar"] img');
    const profileAvatarImage = page.locator('img[alt="Admin avatar"]');
    const removeAvatarButton = page.getByRole("button", { name: /Remove avatar/i });

    assert.equal(await removeAvatarButton.count(), 0, "Smoke account should start without an avatar.");
    assert.equal(await topbarAvatarImage.count(), 0, "Topbar should start with initials fallback.");
    assert.equal(await sidebarAvatarImage.count(), 0, "Sidebar should start with initials fallback.");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "smoke-avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(tinyPngBase64, "base64"),
    });

    await page.getByText(/Profile changes were saved\./i).waitFor();
    await profileAvatarImage.waitFor();
    await topbarAvatarImage.waitFor();
    await sidebarAvatarImage.waitFor();

    assert.match((await profileAvatarImage.getAttribute("src")) || "", /^blob:/);
    assert.match((await topbarAvatarImage.getAttribute("src")) || "", /^blob:/);
    assert.match((await sidebarAvatarImage.getAttribute("src")) || "", /^blob:/);

    await page.reload();
    await profileAvatarImage.waitFor();
    await topbarAvatarImage.waitFor();
    await sidebarAvatarImage.waitFor();

    await removeAvatarButton.click();
    await page.getByText(/Profile changes were saved\./i).waitFor();
    await page.waitForTimeout(300);

    assert.equal(await profileAvatarImage.count(), 0, "Profile page should return to initials fallback after avatar removal.");
    assert.equal(await topbarAvatarImage.count(), 0, "Topbar should return to initials fallback after avatar removal.");
    assert.equal(await sidebarAvatarImage.count(), 0, "Sidebar should return to initials fallback after avatar removal.");

    assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join("\n")}`);
    assert.deepEqual(consoleErrors, [], `Unexpected console errors: ${consoleErrors.join("\n")}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          verified: {
            addStudentModalLabels: true,
            addStudentMiddleInitialFieldPresent: true,
            addStudentLegacyActivationCheckboxRemoved: true,
            addStudentButtonTextUpdated: true,
            sectionDisabledWithoutYearLevel: true,
            sectionEmptyStateMessage: true,
            studentRowActionsPresent: true,
            bulkSetupLinkActionPresent: true,
            avatarUpdatesProfileTopbarSidebarImmediately: true,
            avatarPersistsAfterReload: true,
            avatarRemovalRestoresInitialsFallback: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
