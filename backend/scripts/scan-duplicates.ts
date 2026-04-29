import { PrismaClient } from '@prisma/client';

type DuplicateScanRow = Record<string, unknown>;

const prisma = new PrismaClient();

async function queryRows(sql: string) {
  return prisma.$queryRawUnsafe<DuplicateScanRow[]>(sql);
}

async function printSection(title: string, sql: string) {
  const rows = await queryRows(sql);
  console.log(`\n=== ${title} ===`);

  if (!rows.length) {
    console.log('No duplicate rows found.');
    return;
  }

  console.table(rows);
}

async function main() {
  console.log('PROJTRACK duplicate scan');
  console.log('Scan only. Review findings before deleting or merging any records.');

  await printSection(
    'Duplicate users by email',
    'SELECT email, COUNT(*)::int AS count FROM "User" GROUP BY email HAVING COUNT(*) > 1 ORDER BY count DESC, email ASC;',
  );

  await printSection(
    'Duplicate student numbers',
    'SELECT "studentNumber", COUNT(*)::int AS count FROM "StudentProfile" GROUP BY "studentNumber" HAVING COUNT(*) > 1 ORDER BY count DESC, "studentNumber" ASC;',
  );

  await printSection(
    'Duplicate enrollments',
    'SELECT "studentId", "subjectId", COUNT(*)::int AS count FROM "Enrollment" GROUP BY "studentId", "subjectId" HAVING COUNT(*) > 1 ORDER BY count DESC, "studentId" ASC, "subjectId" ASC;',
  );

  await printSection(
    'Duplicate group members',
    'SELECT "groupId", "studentId", COUNT(*)::int AS count FROM "GroupMember" GROUP BY "groupId", "studentId" HAVING COUNT(*) > 1 ORDER BY count DESC, "groupId" ASC, "studentId" ASC;',
  );

  await printSection(
    'Students assigned to multiple groups in the same subject',
    'SELECT g."subjectId", gm."studentId", COUNT(*)::int AS count FROM "GroupMember" gm JOIN "Group" g ON g."id" = gm."groupId" GROUP BY g."subjectId", gm."studentId" HAVING COUNT(*) > 1 ORDER BY count DESC, g."subjectId" ASC, gm."studentId" ASC;',
  );

  await printSection(
    'Duplicate individual submissions',
    'SELECT "taskId", "studentId", COUNT(*)::int AS count FROM "Submission" WHERE "studentId" IS NOT NULL GROUP BY "taskId", "studentId" HAVING COUNT(*) > 1 ORDER BY count DESC, "taskId" ASC, "studentId" ASC;',
  );

  await printSection(
    'Duplicate group submissions',
    'SELECT "taskId", "groupId", COUNT(*)::int AS count FROM "Submission" WHERE "groupId" IS NOT NULL GROUP BY "taskId", "groupId" HAVING COUNT(*) > 1 ORDER BY count DESC, "taskId" ASC, "groupId" ASC;',
  );

  await printSection(
    'Duplicate activity titles within the same subject',
    'SELECT "subjectId", title, COUNT(*)::int AS count FROM "SubmissionTask" GROUP BY "subjectId", title HAVING COUNT(*) > 1 ORDER BY count DESC, "subjectId" ASC, title ASC;',
  );

  await printSection(
    'Potential duplicate notifications',
    'SELECT "userId", title, body, type, COUNT(*)::int AS count FROM "Notification" GROUP BY "userId", title, body, type HAVING COUNT(*) > 1 ORDER BY count DESC, "userId" ASC;',
  );
}

main()
  .catch((error) => {
    console.error('Duplicate scan failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
