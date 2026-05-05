#!/usr/bin/env node
/**
 * Idempotent local/staging smoke fixture seeder.
 *
 * Provisions the minimum data graph required for npm run e2e:smoke:
 *  - AcademicYear (smoke)
 *  - Section (smoke)
 *  - User + StudentProfile (STUDENT, ACTIVE) enrolled in the smoke subject/section
 *  - User + TeacherProfile (TEACHER, ACTIVE) owning the smoke subject
 *  - User (ADMIN, ACTIVE)
 *  - Subject + SubjectSection (smoke) linking teacher and student
 *  - Enrollment linking student to subject in the smoke section
 *
 * Safety guarantees:
 *  - Never logs passwords.
 *  - Never resets the database.
 *  - Never deletes existing data.
 *  - Refuses to run in production unless ALLOW_SMOKE_FIXTURES_IN_PRODUCTION=true.
 *  - Idempotent: safe to rerun. Existing matching records are reused or patched only
 *    where the patch is required to make smoke pass (status=ACTIVE, ownership wiring).
 *
 * Required env vars:
 *  SMOKE_ADMIN_IDENTIFIER, SMOKE_ADMIN_PASSWORD,
 *  SMOKE_TEACHER_IDENTIFIER, SMOKE_TEACHER_PASSWORD,
 *  SMOKE_STUDENT_IDENTIFIER, SMOKE_STUDENT_PASSWORD
 *
 * Optional env vars:
 *  SMOKE_FIXTURE_PREFIX        default "SMOKE"
 *  SMOKE_ACADEMIC_YEAR_NAME    default "Smoke AY 2026"
 *  SMOKE_SECTION_NAME          default "Smoke Section A"
 *  SMOKE_SUBJECT_NAME          default "Smoke Subject"
 *  SMOKE_SUBJECT_CODE          default "${prefix}-SUBJ-1"
 *  SMOKE_TEACHER_EMPLOYEE_ID   default "${prefix}-T-1"
 *  SMOKE_STUDENT_NUMBER        default "${prefix}-S-1"
 *  ALLOW_SMOKE_FIXTURES_IN_PRODUCTION  if not "true", aborts when NODE_ENV=production
 */

