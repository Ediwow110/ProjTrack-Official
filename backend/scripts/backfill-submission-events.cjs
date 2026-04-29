const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function initialActionForStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'GRADED') return 'GRADED';
  if (normalized === 'NEEDS_REVISION') return 'RETURNED_FOR_REVISION';
  if (normalized === 'REVIEWED') return 'MARKED_REVIEWED';
  if (normalized === 'LATE') return 'SUBMITTED';
  if (normalized === 'SUBMITTED' || normalized === 'PENDING_REVIEW') return 'SUBMITTED';
  return 'SUBMISSION_HISTORY_IMPORTED';
}

async function main() {
  const submissions = await prisma.submission.findMany({
    where: { events: { none: {} } },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      submittedById: true,
      studentId: true,
    },
    take: Number(process.env.SUBMISSION_EVENT_BACKFILL_BATCH_SIZE || 5000),
  });

  if (!submissions.length) {
    console.log('No submissions need historical SubmissionEvent backfill.');
    return;
  }

  const result = await prisma.submissionEvent.createMany({
    data: submissions.map((submission) => ({
      submissionId: submission.id,
      actorUserId: submission.submittedById || submission.studentId || null,
      action: initialActionForStatus(submission.status),
      fromStatus: null,
      toStatus: submission.status || null,
      details: {
        backfilled: true,
        source: 'backend/scripts/backfill-submission-events.cjs',
      },
      createdAt: submission.submittedAt || submission.createdAt || new Date(),
    })),
  });

  console.log(`Backfilled ${result.count} SubmissionEvent row(s). Re-run until no rows remain if the batch limit was reached.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
