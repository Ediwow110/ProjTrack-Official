const path = require('path');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');

config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DEDUPE_ANNOUNCEMENTS = process.argv.includes('--dedupe-announcements');

const SMOKE_ANNOUNCEMENT_PREFIX = 'Smoke Announcement ';
const SMOKE_ACTIVITY_PREFIX = 'Smoke Activity ';
const SMOKE_SUBMISSION_PREFIX = 'Smoke Submission ';
const TESTMAIL_DOMAIN = '@inbox.testmail.app';

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function collectReport() {
  const [
    smokeAnnouncements,
    smokeActivities,
    smokeSubmissions,
    duplicateAnnouncementTitles,
    pendingTestmailStudents,
  ] = await Promise.all([
    prisma.announcement.findMany({
      where: { title: { startsWith: SMOKE_ANNOUNCEMENT_PREFIX } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.submissionTask.findMany({
      where: { title: { startsWith: SMOKE_ACTIVITY_PREFIX } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.submission.findMany({
      where: { title: { startsWith: SMOKE_SUBMISSION_PREFIX } },
      select: { id: true, title: true, createdAt: true, taskId: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.announcement.groupBy({
      by: ['title'],
      _count: { _all: true },
      having: { title: { _count: { gt: 1 } } },
      orderBy: { title: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        role: 'STUDENT',
        email: { contains: TESTMAIL_DOMAIN },
        status: { in: ['PENDING_SETUP', 'PENDING_PASSWORD_SETUP', 'PENDING_ACTIVATION'] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const duplicateAnnouncementDetails = [];
  for (const entry of duplicateAnnouncementTitles) {
    const items = await prisma.announcement.findMany({
      where: { title: entry.title },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    duplicateAnnouncementDetails.push({
      title: entry.title,
      count: entry._count._all,
      keepId: items[0]?.id ?? null,
      removeIds: items.slice(1).map((item) => item.id),
      items,
    });
  }

  return {
    applyMode: APPLY,
    dedupeAnnouncements: DEDUPE_ANNOUNCEMENTS,
    smokeAnnouncements: {
      count: smokeAnnouncements.length,
      sampleTitles: smokeAnnouncements.slice(0, 10).map((item) => item.title),
    },
    smokeActivities: {
      count: smokeActivities.length,
      sampleTitles: smokeActivities.slice(0, 10).map((item) => item.title),
    },
    smokeSubmissions: {
      count: smokeSubmissions.length,
      sampleTitles: smokeSubmissions.slice(0, 10).map((item) => item.title),
    },
    duplicateAnnouncementTitles: duplicateAnnouncementDetails,
    pendingTestmailStudents: pendingTestmailStudents.map((student) => ({
      id: student.id,
      email: student.email,
      name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      status: student.status,
    })),
  };
}

async function applyCleanup(report) {
  const smokeActivityRows = await prisma.submissionTask.findMany({
    where: { title: { startsWith: SMOKE_ACTIVITY_PREFIX } },
    select: { id: true },
  });
  const smokeActivityIds = smokeActivityRows.map((item) => item.id);

  const directSmokeSubmissionRows = await prisma.submission.findMany({
    where: { title: { startsWith: SMOKE_SUBMISSION_PREFIX } },
    select: { id: true },
  });
  const relatedSmokeSubmissionRows = smokeActivityIds.length
    ? await prisma.submission.findMany({
        where: { taskId: { in: smokeActivityIds } },
        select: { id: true },
      })
    : [];
  const smokeSubmissionIds = uniqueStrings([
    ...directSmokeSubmissionRows.map((item) => item.id),
    ...relatedSmokeSubmissionRows.map((item) => item.id),
  ]);

  const cleanupSummary = {
    deletedSmokeSubmissions: 0,
    deletedSmokeActivities: 0,
    deletedSmokeAnnouncements: 0,
    deletedSmokeAuditLogs: 0,
    deletedDuplicateAnnouncements: 0,
  };

  if (smokeSubmissionIds.length) {
    const result = await prisma.submission.deleteMany({
      where: { id: { in: smokeSubmissionIds } },
    });
    cleanupSummary.deletedSmokeSubmissions = result.count;
  }

  if (smokeActivityIds.length) {
    const result = await prisma.submissionTask.deleteMany({
      where: { id: { in: smokeActivityIds } },
    });
    cleanupSummary.deletedSmokeActivities = result.count;
  }

  const smokeAnnouncementResult = await prisma.announcement.deleteMany({
    where: { title: { startsWith: SMOKE_ANNOUNCEMENT_PREFIX } },
  });
  cleanupSummary.deletedSmokeAnnouncements = smokeAnnouncementResult.count;

  const smokeAuditResult = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { target: { startsWith: SMOKE_ANNOUNCEMENT_PREFIX } },
        { target: { startsWith: SMOKE_ACTIVITY_PREFIX } },
        { target: { startsWith: SMOKE_SUBMISSION_PREFIX } },
      ],
    },
  });
  cleanupSummary.deletedSmokeAuditLogs = smokeAuditResult.count;

  if (DEDUPE_ANNOUNCEMENTS) {
    const duplicateAnnouncementIds = report.duplicateAnnouncementTitles.flatMap((entry) =>
      entry.removeIds,
    );
    if (duplicateAnnouncementIds.length) {
      const result = await prisma.announcement.deleteMany({
        where: { id: { in: duplicateAnnouncementIds } },
      });
      cleanupSummary.deletedDuplicateAnnouncements = result.count;
    }
  }

  return cleanupSummary;
}

async function main() {
  const report = await collectReport();

  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const cleanup = await applyCleanup(report);
  const finalReport = await collectReport();

  console.log(
    JSON.stringify(
      {
        cleanup,
        afterCleanup: finalReport,
        notes: [
          'Pending testmail students are reported only. Delete those manually after review.',
          DEDUPE_ANNOUNCEMENTS
            ? 'Duplicate announcement titles were deduped by keeping the oldest record for each title.'
            : 'Duplicate announcement titles were reported only. Re-run with --dedupe-announcements to remove extras.',
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
