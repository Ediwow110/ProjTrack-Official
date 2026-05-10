const path = require('path');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');

config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const SEED_EMAILS = [
  'admin@projtrack.local',
  'teacher@projtrack.local',
  'student@projtrack.local',
  'smoke.teacher@example.test',
  'smoke.student@example.test',
];

const KEEP_EMAILS = new Set([
  'admin@projtrack.codes',
  String(process.env.PROJTRACK_ADMIN_EMAIL || process.env.SMOKE_ADMIN_IDENTIFIER || '').trim().toLowerCase(),
].filter(Boolean));

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

  const smokeSubjectCodes = ['IT 401', 'SMOKE-SUBJ-1'];
  const subjects = await prisma.subject.findMany({ where: { code: { in: smokeSubjectCodes } } });
  for (const subject of subjects) {
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
      summary.submissionFiles += await safeDelete(`Submission files for ${subject.code}`, () =>
        prisma.submissionFile.deleteMany({ where: { submissionId: { in: submissionIds } } }),
      );
      summary.submissionEvents += await safeDelete(`Submission events for ${subject.code}`, () =>
        prisma.submissionEvent.deleteMany({ where: { submissionId: { in: submissionIds } } }),
      );
      summary.submissions += await safeDelete(`Submissions for ${subject.code}`, () =>
        prisma.submission.deleteMany({ where: { id: { in: submissionIds } } }),
      );
    }

    summary.groupMembers += await safeDelete(`Group members for ${subject.code}`, () =>
      prisma.groupMember.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.groups += await safeDelete(`Groups for ${subject.code}`, () =>
      prisma.group.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.enrollments += await safeDelete(`Enrollments for ${subject.code}`, () =>
      prisma.enrollment.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.subjectSections += await safeDelete(`Subject-section links for ${subject.code}`, () =>
      prisma.subjectSection.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.submissionTasks += await safeDelete(`Submission tasks for ${subject.code}`, () =>
      prisma.submissionTask.deleteMany({ where: { subjectId: subject.id } }),
    );
    summary.subjects += await safeDelete(`Subject ${subject.code}`, () =>
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
    where: {
      OR: [
        { email: { in: SEED_EMAILS } },
        { email: { endsWith: '@example.test' } },
        { firstName: 'Smoke' },
      ],
      NOT: { email: { in: [...KEEP_EMAILS] } },
    },
    select: { id: true, email: true },
  });
  const seedUserIds = seedUsers.map((user) => user.id);

  if (seedUserIds.length) {
    console.log(`[cleanup-seed] Removing local/smoke users: ${seedUsers.map((user) => user.email).join(', ')}`);
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

  const sectionNames = ['BSIT 3A', 'Smoke Section A'];
  const sections = await prisma.section.findMany({ where: { name: { in: sectionNames } }, select: { id: true, name: true } });
  for (const section of sections) {
    summary.enrollments += await safeDelete(`Section enrollments for ${section.name}`, () =>
      prisma.enrollment.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.groups += await safeDelete(`Section groups for ${section.name}`, () =>
      prisma.group.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.subjectSections += await safeDelete(`Section subject links for ${section.name}`, () =>
      prisma.subjectSection.deleteMany({ where: { sectionId: section.id } }),
    );
    summary.sections += await safeDelete(`Section ${section.name}`, () =>
      prisma.section.deleteMany({ where: { id: section.id } }),
    );
  }

  const academicYears = await prisma.academicYear.findMany({
    where: { name: { in: ['2025-2026', 'Smoke AY 2026'] } },
    select: { id: true, name: true },
  });
  for (const academicYear of academicYears) {
    summary.academicYearLevels += await safeDelete(`Academic year levels (${academicYear.name})`, () =>
      prisma.academicYearLevel.deleteMany({ where: { academicYearId: academicYear.id } }),
    );
    summary.academicYears += await safeDelete(`Academic year ${academicYear.name}`, () =>
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
