import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const backendRoot = path.resolve(fileURLToPath(new URL("../../backend/", import.meta.url)));
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const { config: loadDotenv } = backendRequire("dotenv") as {
  config: (input: { path: string; override?: boolean }) => void;
};
loadDotenv({ path: path.join(backendRoot, ".env"), override: false });
const { PrismaClient } = backendRequire("@prisma/client") as {
  PrismaClient: new () => {
    submission: {
      findMany: (input: unknown) => Promise<Array<{ id: string }>>;
      deleteMany: (input: unknown) => Promise<unknown>;
    };
    submissionTask: {
      findMany: (input: unknown) => Promise<Array<{ id: string }>>;
      deleteMany: (input: unknown) => Promise<unknown>;
    };
    announcement: {
      deleteMany: (input: unknown) => Promise<unknown>;
    };
    auditLog: {
      deleteMany: (input: unknown) => Promise<unknown>;
    };
    $disconnect: () => Promise<void>;
  };
};
const prisma = new PrismaClient();

const accounts = {
  student: {
    role: "student",
    identifier: process.env.SMOKE_STUDENT_IDENTIFIER || "",
    password: process.env.SMOKE_STUDENT_PASSWORD || "",
    identifierLabel: /Student ID or Email/i,
    buttonName: /Sign In as Student/i,
    dashboardPath: "/student/dashboard",
  },
  teacher: {
    role: "teacher",
    identifier: process.env.SMOKE_TEACHER_IDENTIFIER || "",
    password: process.env.SMOKE_TEACHER_PASSWORD || "",
    identifierLabel: /Employee ID or School Email/i,
    buttonName: /Sign In as Teacher/i,
    dashboardPath: "/teacher/dashboard",
  },
  admin: {
    role: "admin",
    identifier: process.env.SMOKE_ADMIN_IDENTIFIER || "",
    password: process.env.SMOKE_ADMIN_PASSWORD || "",
    identifierLabel: /Admin Email/i,
    buttonName: /Sign In as Admin/i,
    dashboardPath: "/admin/dashboard",
  },
} as const;

const hasSmokeCredentials = [accounts.student, accounts.teacher, accounts.admin].every(
  (account) => Boolean(String(account.identifier).trim()) && Boolean(String(account.password).trim()),
);

test.skip(!hasSmokeCredentials, 'Set SMOKE_* identifiers and passwords before running e2e workflow smoke.');

type RuntimeTracker = {
  consoleErrors: string[];
  pageErrors: string[];
};

type SmokeCleanupInput = {
  activityTitle?: string;
  submissionTitle?: string;
  announcementTitle?: string;
};

async function cleanupSmokeArtifacts({
  activityTitle,
  submissionTitle,
  announcementTitle,
}: SmokeCleanupInput) {
  const normalizedActivityTitle = String(activityTitle ?? "").trim();
  const normalizedSubmissionTitle = String(submissionTitle ?? "").trim();
  const normalizedAnnouncementTitle = String(announcementTitle ?? "").trim();
  const auditTargets = [
    normalizedActivityTitle,
    normalizedSubmissionTitle,
    normalizedAnnouncementTitle,
  ].filter(Boolean);
  const submissionIds = new Set<string>();

  if (normalizedSubmissionTitle) {
    const directSubmissions = await prisma.submission.findMany({
      where: { title: normalizedSubmissionTitle },
      select: { id: true },
    });
    directSubmissions.forEach((submission) => submissionIds.add(submission.id));
  }

  let activityIds: string[] = [];
  if (normalizedActivityTitle) {
    const activities = await prisma.submissionTask.findMany({
      where: { title: normalizedActivityTitle },
      select: { id: true },
    });
    activityIds = activities.map((activity) => activity.id);

    if (activityIds.length) {
      const activitySubmissions = await prisma.submission.findMany({
        where: { taskId: { in: activityIds } },
        select: { id: true },
      });
      activitySubmissions.forEach((submission) => submissionIds.add(submission.id));
    }
  }

  if (submissionIds.size > 0) {
    await prisma.submission.deleteMany({
      where: { id: { in: Array.from(submissionIds) } },
    });
  }

  if (activityIds.length > 0) {
    await prisma.submissionTask.deleteMany({
      where: { id: { in: activityIds } },
    });
  }

  if (normalizedAnnouncementTitle) {
    await prisma.announcement.deleteMany({
      where: { title: normalizedAnnouncementTitle },
    });
  }

  if (auditTargets.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { target: { in: auditTargets } },
    });
  }
}

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

