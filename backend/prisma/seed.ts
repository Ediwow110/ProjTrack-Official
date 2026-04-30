import { PrismaClient, Role, UserStatus, SubmissionMode } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();
const allowDemoSeed = String(process.env.ALLOW_DEMO_SEED || 'false').toLowerCase() === 'true';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function seedReferenceData() {
  const academicSetting = await prisma.academicSetting.findFirst();
  if (!academicSetting) {
    await prisma.academicSetting.create({
      data: {
        schoolYear: '2025-2026',
        semester: '2nd Semester',
        submissionStart: '2026-01-15',
        submissionEnd: '2026-05-30',
        latePolicy: '24h',
        lateDeduction: '10',
      },
    });
  }

  const systemSetting = await prisma.systemSetting.findFirst();
  if (!systemSetting) {
    await prisma.systemSetting.create({
      data: {
        schoolName: 'PROJTRACK',
        email: 'admin@projtrack.local',
        notifEmail: 'noreply@projtrack.local',
        minPassLen: '8',
        maxFailedLogins: '5',
        sessionTimeout: '60',
        allowRegistration: false,
        requireEmailVerification: true,
        twoFactorAdmin: false,
        backupFrequency: 'Daily',
      },
    });
  }

  await prisma.systemTool.createMany({
    data: [
      { key: 'backup', title: 'Backup Database', desc: 'Create a full backup package.', status: 'idle' },
      { key: 'restore', title: 'Restore from Backup', desc: 'Restore from a previous backup package.', status: 'idle' },
      { key: 'cache', title: 'Clear Cache', desc: 'Clear cached application data.', status: 'idle' },
      { key: 'purge', title: 'Purge Old Records', desc: 'Delete very old academic records.', status: 'idle' },
      { key: 'diag', title: 'System Diagnostics', desc: 'Run a health check.', status: 'idle' },
      { key: 'export', title: 'Export All Data', desc: 'Export all data to CSV.', status: 'idle' },
    ],
    skipDuplicates: true,
  });
}

async function seedDemoData() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@projtrack.local' },
    update: {
      passwordHash: hashPassword('Admin123!ChangeMe'),
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'System',
      lastName: 'Admin',
      office: 'Main Office',
    },
    create: {
      email: 'admin@projtrack.local',
      passwordHash: hashPassword('Admin123!ChangeMe'),
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'System',
      lastName: 'Admin',
      office: 'Main Office',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@projtrack.local' },
    update: {
      passwordHash: hashPassword('Teacher123!ChangeMe'),
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      firstName: 'Ricardo',
      lastName: 'Dela Cruz',
      office: 'Computing Department',
    },
    create: {
      email: 'teacher@projtrack.local',
      passwordHash: hashPassword('Teacher123!ChangeMe'),
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      firstName: 'Ricardo',
      lastName: 'Dela Cruz',
      office: 'Computing Department',
      teacherProfile: {
        create: {
          employeeId: 'EMP-001',
          department: 'IT Department',
        },
      },
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    update: {
      employeeId: 'EMP-001',
      department: 'IT Department',
    },
    create: {
      userId: teacher.id,
      employeeId: 'EMP-001',
      department: 'IT Department',
    },
  });

  const academicYear =
    (await prisma.academicYear.findFirst({
      where: { name: '2025-2026' },
    })) ??
    (await prisma.academicYear.create({
      data: {
        name: '2025-2026',
        status: 'ACTIVE',
      },
    }));

  const existingSection = await prisma.section.findFirst({
    where: {
      academicYearId: academicYear.id,
      name: 'BSIT 3A',
    },
  });
  const section =
    existingSection ??
    (await prisma.section.create({
      data: {
        name: 'BSIT 3A',
        academicYearId: academicYear.id,
        course: 'BSIT',
        yearLevel: 3,
      },
    }));

  const student = await prisma.user.upsert({
    where: { email: 'student@projtrack.local' },
    update: {
      passwordHash: hashPassword('Student123!ChangeMe'),
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      firstName: 'Maria',
      lastName: 'Santos',
    },
    create: {
      email: 'student@projtrack.local',
      passwordHash: hashPassword('Student123!ChangeMe'),
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      firstName: 'Maria',
      lastName: 'Santos',
      studentProfile: {
        create: {
          studentNumber: 'STU-2024-00142',
          academicYearId: academicYear.id,
          course: 'BSIT',
          yearLevel: 3,
          sectionId: section.id,
        },
      },
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      studentNumber: 'STU-2024-00142',
      academicYearId: academicYear.id,
      course: 'BSIT',
      yearLevel: 3,
      sectionId: section.id,
    },
    create: {
      userId: student.id,
      studentNumber: 'STU-2024-00142',
      academicYearId: academicYear.id,
      course: 'BSIT',
      yearLevel: 3,
      sectionId: section.id,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { code: 'IT 401' },
    update: {
      name: 'Capstone Project',
      teacherId: teacherProfile?.id,
      status: 'ACTIVE',
    },
    create: {
      code: 'IT 401',
      name: 'Capstone Project',
      teacherId: teacherProfile?.id,
      status: 'ACTIVE',
    },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_subjectId: {
        studentId: studentProfile!.id,
        subjectId: subject.id,
      },
    },
    update: {
      sectionId: section.id,
    },
    create: {
      studentId: studentProfile!.id,
      subjectId: subject.id,
      sectionId: section.id,
    },
  });
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Midterm Review Week' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Midterm Review Week',
        body: 'Please check your subject deadlines this week.',
        audience: 'ALL',
        status: 'PUBLISHED',
        publishAt: new Date(),
      },
    });
  }

  const existingRequest = await prisma.request.findFirst({
    where: {
      requester: 'Maria Santos',
      type: 'Late Submission Appeal',
      subject: 'Capstone Project',
    },
  });
  if (!existingRequest) {
    await prisma.request.create({
      data: {
        requester: 'Maria Santos',
        role: 'Student',
        type: 'Late Submission Appeal',
        subject: 'Capstone Project',
        dateLabel: 'Apr 17, 2026',
        status: 'Pending',
        details: 'Requesting allowance for late submission of Chapter 2.',
      },
    });
  }

  const existingTask = await prisma.submissionTask.findFirst({
    where: {
      subjectId: subject.id,
      title: 'Final Project Proposal',
    },
  });

  if (existingTask) {
    await prisma.submissionTask.update({
      where: { id: existingTask.id },
      data: {
        description: 'Submit the final proposal document.',
        deadline: new Date('2026-05-20T23:59:00.000Z'),
        submissionMode: SubmissionMode.GROUP,
        isOpen: true,
        allowLateSubmission: true,
      },
    });
  } else {
    await prisma.submissionTask.create({
      data: {
        subjectId: subject.id,
        title: 'Final Project Proposal',
        description: 'Submit the final proposal document.',
        deadline: new Date('2026-05-20T23:59:00.000Z'),
        submissionMode: SubmissionMode.GROUP,
        isOpen: true,
        allowLateSubmission: true,
      },
    });
  }

  return { admin: admin.email, teacher: teacher.email, student: student.email };
}

async function main() {
  await seedReferenceData();

  if (!allowDemoSeed) {
    console.log('Reference seed complete. Demo users and sample academic data were skipped.');
    return;
  }

  const seeded = await seedDemoData();
  console.log('Reference and demo seed complete', seeded);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
