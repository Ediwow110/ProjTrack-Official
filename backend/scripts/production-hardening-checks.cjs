const fs = require('node:fs');
const path = require('node:path');
require('ts-node/register/transpile-only');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const failures = [];
const {
  classifyProviderError,
} = require(path.join(root, 'src/mail/providers/provider-error-classification.ts'));
const {
  MAIL_FAILURE_REASONS,
} = require(path.join(root, 'src/common/constants/mail.constants.ts'));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function includes(relativePath, patterns) {
  const source = read(relativePath);
  for (const pattern of patterns) {
    assert(
      typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source),
      `${relativePath} is missing expected guard: ${pattern}`,
    );
  }
  return source;
}

const accessService = includes('src/access/access.service.ts', [
  'requireActiveUser',
  'requireStudentEnrolledInSubject',
  'requireTeacherOwnsActivity',
  'requireTeacherCanReviewSubmission',
  'requireStudentCanAccessSubmission',
  'requireUserCanDownloadFile',
  'requireStudentCanCreateGroup',
  'requireStudentCanJoinGroup',
]);

assert(!/passwordHash:\s*true/.test(accessService), 'Access service must never select passwordHash.');

const backendSourceFiles = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    if (entry.isFile() && entry.name.endsWith('.ts')) backendSourceFiles.push(fullPath);
  }
}
collect(path.join(root, 'src'));

for (const file of backendSourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  assert(!/passwordHash\s*:\s*true/.test(source), `${relative} selects passwordHash.`);
  assert(!/\buser\s*:\s*true\b/.test(source), `${relative} returns raw user include.`);
  assert(!/\bstudent\s*:\s*true\b/.test(source), `${relative} returns raw student include.`);
  assert(!/\breviewer\s*:\s*true\b/.test(source), `${relative} returns raw reviewer include.`);
  assert(!/\bactor\s*:\s*true\b/.test(source), `${relative} returns raw actor include.`);
}

