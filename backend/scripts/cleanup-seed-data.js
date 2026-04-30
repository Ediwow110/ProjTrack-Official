const path = require('path');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');

config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const SEED_EMAILS = [
  'admin@projtrack.local',
  'teacher@projtrack.local',
  'student@projtrack.local',
];

async function safeDelete(label, fn) {
  try {
    const result = await fn();
    const count = typeof result?.count === 'number' ? result.count : 0;
    console.log(`[cleanup-seed] ${label}: ${count}`);
    return count;
  } catch (error) {
    console.warn(`[cleanup-seed] ${label}: skipped (${error.message})`);
    return 0;
  }
}

async function main() {
  console.log('[cleanup-seed] Starting seed/demo cleanup (best effort).');

  const summary = {
    submissionFiles: 0,
    submissionEvents: 0,
    submissions: 0,
    groupMembers: 0,
    groups: 0,
    enrollments: 0,
    subjectSections: 0,
    submissionTasks: 0,
    subjects: 0,
    announcements: 0,
    requests: 0,
    authSessions: 0,
    accountActionTokens: 0,
    notifications: 0,
    auditLogs: 0,
    teacherProfiles: 0,
    studentProfiles: 0,
    users: 0,
    sections: 0,
    academicYearLevels: 0,
    academicYears: 0,
  };

  const subject = await prisma.subject.findUnique({ where: { code: 'IT 401' } });
  if (subject) {
    const taskIds = (
      await prisma.submissionTask.findMany({
        where: { subjectId: subject.id },
        select: { id: true },
      })
    ).map((row) => row.id);

    const submissionIds = (
      await prisma.submission.findMany({
        where: {
          OR: [{ subjectId: subject.id }, taskIds.length ? { taskId: { in: taskIds } } : undefined].filter(Boolean),
        },
        select: { id: true },
      })
    ).map((row) => row.id);

    if (submissionIds.length) {
      summary.submissionFiles += await safeDelete('Submission files', () =>
        prisma.submissionFile.deleteMany({ where: { submissionId: { in: submissionIds } } }),
      );
      summary.submissionEvents += await safeDelete('Submission events', () =>
        prisma.submissionEvent.deleteMany({ where: { submissionId: { in: submissionIds } } }),
      );
      summary.submissions += await safeDelete('Submissions', () =>
        prisma.submission.deleteMany({ where: { id: { in: submissionIds } } }),
      );
    }

    summary.groupMembers += await safeDelete('Group members for IT 401', () =>
      prisma.groupMember.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.groups += await safeDelete('Groups for IT 401', () =>
      prisma.group.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.enrollments += await safeDelete('Enrollments for IT 401', () =>
      prisma.enrollment.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.subjectSections += await safeDelete('Subject-section links for IT 401', () =>
      prisma.subjectSection.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.submissionTasks += await safeDelete('Submission tasks for IT 401', () =>
      prisma.submissionTask.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.subjects += await safeDelete('Subject IT 401', () =>
      prisma.subject.deleteMany({ where: { id: subject.id } }),
    );
  }

  summary.announcements += await safeDelete('Seed announcement', () =>
    prisma.announcement.deleteMany({
      where: {
        title: 'Midterm Review Week',
        body: 'Please check your subject deadlines this week.',
      },
    }),
  );

  summary.requests += await safeDelete('Seed request', () =>
    prisma.request.deleteMany({
      where: {
        requester: 'Maria Santos',
        type: 'Late Submission Appeal',
        subject: 'Capstone Project',
      },
    }),
  );

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
    select: { id: true },
  });
  const seedUserIds = seedUsers.map((user) => user.id);

  if (seedUserIds.length) {
    summary.authSessions += await safeDelete('Auth sessions', () =>
      prisma.authSession.deleteMany({ where: { userId: { in: seedUserIds } } }),
    );
    summary.accountActionTokens += await safeDelete('Account action tokens', () =>
      prisma.accountActionToken.deleteMany({ where: { userId: { in: seedUserIds } } }),
    );
    summary.notifications += await safeDelete('Notifications', () =>
      prisma.notification.deleteMany({ where: { userId: { in: seedUserIds } } }),
    );
    summary.auditLogs += await safeDelete('Audit logs (actorUserId)', () =>
      prisma.auditLog.deleteMany({ where: { actorUserId: { in: seedUserIds } } }),
    );
    summary.groupMembers += await safeDelete('Group members (studentId)', () =>
      prisma.groupMember.deleteMany({ where: { studentId: { in: seedUserIds } } }),
    );

    await safeDelete('Submission actor links (set null)', () =>
      prisma.submission.updateMany({
        where: { submittedById: { in: seedUserIds } },
        data: { submittedById: null },
      }),
    );
    await safeDelete('Submission reviewer links (set null)', () =>
      prisma.submission.updateMany({
        where: { reviewerId: { in: seedUserIds } },
        data: { reviewerId: null },
      }),
    );
    await safeDelete('Submission owner links (set null)', () =>
      prisma.submission.updateMany({
        where: { studentId: { in: seedUserIds } },
        data: { studentId: null },
      }),
    );
    await safeDelete('Submission event actor links (set null)', () =>
      prisma.submissionEvent.updateMany({
        where: { actorUserId: { in: seedUserIds } },
        data: { actorUserId: null },
      }),
    );

    summary.teacherProfiles += await safeDelete('Teacher profiles', () =>
      prisma.teacherProfile.deleteMany({ where: { userId: { in: seedUserIds } } }),
    );
    summary.studentProfiles += await safeDelete('Student profiles', () =>
      prisma.studentProfile.deleteMany({ where: { userId: { in: seedUserIds } } }),
    );
    summary.users += await safeDelete('Seed users', () =>
      prisma.user.deleteMany({ where: { id: { in: seedUserIds } } }),
    );
  }

  const section = await prisma.section.findFirst({ where: { name: 'BSIT 3A' }, select: { id: true } });
  if (section) {
    summary.enrollments += await safeDelete('Section enrollments', () =>
      prisma.enrollment.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.groups += await safeDelete('Section groups', () =>
      prisma.group.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.subjectSections += await safeDelete('Section subject links', () =>
      prisma.subjectSection.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.sections += await safeDelete('Section BSIT 3A', () =>
      prisma.section.deleteMany({ where: { id: section.id } }),
    );
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { name: '2025-2026' },
    select: { id: true },
  });
  if (academicYear) {
    summary.academicYearLevels += await safeDelete('Academic year levels (2025-2026)', () =>
      prisma.academicYearLevel.deleteMany({ where: { academicYearId: academicYear.id } }),
    );
    summary.academicYears += await safeDelete('Academic year 2025-2026', () =>
      prisma.academicYear.deleteMany({ where: { id: academicYear.id } }),
    );
  }

  console.log('[cleanup-seed] Cleanup summary:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('[cleanup-seed] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