async function login(
  page: Page,
  account: (typeof accounts)[keyof typeof accounts],
  tracker: RuntimeTracker,
) {
  await page.goto(`/${account.role}/login`);
  await page.getByLabel(account.identifierLabel).fill(account.identifier);
  await page.getByLabel(/^Password$/i).fill(account.password);
  await page.getByRole("button", { name: account.buttonName }).click();
  await expect(page).toHaveURL(new RegExp(`${account.dashboardPath.replace(/\//g, "\\/")}$`));
  await assertHealthy(page, tracker);
}

async function newTrackedPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const tracker = attachRuntimeTracker(page);
  return { context, page, tracker };
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("teacher can create an activity, student can submit it, and teacher can grade it", async ({
  browser,
}) => {
  test.slow();
  test.setTimeout(180000);

  const suffix = Date.now();
  const activityTitle = `Smoke Activity ${suffix}`;
  const submissionTitle = `Smoke Submission ${suffix}`;
  const description = `Smoke description ${suffix}`;
  const feedback = `Smoke feedback ${suffix}`;
  const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const teacherAuthor = await newTrackedPage(browser);
    try {
      await login(teacherAuthor.page, accounts.teacher, teacherAuthor.tracker);
      await teacherAuthor.page.goto("/teacher/subjects");
      await teacherAuthor.page.getByRole("link", { name: /Open subject/i }).first().click();
      await teacherAuthor.page.getByRole("button", { name: /Add Submission/i }).click();
      await teacherAuthor.page.getByLabel(/Submission title/i).fill(activityTitle);
      await teacherAuthor.page.getByLabel(/Submission instructions/i).fill(
        "Smoke instructions for a teacher-created individual submission.",
      );
      await teacherAuthor.page.getByLabel(/^Deadline$/i).fill(deadline);
      await teacherAuthor.page.getByLabel(/Submission mode/i).selectOption("INDIVIDUAL");
      await teacherAuthor.page.getByRole("button", { name: /Create Submission/i }).click();
      await expect(
        teacherAuthor.page.getByText(/Submission activity created/i),
      ).toBeVisible();
      await expect(teacherAuthor.page.getByText(activityTitle)).toBeVisible();
      await assertHealthy(teacherAuthor.page, teacherAuthor.tracker);
    } finally {
      await teacherAuthor.context.close();
    }

    const student = await newTrackedPage(browser);
    try {
      await login(student.page, accounts.student, student.tracker);
      await student.page.goto("/student/subjects");
      await student.page.getByRole("link", { name: /Open subject/i }).first().click();
      await student.page.getByRole("button", { name: /^Activities$/i }).click();
      const activityHeading = student.page.getByRole("heading", { name: activityTitle }).first();
      await expect(activityHeading).toBeVisible();
      const activityAction = activityHeading.locator(
        "xpath=ancestor::div[contains(@class,'rounded-[26px]')][1]//button[normalize-space()='Submit' or contains(normalize-space(),'Continue') or contains(normalize-space(),'Resubmit')]",
      );
      await expect(activityAction).toBeVisible();
      await activityAction.click();
      await expect(student.page).toHaveURL(/\/student\/submit/);
      await student.page.getByLabel(/Submission Title/i).fill(submissionTitle);
      await student.page.getByLabel(/Description/i).fill(description);
      await student.page.getByLabel(/Notes/i).fill("Smoke workflow submission notes.");
      await student.page.getByRole("button", { name: /^Submit Project$/i }).click();
      await expect(student.page.getByText(/Submission Successful!/i)).toBeVisible();
      await assertHealthy(student.page, student.tracker);
    } finally {
      await student.context.close();
    }

    const teacherReviewer = await newTrackedPage(browser);
    try {
      await login(teacherReviewer.page, accounts.teacher, teacherReviewer.tracker);
      await teacherReviewer.page.goto("/teacher/submissions");
      await teacherReviewer.page
        .getByLabel(/Search teacher submissions/i)
        .fill(submissionTitle);
      const submissionRow = teacherReviewer.page
        .locator("tr")
        .filter({ hasText: submissionTitle })
        .first();
      await expect(submissionRow).toBeVisible();
      await submissionRow.getByRole("button", { name: /^Open$/i }).click();
      await expect(
        teacherReviewer.page.getByLabel(/Feedback \/ Comments/i),
      ).toHaveValue(/Submission received/i);
      await expect(
        teacherReviewer.page.getByLabel(/Grade \(out of 100\)/i),
      ).toBeEnabled();
      await teacherReviewer.page.getByLabel(/Grade \(out of 100\)/i).fill("95");
      await teacherReviewer.page.getByLabel(/Feedback \/ Comments/i).fill(feedback);
      await teacherReviewer.page
        .getByRole("button", { name: /Mark as Graded/i })
        .click();
      await expect(
        teacherReviewer.page.getByText(/Review action saved successfully/i),
      ).toBeVisible();
      await assertHealthy(teacherReviewer.page, teacherReviewer.tracker);
    } finally {
      await teacherReviewer.context.close();
    }
  } finally {
    await cleanupSmokeArtifacts({
      activityTitle,
      submissionTitle,
    });
  }
});