const { randomBytes, scryptSync } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function readRequiredEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function maskIdentifier(identifier) {
  // Best-effort masking for log lines. Never logs the password.
  if (!identifier) return '<empty>';
  if (identifier.includes('@')) {
    const [local, domain] = identifier.split('@');
    if (local.length <= 2) return `${local[0] ?? ''}*@${domain}`;
    return `${local[0]}${'*'.repeat(Math.min(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
  }
  if (identifier.length <= 4) return `${identifier[0] ?? ''}***`;
  return `${identifier.slice(0, 2)}***${identifier.slice(-2)}`;
}

async function main() {
  const nodeEnv = String(process.env.NODE_ENV ?? '').toLowerCase();
  const appEnv = String(process.env.APP_ENV ?? '').toLowerCase();
  const allowProd = String(process.env.ALLOW_SMOKE_FIXTURES_IN_PRODUCTION ?? '').toLowerCase() === 'true';
  if ((nodeEnv === 'production' || appEnv === 'production') && !allowProd) {
    throw new Error(
      'Refusing to seed smoke fixtures in production. ' +
        'Set ALLOW_SMOKE_FIXTURES_IN_PRODUCTION=true only if this is intentional and the target DB is disposable.',
    );
  }

  const adminEmail = readRequiredEnv('SMOKE_ADMIN_IDENTIFIER').toLowerCase();
  const adminPassword = readRequiredEnv('SMOKE_ADMIN_PASSWORD');
  const teacherEmail = readRequiredEnv('SMOKE_TEACHER_IDENTIFIER').toLowerCase();
  const teacherPassword = readRequiredEnv('SMOKE_TEACHER_PASSWORD');
  const studentEmail = readRequiredEnv('SMOKE_STUDENT_IDENTIFIER').toLowerCase();
  const studentPassword = readRequiredEnv('SMOKE_STUDENT_PASSWORD');

  const prefix = String(process.env.SMOKE_FIXTURE_PREFIX ?? 'SMOKE').trim() || 'SMOKE';
  const academicYearName = String(process.env.SMOKE_ACADEMIC_YEAR_NAME ?? 'Smoke AY 2026').trim();
  const sectionName = String(process.env.SMOKE_SECTION_NAME ?? 'Smoke Section A').trim();
  const subjectName = String(process.env.SMOKE_SUBJECT_NAME ?? 'Smoke Subject').trim();
  const subjectCode = String(process.env.SMOKE_SUBJECT_CODE ?? `${prefix}-SUBJ-1`).trim();
  const teacherEmployeeId = String(process.env.SMOKE_TEACHER_EMPLOYEE_ID ?? `${prefix}-T-1`).trim();
  const studentNumber = String(process.env.SMOKE_STUDENT_NUMBER ?? `${prefix}-S-1`).trim();

  const prisma = new PrismaClient();
  const summary = {
    adminUser: 'unchanged',
    teacherUser: 'unchanged',
    teacherProfile: 'unchanged',
    studentUser: 'unchanged',
    studentProfile: 'unchanged',
    academicYear: 'unchanged',
    section: 'unchanged',
    subject: 'unchanged',
    subjectSection: 'unchanged',
    enrollment: 'unchanged',
  };

  try {
    // 1. Academic year
    const academicYear = await prisma.academicYear.upsert({
      where: { name: academicYearName },
      create: { name: academicYearName, status: 'ACTIVE' },
      update: {},
    });
    summary.academicYear = `id=${academicYear.id}, name=${academicYearName}`;

    // 2. Section
    let section = await prisma.section.findFirst({
      where: { academicYearId: academicYear.id, name: sectionName },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          name: sectionName,
          academicYearId: academicYear.id,
          description: 'Smoke fixture section. Safe to delete after smoke testing.',
        },
      });
      summary.section = `created id=${section.id}, name=${sectionName}`;
    } else {
      summary.section = `reused id=${section.id}, name=${sectionName}`;
    }

    // 3. Admin user
    const adminHash = hashPassword(adminPassword);
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        passwordHash: adminHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Smoke',
        lastName: 'Admin',
      },
      update: {
        passwordHash: adminHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    summary.adminUser = `id=${adminUser.id}, identifier=${maskIdentifier(adminEmail)}`;

    // 4. Teacher user + profile
    const teacherHash = hashPassword(teacherPassword);
    const teacherUser = await prisma.user.upsert({
      where: { email: teacherEmail },
      create: {
        email: teacherEmail,
        passwordHash: teacherHash,
        role: 'TEACHER',
        status: 'ACTIVE',
        firstName: 'Smoke',
        lastName: 'Teacher',
      },
      update: {
        passwordHash: teacherHash,
        role: 'TEACHER',
        status: 'ACTIVE',
      },
    });
    summary.teacherUser = `id=${teacherUser.id}, identifier=${maskIdentifier(teacherEmail)}`;

    const teacherProfile = await prisma.teacherProfile.upsert({
      where: { userId: teacherUser.id },
      create: {
        userId: teacherUser.id,
        employeeId: teacherEmployeeId,
        department: 'Smoke Department',
      },
      update: { employeeId: teacherEmployeeId },
    });
    summary.teacherProfile = `id=${teacherProfile.id}, employeeId=${teacherEmployeeId}`;

    // 5. Student user + profile
    const studentHash = hashPassword(studentPassword);
    const studentUser = await prisma.user.upsert({
      where: { email: studentEmail },
      create: {
        email: studentEmail,
        passwordHash: studentHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        firstName: 'Smoke',
        lastName: 'Student',
      },
      update: {
        passwordHash: studentHash,
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    });
    summary.studentUser = `id=${studentUser.id}, identifier=${maskIdentifier(studentEmail)}`;

    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: studentUser.id },
      create: {
        userId: studentUser.id,
        studentNumber,
        sectionId: section.id,
        academicYearId: academicYear.id,
        course: 'Smoke Course',
      },
      update: {
        studentNumber,
        sectionId: section.id,
        academicYearId: academicYear.id,
        yearLevel: null,
        yearLevelName: null,
      },
    });
    summary.studentProfile = `id=${studentProfile.id}, studentNumber=${studentNumber}`;

    // 6. Subject (owned by teacher)
    const subject = await prisma.subject.upsert({
      where: { code: subjectCode },
      create: {
        code: subjectCode,
        name: subjectName,
        teacherId: teacherProfile.id,
        status: 'ACTIVE',
        isOpen: true,
      },
      update: {
        name: subjectName,
        teacherId: teacherProfile.id,
        status: 'ACTIVE',
        isOpen: true,
      },
    });
    summary.subject = `id=${subject.id}, code=${subjectCode}`;

    // 7. SubjectSection (link subject -> section)
    const subjectSection = await prisma.subjectSection.upsert({
      where: { subjectId_sectionId: { subjectId: subject.id, sectionId: section.id } },
      create: { subjectId: subject.id, sectionId: section.id },
      update: {},
    });
    summary.subjectSection = `id=${subjectSection.id}`;

    // 8. Enrollment (student -> subject in section)
    const enrollment = await prisma.enrollment.upsert({
      where: { studentId_subjectId: { studentId: studentProfile.id, subjectId: subject.id } },
      create: {
        studentId: studentProfile.id,
        subjectId: subject.id,
        sectionId: section.id,
      },
      update: { sectionId: section.id },
    });
    summary.enrollment = `id=${enrollment.id}`;

    console.log('Smoke fixtures ready:');
    for (const [key, value] of Object.entries(summary)) {
      console.log(`  ${key.padEnd(16)} ${value}`);
    }
    console.log('');
    console.log('Now you can run:');
    console.log('  npm run check:smoke-deps');
    console.log('  npm run check:smoke-env');
    console.log('  npm run e2e:smoke');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never include passwords in error output.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ensure-smoke-fixtures] ${message}`);
  process.exit(1);
});