const subjectsService = includes('src/subjects/subjects.service.ts', [
  'requireTeacherOwnsActivity',
  'if (!byStudent.size)',
  'requireStudentCanCreateGroup',
  'requireStudentCanJoinGroup',
  'ensureStudentEnrolledInSubject',
]);
assert(!/return\s+\{\s*\.\.\.subject/.test(subjectsService), 'Subject service must not return raw subject spreads.');

const subjectRepository = includes('src/repositories/subject.repository.ts', [
  'randomBytes',
  'PRJ-',
  'subjectId: body.subjectId',
  'SAFE_USER_SELECT',
]);
assert(!/Math\.random/.test(subjectRepository), 'Subject invite codes must not use Math.random.');

includes('src/submissions/submissions.service.ts', [
  'validateStudentSubmission',
  'requireStudentEnrolledInSubject',
  'openAt',
  'closeAt',
  'allowLateSubmission',
  'acceptedFileTypes',
  'maxFileSizeMb',
  'externalLinksAllowed',
  'recordSubmissionEvent',
]);

includes('src/files/files.service.ts', [
  'requireUserCanDownloadFile',
  'FILE_ACCESS_DENIED',
  'FILE_DELETED',
  'deletedAt',
]);

includes('src/admin/admin.service.ts', [
  'revokedAt',
  'canExposeAccountActionLinks',
  'EXPOSE_ACCOUNT_ACTION_LINKS',
  'process.env.APP_ENV',
  'skippedInactive',
  'notification.updateMany',
  'actor?.actorUserId',
]);

includes('src/auth/auth.service.ts', [
  'consumePasswordResetTx',
  'consumeActivationTx',
  'authSession.updateMany',
  'assertNotBlocked',
  'recordFailure(\'forgot-password\'',
  'requestedRole',
  'role_mismatch',
  'pending_setup_requires_admin_invite',
  'mailJobCreated',
  'PASSWORD_RESET_REQUESTED',
]);

includes('src/auth/guards/jwt-auth.guard.ts', [
  'status !== \'ACTIVE\'',
  'User role changed. Sign in again.',
]);

includes('src/backups/backups.service.ts', [
  'The latest successful backup cannot be deleted.',
  'Protected backups cannot be deleted.',
  'Running backups cannot be deleted.',
  'async validate',
  'sha256',
]);

includes('src/mail/mail.controller.ts', [
  "@Post('test')",
  "@Roles('ADMIN')",
]);

includes('src/mail/mail.worker.ts', [
  'MAIL_WORKER_ENABLED',
  'status()',
]);

includes('src/students/import-file.service.ts', [
  'parseDelimited',
  'maxRows',
  'maxColumns',
  'maxSheets',
  'maxFileBytes',
]);
assert(!/\.split\(['"]\,['"]\)/.test(read('src/students/import-file.service.ts')), 'Student import must not use naive comma splitting.');

includes('scripts/backfill-subject-sections.cjs', [
  'prisma.enrollment.findMany',
  'prisma.subjectSection.createMany',
  'skipDuplicates: true',
]);

includes('scripts/backfill-submission-events.cjs', [
  'events: { none: {} }',
  'prisma.submissionEvent.createMany',
]);

const frontendHttp = readRepo('src/app/lib/api/http.ts');
assert(frontendHttp.includes('refreshPromise'), 'Frontend API client must keep refresh single-flight logic.');
assert(frontendHttp.includes("executeFetch('POST', '/auth/logout'"), 'Frontend logout must call backend logout.');
assert(frontendHttp.includes('import.meta.env.DEV'), 'Frontend backend-unavailable details must be dev-only.');
assert(!/Start the backend/.test(frontendHttp.replace(/if \(import\.meta\.env\.DEV\)[\s\S]*?return new Error\([^;]+;/, '')), 'Production frontend errors must not tell users to start the backend.');

const frontendRoutes = readRepo('src/app/routes.tsx');
assert(frontendRoutes.includes('return <Navigate to="/student/login" replace />;'), 'Logged-out public entry must redirect to /student/login.');
assert(frontendRoutes.includes('{ path: "/portals", element: <Navigate to="/student/login" replace /> }'), '/portals must redirect to /student/login.');
assert(!frontendRoutes.includes('LoginSelector'), 'Public LoginSelector must not be routed.');
assert(!fs.existsSync(path.join(repoRoot, 'src/app/pages/auth/LoginSelector.tsx')), 'Public portal chooser component must not remain active.');

const roleLoginPage = readRepo('src/app/pages/auth/RoleLoginPage.tsx');
assert(!roleLoginPage.includes('Choose another portal'), 'Role login pages must not link to a portal chooser.');
assert(!roleLoginPage.includes('to="/portals"'), 'Role login pages must not link to /portals.');
assert(!roleLoginPage.includes('Student Portal'), 'Student login copy must not expose portal-selector wording.');
assert(!roleLoginPage.includes('Teacher Portal'), 'Teacher login copy must not expose portal-selector wording.');
assert(!roleLoginPage.includes('Admin Portal'), 'Admin login copy must not expose portal-selector wording.');

const runtimeSafety = read('src/config/runtime-safety.ts');
assert(runtimeSafety.includes('Production requires MAIL_PROVIDER=mailrelay'), 'Production runtime safety must require Mailrelay.');
assert(runtimeSafety.includes('SMTP is deprecated for production'), 'SMTP must be blocked or deprecated for production.');

const envExample = read('.env.example');
assert(envExample.includes('MAIL_PROVIDER=mailrelay'), 'backend/.env.example must use MAIL_PROVIDER=mailrelay.');
assert(!/^MAIL_PROVIDER=smtp/im.test(envExample), 'backend/.env.example must not activate SMTP.');

const mailWorker = read('src/mail/mail.worker.ts');
assert(mailWorker.includes('buildDueEmailJobWhere'), 'Mail worker must use a deterministic due-job eligibility helper.');
assert(mailWorker.includes('archivedAt: null'), 'Mail worker must ignore archived jobs.');
assert(mailWorker.includes('{ scheduledAt: null }'), 'Mail worker must pick queued jobs whose nextTryAt is null.');
assert(mailWorker.includes('{ scheduledAt: { lte: input.now } }'), 'Mail worker must pick queued jobs whose nextTryAt is due.');
assert(mailWorker.includes('job.attempts < job.maxAttempts'), 'Mail worker must exclude jobs that exhausted maxAttempts.');
assert(mailWorker.includes('provider: activeProvider'), 'Mail worker must process jobs for the active provider only.');
assert(mailWorker.includes('lastHeartbeatAt'), 'Mail worker status must expose a heartbeat field.');
assert(mailWorker.includes('workerHeartbeat.upsert'), 'Mail worker must persist a shared heartbeat record.');
assert(mailWorker.includes('status: EmailJobStatus.QUEUED'), 'Stale processing recovery must be able to requeue recoverable jobs.');
assert(mailWorker.includes('WORKER_STALE_PROCESSING'), 'Stale processing recovery must classify stale worker locks safely.');
assert(mailWorker.includes('const delivery = await this.transport.sendRenderedMessage'), 'Mail worker must call the provider before marking a job sent.');
assert(mailWorker.includes('status: EmailJobStatus.SENT'), 'Mail worker must only mark sent after provider acceptance.');
assert(mailWorker.includes('classification.failureReason'), 'Mail worker must preserve provider-specific failure reasons.');

const mailService = read('src/mail/mail.service.ts');
assert(mailService.includes('scheduledAt: null'), 'Fresh and retried mail jobs must be immediately eligible with null nextTryAt.');
assert(mailService.includes('previousLastError'), 'Mail retry must preserve previous failure context before clearing current error fields.');
assert(mailService.includes('previousAttempts'), 'Mail retry must preserve previous attempt count context before clearing current error fields.');
assert(mailService.includes('provider: this.transport.getProviderName()'), 'Mail retry/resume must move jobs onto the active provider.');
assert(mailService.includes('Queued. Waiting for mail worker.'), 'Mailrelay test response must tell admins the job is waiting for the worker.');
assert(mailService.includes('idempotencyKey: _idempotencyKey'), 'Mail job API serialization must strip idempotency keys and token-like references.');
assert(mailService.includes('payload: rawPayload'), 'Mail job API serialization must not expose raw template payloads or reset links.');
assert(mailService.includes('recipientIdentitiesForJobs'), 'Mail job API must enrich recipients with safe identity data.');
assert(mailService.includes('studentNumber'), 'Known student mail recipients must expose student number when available.');
assert(mailService.includes('employeeId'), 'Known teacher mail recipients must expose employee ID when available.');
assert(mailService.includes('isExternal: true'), 'Unknown mail recipients must be marked as external.');
assert(mailService.includes('includeArchived'), 'Mail job listing must support an archived toggle.');
assert(mailService.includes('cancelJob'), 'Mail job service must support canceling queued jobs.');
assert(mailService.includes('archiveOldJobs'), 'Mail job service must support archiving old terminal jobs.');
assert(mailService.includes('retryJobs'), 'Mail job service must support batch retries.');
assert(mailService.includes('queueStudentSetupInvitation'), 'Student setup invite must enqueue a dedicated setup invitation mail job.');
assert(mailService.includes('mail:student-setup-invite:'), 'Student setup invite must have idempotency protection.');
assert(mailService.includes('MAIL_CATEGORY_KEYS.INVITE'), 'Student setup invite must use the centralized invite sender category.');
assert(!mailService.includes('passwordHash'), 'Mail job API must not expose passwordHash.');

const adminStudentsController = read('src/students/admin-students.controller.ts');
assert(adminStudentsController.includes("@Roles('ADMIN')"), 'Admin student setup invite endpoint must require ADMIN.');
assert(adminStudentsController.includes("@Post(':id/send-setup-invite')"), 'Admin students API must expose a setup invite endpoint.');

const adminStudentsService = read('src/students/admin-students.service.ts');
assert(adminStudentsService.includes('queueStudentSetupInvite'), 'Pending setup student action must use the setup invite path.');
assert(adminStudentsService.includes('issueActivation'), 'Pending setup student invite must issue or reuse an activation token.');
assert(adminStudentsService.includes('queueStudentSetupInvitation'), 'Pending setup student invite must create an EmailJob.');
assert(adminStudentsService.includes('mailJobId'), 'Pending setup student invite response must include a safe mail job id.');
assert(adminStudentsService.includes('missing_email'), 'Pending setup student invite must handle missing email safely.');
assert(adminStudentsService.includes('not_pending_setup'), 'Pending setup student invite must reject non-pending setup users.');
assert(!/return\s+\{[\s\S]{0,500}(activationLink|resetLink)/.test(adminStudentsService), 'Admin student invite/reset responses must not expose setup/reset links.');
assert(!/return\s+\{[\s\S]{0,500}\btoken\b/.test(adminStudentsService), 'Admin student invite/reset responses must not expose tokens.');

const providerErrorClassification = read('src/mail/providers/provider-error-classification.ts');
assert(providerErrorClassification.includes('redactProviderReason'), 'Provider errors must be redacted, not hidden.');
for (const key of ['AUTH_FAILED', 'RATE_LIMITED', 'PROVIDER_TEMPORARY', 'PROVIDER_REJECTED', 'INVALID_RECIPIENT', 'ACCOUNT_RESTRICTED', 'NETWORK_ERROR', 'UNKNOWN_PROVIDER_ERROR']) {
  assert(providerErrorClassification.includes(key), `Provider errors must classify ${key}.`);
}
assert(providerErrorClassification.includes('SENDER_NOT_CONFIRMED'), 'Sender-confirmation provider errors must map to SENDER_NOT_CONFIRMED.');
assert(providerErrorClassification.includes("sender email isn't confirmed"), 'Sender-confirmation classifier must recognize Mailrelay wording.');
assert(providerErrorClassification.includes('unauthorized sender'), 'Sender-confirmation classifier must recognize unauthorized sender wording.');
assert(providerErrorClassification.includes('truncate('), 'Provider error body must stay truncated for admin diagnostics.');

const mailSenderConfig = read('src/mail/mail-sender-config.ts');
for (const key of ['MAIL_FROM_NAME', 'MAIL_FROM_ADMIN', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_INVITE', 'MAIL_FROM_NOTIFY', 'MAIL_FROM_SUPPORT']) {
  assert(mailSenderConfig.includes(key), `Mail sender config must support ${key}.`);
}
assert(mailSenderConfig.includes('isValidSenderEmail'), 'Mail sender config must validate sender email shape.');
assert(mailSenderConfig.includes('publicMailSenderConfig'), 'Mail health must expose only non-secret sender config.');

const healthService = read('src/health/health.service.ts');
assert(healthService.includes('processing'), 'Mail health status must expose processing count.');
assert(healthService.includes('latestProcessedJob'), 'Mail health status must expose last processed job details.');
assert(healthService.includes('workerHeartbeatAgeSeconds'), 'Mail health status must expose worker heartbeat age.');
assert(healthService.includes('workerHealthy'), 'Mail health status must expose worker health.');
assert(healthService.includes('queuedTooLongCount'), 'Mail health status must expose queued-too-long diagnostics.');
assert(healthService.includes('processingTooLongCount'), 'Mail health status must expose processing-too-long diagnostics.');
assert(healthService.includes('alerts'), 'Mail health status must expose admin-facing alerts.');
assert(healthService.includes('senderConfig'), 'Mail health status must expose non-secret sender config.');
assert(healthService.includes('recentFailureReason'), 'Mail health status must expose safe recent failure reason.');

const frontendContracts = readRepo('src/app/lib/api/contracts.ts');
assert(frontendContracts.includes('interface MailJobRecipient'), 'Frontend mail job contract must include recipient identity.');
assert(frontendContracts.includes('studentId?: string'), 'Frontend mail recipient contract must include student ID.');
assert(frontendContracts.includes('isExternal: boolean'), 'Frontend mail recipient contract must identify external recipients.');
assert(frontendContracts.includes('queuedTooLongCount'), 'Frontend mail runtime contract must expose queue warning metrics.');
assert(frontendContracts.includes('alerts?: Array'), 'Frontend mail runtime contract must expose alert payloads.');

const frontendMailJobs = readRepo('src/app/pages/admin/MailJobs.tsx');
assert(frontendMailJobs.includes('Mailrelay Sender Checklist'), 'Admin Mail Jobs must show the Mailrelay sender checklist.');
assert(frontendMailJobs.includes('Student ID:'), 'Admin Mail Jobs must display student IDs.');
assert(frontendMailJobs.includes('Teacher ID:'), 'Admin Mail Jobs must display teacher IDs.');
assert(frontendMailJobs.includes('External recipient'), 'Admin Mail Jobs must label external recipients.');
assert(frontendMailJobs.includes('Retry selected'), 'Admin Mail Jobs must support batch retry actions.');
assert(frontendMailJobs.includes('Archive old'), 'Admin Mail Jobs must support archiving older jobs.');
assert(frontendMailJobs.includes('Show archived'), 'Admin Mail Jobs must support showing archived jobs.');
assert(frontendMailJobs.includes('Last updated'), 'Admin Mail Jobs must show live refresh status.');
assert(frontendMailJobs.includes('Details'), 'Admin Mail Jobs must expose safe row details.');

const mailrelayRunbook = readRepo('MAILRELAY_RUNBOOK.md');
for (const key of ['MAIL_FROM_NAME', 'MAIL_FROM_ADMIN', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_INVITE', 'MAIL_FROM_NOTIFY', 'MAIL_FROM_SUPPORT']) {
  assert(mailrelayRunbook.includes(key), `MAILRELAY_RUNBOOK.md must document ${key}.`);
}
for (const phrase of ['QUEUED -> PROCESSING -> SENT', 'Old dead jobs should be archived', 'Production needs one worker only']) {
  assert(mailrelayRunbook.includes(phrase), `MAILRELAY_RUNBOOK.md must document ${phrase}.`);
}

const backendPackage = JSON.parse(read('package.json'));
assert(backendPackage.scripts.worker === 'node -r ts-node/register src/worker.ts', 'Backend package must expose a local worker command.');
assert(backendPackage.scripts['start:worker'] === 'node dist/worker.js', 'Backend package must expose a production worker command.');
const rootPackage = JSON.parse(readRepo('package.json'));
assert(rootPackage.scripts['start:worker'] && rootPackage.scripts['start:worker'].includes('start-worker-local.ps1'), 'Root package must expose npm run start:worker.');
assert(fs.existsSync(path.join(repoRoot, 'scripts/start-worker-local.ps1')), 'Local worker PowerShell helper is required.');
const workerEntrypoint = read('src/worker.ts');
assert(workerEntrypoint.includes('createApplicationContext'), 'Dedicated worker entrypoint must not open an HTTP listener.');
assert(workerEntrypoint.includes('validateProductionEmailConfig'), 'Dedicated worker must validate production mail configuration.');
assert(workerEntrypoint.includes('logSafeMailRuntimeState'), 'Dedicated worker must log safe mail runtime diagnostics.');

function providerError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertProviderClassification(label, error, expected) {
  const result = classifyProviderError(error);
  assert(result.failureReason === expected.failureReason, `${label} must map to ${expected.failureReason}.`);
  assert(result.retryable === expected.retryable, `${label} retryable must be ${expected.retryable}.`);
}

assertProviderClassification(
  'Sender-not-confirmed errors',
  providerError(422, "Sender email isn't confirmed in your account."),
  { failureReason: MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED, retryable: false },
);
assertProviderClassification(
  'Rate-limited errors',
  providerError(429, 'Too many requests. Rate limit exceeded.'),
  { failureReason: MAIL_FAILURE_REASONS.RATE_LIMITED, retryable: true },
);
assertProviderClassification(
  'Invalid-recipient errors',
  providerError(422, 'Mailrelay API failed with status 422: {"errors":{"to":["is invalid"]}}'),
  { failureReason: MAIL_FAILURE_REASONS.INVALID_RECIPIENT, retryable: false },
);
assertProviderClassification(
  'Temporary provider errors',
  providerError(503, 'Service unavailable. Try again later.'),
  { failureReason: MAIL_FAILURE_REASONS.PROVIDER_TEMPORARY, retryable: true },
);
assertProviderClassification(
  'Network errors',
  providerError(undefined, 'fetch failed: ECONNRESET'),
  { failureReason: MAIL_FAILURE_REASONS.NETWORK_ERROR, retryable: true },
);
assertProviderClassification(
  'Account restriction errors',
  providerError(422, 'Your account is currently under review. Please, try again later.'),
  { failureReason: MAIL_FAILURE_REASONS.ACCOUNT_RESTRICTED, retryable: false },
);
const redactedProviderError = classifyProviderError(
  providerError(401, 'Invalid api key secret-token-12345'),
);
assert(
  !redactedProviderError.reason.includes('secret-token-12345'),
  'Provider error messages must redact token-like values.',
);

if (failures.length) {
  console.error('Production hardening checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Production hardening checks passed.');