test("admin academic settings save persists after refresh", async ({ browser }) => {
  test.slow();

  const admin = await newTrackedPage(browser);

  try {
    await login(admin.page, accounts.admin, admin.tracker);
    await admin.page.goto("/admin/academic-settings");
    const lateDeductionInput = admin.page.getByLabel(/Point Deduction/i);
    await expect(lateDeductionInput).toBeVisible();

    const currentValue = await lateDeductionInput.inputValue();
    const nextValue = currentValue === "11" ? "12" : "11";

    await lateDeductionInput.fill(nextValue);
    await admin.page.getByRole("button", { name: /Save Settings/i }).click();
    await expect(
      admin.page.getByText(/Academic settings saved successfully/i),
    ).toBeVisible();

    await admin.page.reload();
    await expect(admin.page.getByLabel(/Point Deduction/i)).toHaveValue(nextValue);
    await assertHealthy(admin.page, admin.tracker);
  } finally {
    await admin.context.close();
  }
});

test("admin system settings save persists after refresh", async ({ browser }) => {
  test.slow();

  const admin = await newTrackedPage(browser);

  try {
    await login(admin.page, accounts.admin, admin.tracker);
    await admin.page.goto("/admin/settings");
    const sessionTimeoutInput = admin.page.getByLabel(/Session Timeout/i);
    await expect(sessionTimeoutInput).toBeVisible();

    const currentValue = await sessionTimeoutInput.inputValue();
    const nextValue = currentValue === "65" ? "60" : "65";

    await sessionTimeoutInput.fill(nextValue);
    await admin.page.getByRole("button", { name: /Save Settings/i }).click();
    await expect(
      admin.page.getByText(/Settings saved successfully/i),
    ).toBeVisible();

    await admin.page.reload();
    await expect(admin.page.getByLabel(/Session Timeout/i)).toHaveValue(nextValue);
    await assertHealthy(admin.page, admin.tracker);
  } finally {
    await admin.context.close();
  }
});

test("admin can publish an announcement and see it after refresh", async ({ browser }) => {
  test.slow();

  const admin = await newTrackedPage(browser);
  const title = `Smoke Announcement ${Date.now()}`;

  try {
    await login(admin.page, accounts.admin, admin.tracker);
    await admin.page.goto("/admin/announcements");
    await admin.page.getByRole("button", { name: /New Announcement/i }).click();
    await admin.page.getByLabel(/^Title$/i).fill(title);
    await admin.page.getByLabel(/^Audience$/i).selectOption("ALL");
    await admin.page.getByLabel(/Delivery Intent/i).selectOption("System");
    await admin.page.getByLabel(/^Message$/i).fill(
      "Smoke announcement body for workflow coverage.",
    );
    await admin.page
      .getByRole("button", { name: /Publish Announcement/i })
      .click();
    await expect(admin.page.getByText(title)).toBeVisible();
    await admin.page.reload();
    await expect(admin.page.getByText(title)).toBeVisible();
    await assertHealthy(admin.page, admin.tracker);
  } finally {
    await admin.context.close();
    await cleanupSmokeArtifacts({ announcementTitle: title });
  }
});
