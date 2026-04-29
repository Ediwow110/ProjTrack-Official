const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId: { not: null } },
    select: { subjectId: true, sectionId: true },
    distinct: ['subjectId', 'sectionId'],
  });

  const pairs = enrollments
    .map((enrollment) => ({
      subjectId: String(enrollment.subjectId || '').trim(),
      sectionId: String(enrollment.sectionId || '').trim(),
    }))
    .filter((pair) => pair.subjectId && pair.sectionId);

  if (!pairs.length) {
    console.log('No enrollment-backed subject sections found to backfill.');
    return;
  }

  const existing = await prisma.subjectSection.findMany({
    where: {
      OR: pairs.map((pair) => ({
        subjectId: pair.subjectId,
        sectionId: pair.sectionId,
      })),
    },
    select: { subjectId: true, sectionId: true },
  });
  const existingKeys = new Set(existing.map((item) => `${item.subjectId}:${item.sectionId}`));
  const missing = pairs.filter((pair) => !existingKeys.has(`${pair.subjectId}:${pair.sectionId}`));

  if (!missing.length) {
    console.log(`SubjectSection backfill already complete for ${pairs.length} enrollment pair(s).`);
    return;
  }

  const result = await prisma.subjectSection.createMany({
    data: missing,
    skipDuplicates: true,
  });

  console.log(`Backfilled ${result.count} SubjectSection row(s); ${pairs.length} enrollment pair(s) verified.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
