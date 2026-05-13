const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();

const STUDENTS = Number(process.env.LOAD_FIXTURE_STUDENTS || 1000);
const TEACHERS = Number(process.env.LOAD_FIXTURE_TEACHERS || 50);
const ADMINS = Number(process.env.LOAD_FIXTURE_ADMINS || 5);
const SECTIONS = Number(process.env.LOAD_FIXTURE_SECTIONS || 50);
const SUBJECTS = Number(process.env.LOAD_FIXTURE_SUBJECTS || 150);
const TASKS_PER_SUBJECT = Number(process.env.LOAD_FIXTURE_TASKS_PER_SUBJECT || 5);
const SUBMISSIONS = Number(process.env.LOAD_FIXTURE_SUBMISSIONS || 10000);
const NOTIFICATIONS = Number(process.env.LOAD_FIXTURE_NOTIFICATIONS || 10000);

const PREFIX = 'load-fixture';

function assertSafeEnvironment() {
  const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  const allow = process.env.ALLOW_LOAD_FIXTURE_SEED === 'true';
  if (appEnv === 'production' && !allow) {
    throw new Error('Refusing to seed load fixtures in production without ALLOW_LOAD_FIXTURE_SEED=true.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
}

function passwordHash() {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync('SyntheticLoadPassword-DoNotUseForHumans-123!', salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function email(role, n) {
  return `${PREFIX}-${role}-${String(n).padStart(5, '0')}@example.invalid`;
}

async function upsertUser(role, n, extra = {}) {
  const roleLower = role.toLowerCase();
  return prisma.user.upsert({
    where: { email: email(roleLower, n) },
    create: {
      email: email(roleLower, n),
      passwordHash: passwordHash(),
      role,
      status: 'ACTIVE',
      firstName: `${PREFIX}-${roleLower}`,
      lastName: String(n).padStart(5, '0'),
      ...extra,
    },
    update: { status: 'ACTIVE', ...extra },
  });
}

async function main() {
  assertSafeEnvironment();

  const academicYear = await prisma.academicYear.upsert({
    where: { name: `${PREFIX}-ay-2026` },
    create: { name: `${PREFIX}-ay-2026`, status: 'ACTIVE' },
    update: { status: 'ACTIVE' },
  });

  const course = await prisma.course.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: `${PREFIX}-course` } },
    create: { academicYearId: academicYear.id, name: `${PREFIX}-course`, code: `${PREFIX}-course` },
    update: {},
  });

  const level = await prisma.academicYearLevel.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: `${PREFIX}-level-1` } },
    create: { academicYearId: academicYear.id, courseId: course.id, name: `${PREFIX}-level-1`, sortOrder: 1 },
    update: {},
  });

  const sections = [];
  for (let i = 1; i <= SECTIONS; i += 1) {
    sections.push(await prisma.section.upsert({
      where: { academicYearId_name: { academicYearId: academicYear.id, name: `${PREFIX}-section-${String(i).padStart(3, '0')}` } },
      create: {
        academicYearId: academicYear.id,
        academicYearLevelId: level.id,
        name: `${PREFIX}-section-${String(i).padStart(3, '0')}`,
        course: course.name,
        yearLevel: 1,
        yearLevelName: level.name,
      },
      update: {},
    }));
  }

  const teachers = [];
  for (let i = 1; i <= TEACHERS; i += 1) {
    const user = await upsertUser('TEACHER', i);
    const profile = await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, employeeId: `${PREFIX}-teacher-${String(i).padStart(5, '0')}`, department: `${PREFIX}-department-${(i % 5) + 1}` },
      update: { department: `${PREFIX}-department-${(i % 5) + 1}` },
    });
    teachers.push(profile);
  }

  for (let i = 1; i <= ADMINS; i += 1) {
    await upsertUser('ADMIN', i);
  }

  const students = [];
  for (let i = 1; i <= STUDENTS; i += 1) {
    const user = await upsertUser('STUDENT', i);
    const section = sections[(i - 1) % sections.length];
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        studentNumber: `${PREFIX}-student-${String(i).padStart(5, '0')}`,
        sectionId: section.id,
        academicYearId: academicYear.id,
        academicYearLevelId: level.id,
        course: course.name,
        yearLevel: 1,
        yearLevelName: level.name,
      },
      update: { sectionId: section.id, academicYearId: academicYear.id, academicYearLevelId: level.id },
    });
    students.push({ user, profile, section });
  }

  const subjects = [];
  for (let i = 1; i <= SUBJECTS; i += 1) {
    const teacher = teachers[(i - 1) % teachers.length];
    const subject = await prisma.subject.upsert({
      where: { code: `${PREFIX}-subject-${String(i).padStart(4, '0')}` },
      create: {
        code: `${PREFIX}-subject-${String(i).padStart(4, '0')}`,
        name: `${PREFIX} Subject ${i}`,
        teacherId: teacher.id,
        status: 'ACTIVE',
        isOpen: true,
        groupEnabled: i % 5 === 0,
        maxGroupSize: i % 5 === 0 ? 4 : 1,
      },
      update: { teacherId: teacher.id, status: 'ACTIVE', isOpen: true },
    });
    subjects.push(subject);
    const section = sections[(i - 1) % sections.length];
    await prisma.subjectSection.upsert({
      where: { subjectId_sectionId: { subjectId: subject.id, sectionId: section.id } },
      create: { subjectId: subject.id, sectionId: section.id },
      update: {},
    });
  }

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    for (let j = 0; j < 3; j += 1) {
      const subject = subjects[(i + j) % subjects.length];
      await prisma.enrollment.upsert({
        where: { studentId_subjectId: { studentId: student.profile.id, subjectId: subject.id } },
        create: { studentId: student.profile.id, subjectId: subject.id, sectionId: student.section.id },
        update: { sectionId: student.section.id },
      });
    }
  }

  const tasks = [];
  for (const subject of subjects) {
    for (let j = 1; j <= TASKS_PER_SUBJECT; j += 1) {
      tasks.push(await prisma.submissionTask.upsert({
        where: { subjectId_title: { subjectId: subject.id, title: `${PREFIX}-task-${j}` } },
        create: {
          subjectId: subject.id,
          title: `${PREFIX}-task-${j}`,
          description: 'Synthetic load fixture task',
          isOpen: true,
          maxFileSizeMb: 10,
        },
        update: { isOpen: true },
      }));
    }
  }

  for (let i = 1; i <= SUBMISSIONS; i += 1) {
    const student = students[(i - 1) % students.length];
    const task = tasks[(i - 1) % tasks.length];
    const existing = await prisma.submission.findFirst({ where: { taskId: task.id, studentId: student.user.id } });
    const submission = existing || await prisma.submission.create({
      data: {
        taskId: task.id,
        subjectId: task.subjectId,
        studentId: student.user.id,
        submittedById: student.user.id,
        title: `${PREFIX}-submission-${String(i).padStart(6, '0')}`,
        status: i % 4 === 0 ? 'REVIEWED' : 'SUBMITTED',
        submittedAt: new Date(),
        description: 'Synthetic load fixture submission',
        externalLinks: [],
      },
    });
    await prisma.submissionFile.create({
      data: {
        submissionId: submission.id,
        fileName: `${PREFIX}-file-${String(i).padStart(6, '0')}.txt`,
        fileSize: 4,
        relativePath: `submissions/${PREFIX}-file-${String(i).padStart(6, '0')}.txt`,
      },
    }).catch(() => undefined);
  }

  for (let i = 1; i <= NOTIFICATIONS; i += 1) {
    const student = students[(i - 1) % students.length];
    await prisma.notification.create({
      data: {
        userId: student.user.id,
        title: `${PREFIX}-notification-${String(i).padStart(6, '0')}`,
        body: 'Synthetic load fixture notification',
        type: 'LOAD_TEST',
        dedupeKey: `${PREFIX}-notification-${String(i).padStart(6, '0')}`,
      },
    }).catch(() => undefined);
  }

  console.log('Synthetic load fixture seed complete');
  console.log(`students: ${STUDENTS}`);
  console.log(`teachers: ${TEACHERS}`);
  console.log(`admins: ${ADMINS}`);
  console.log(`sections: ${SECTIONS}`);
  console.log(`subjects: ${SUBJECTS}`);
  console.log(`activities: ${tasks.length}`);
  console.log(`submissions: ${SUBMISSIONS}`);
  console.log(`notifications: ${NOTIFICATIONS}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
