const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function assertSafeEnvironment() {
  const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  const allow = process.env.ALLOW_QUERY_PLAN_CHECK === 'true';
  if (appEnv === 'production' && !allow) {
    throw new Error('Refusing to run school-scale query-plan checks in production without ALLOW_QUERY_PLAN_CHECK=true.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
}

function summarizePlanNode(node, depth = 0, rows = []) {
  if (!node || typeof node !== 'object') return rows;
  rows.push({
    depth,
    nodeType: node['Node Type'],
    relation: node['Relation Name'] || null,
    index: node['Index Name'] || null,
    planRows: node['Plan Rows'],
    planWidth: node['Plan Width'],
    startupCost: node['Startup Cost'],
    totalCost: node['Total Cost'],
  });
  for (const child of node.Plans || []) {
    summarizePlanNode(child, depth + 1, rows);
  }
  return rows;
}

function hasScanWarning(rows) {
  return rows.some((row) =>
    ['Seq Scan', 'Parallel Seq Scan'].includes(row.nodeType) &&
    ['Submission', 'Notification', 'Enrollment', 'GroupMember', 'SubmissionTask'].includes(row.relation)
  );
}

async function explain(label, sql, params = []) {
  const result = await prisma.$queryRawUnsafe(`EXPLAIN (FORMAT JSON) ${sql}`, ...params);
  const root = result?.[0]?.['QUERY PLAN']?.[0]?.Plan;
  const rows = summarizePlanNode(root);
  const warning = hasScanWarning(rows);
  console.log(`\n${label}`);
  console.log(`warning_seq_scan_on_hot_table: ${warning ? 'yes' : 'no'}`);
  for (const row of rows) {
    const indent = '  '.repeat(row.depth);
    console.log(`${indent}- ${row.nodeType}${row.relation ? ` on ${row.relation}` : ''}${row.index ? ` using ${row.index}` : ''} rows=${row.planRows} cost=${row.startupCost}..${row.totalCost}`);
  }
  return warning;
}

async function sampleValue(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows?.[0]?.value || null;
}

async function main() {
  assertSafeEnvironment();

  const studentId = await sampleValue('SELECT "studentId" AS value FROM "Submission" WHERE "studentId" IS NOT NULL LIMIT 1');
  const teacherId = await sampleValue('SELECT "teacherId" AS value FROM "Subject" WHERE "teacherId" IS NOT NULL LIMIT 1');
  const subjectId = await sampleValue('SELECT "subjectId" AS value FROM "Submission" LIMIT 1');
  const notificationUserId = await sampleValue('SELECT "userId" AS value FROM "Notification" LIMIT 1');

  let warnings = 0;

  if (studentId) {
    warnings += Number(await explain(
      'student submission list by owner',
      'SELECT "id", "createdAt" FROM "Submission" WHERE "studentId" = $1 ORDER BY "createdAt" DESC LIMIT 100',
      [studentId],
    ));
  } else {
    console.log('\nstudent submission list by owner');
    console.log('skipped: no submission studentId sample found');
  }

  if (teacherId) {
    warnings += Number(await explain(
      'teacher submission list by teacher-owned subject',
      'SELECT s."id", s."createdAt" FROM "Submission" s JOIN "SubmissionTask" t ON t."id" = s."taskId" JOIN "Subject" sub ON sub."id" = t."subjectId" WHERE sub."teacherId" = $1 ORDER BY s."createdAt" DESC LIMIT 100',
      [teacherId],
    ));
  } else {
    console.log('\nteacher submission list by teacher-owned subject');
    console.log('skipped: no teacherId sample found');
  }

  if (subjectId) {
    warnings += Number(await explain(
      'subject submissions by status and time',
      'SELECT "id", "createdAt" FROM "Submission" WHERE "subjectId" = $1 AND "status" = $2 ORDER BY "createdAt" DESC LIMIT 100',
      [subjectId, 'SUBMITTED'],
    ));
  } else {
    console.log('\nsubject submissions by status and time');
    console.log('skipped: no subjectId sample found');
  }

  if (notificationUserId) {
    warnings += Number(await explain(
      'notification list by user read state',
      'SELECT "id", "createdAt" FROM "Notification" WHERE "userId" = $1 AND "isRead" = false ORDER BY "createdAt" DESC LIMIT 100',
      [notificationUserId],
    ));
  } else {
    console.log('\nnotification list by user read state');
    console.log('skipped: no notification user sample found');
  }

  console.log('\nSchool-scale query-plan check complete');
  console.log(`hot_table_seq_scan_warnings: ${warnings}`);
  if (warnings > 0 && process.env.FAIL_ON_QUERY_PLAN_WARNING === 'true') {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
