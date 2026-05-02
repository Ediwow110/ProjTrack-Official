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
  MAIL_TEMPLATE_KEYS,
} = require(path.join(root, 'src/common/constants/mail.constants.ts'));
const {
  renderMailTemplate,
  validateMailTemplatePayload,
} = require(path.join(root, 'src/mail/mail.templates.ts'));
const {
  evaluateSeedSectionCandidate,
} = require(path.join(root, 'src/admin/seed-cleanup.utils.ts'));
const {
  inspectRuntimeConfiguration,
} = require(path.join(root, 'src/config/runtime-safety.ts'));
require(path.join(root, 'scripts/branding-regression.ts'));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertThrows(fn, expected, message) {
  try {
    fn();
    failures.push(message);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    assert(detail.includes(expected), `${message} Expected error containing "${expected}", got "${detail}".`);
  }
}

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://projtrack:prod-password@db.prod.example.com:5432/projtrack',
    JWT_ACCESS_SECRET: 'prod-access-secret-for-tests-only-000000000000000000000000',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-for-tests-only-00000000000000000000000',
    JWT_ISSUER: 'projtrack-api',
    JWT_AUDIENCE: 'projtrack-web',
    JWT_KEY_ID: 'prod-test',
    ACCOUNT_ACTION_TOKEN_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    APP_URL: 'https://www.projtrack.codes',
    FRONTEND_URL: 'https://www.projtrack.codes',
    BACKEND_URL: 'https://api.projtrack.codes',
    CORS_ORIGINS: 'https://www.projtrack.codes',
    TRUST_PROXY: 'true',
    MAIL_PROVIDER: 'mailrelay',
    TESTMAIL_ENABLED: 'false',
    MAIL_FROM_NAME: 'ProjTrack',
    MAIL_FROM_ADMIN: 'admin@projtrack.codes',
    MAIL_FROM_NOREPLY: 'support@projtrack.codes',
    MAIL_FROM_INVITE: 'support@projtrack.codes',
    MAIL_FROM_NOTIFY: 'notification@projtrack.codes',
    MAIL_FROM_SUPPORT: 'support@projtrack.codes',
    MAILRELAY_API_KEY: 'mailrelay-live-test-key-not-real-000000000000',
    MAILRELAY_API_URL: 'https://projtrack.ipzmarketing.com/api/v1',
    MAIL_WORKER_ENABLED: 'false',
    MAIL_WORKER_POLL_MS: '60000',
    OBJECT_STORAGE_MODE: 's3',
    S3_BUCKET: 'projtrack-private-prod',
    S3_REGION: 'ap-southeast-1',
    S3_ENDPOINT: 'https://s3.ap-southeast-1.amazonaws.com',
    S3_ACCESS_KEY_ID: 'prod-storage-access-key-test',
    S3_SECRET_ACCESS_KEY: 'prod-storage-secret-key-test',
    S3_SIGNED_URL_TTL_SECONDS: '300',
    S3_BUCKET_PUBLIC: 'false',
    HTTP_RATE_LIMIT_STORE: 'database',
    FILE_MALWARE_SCAN_MODE: 'fail-closed',
    FILE_MALWARE_SCANNER: 'clamav',
    CLAMAV_HOST: 'clamav.prod.example.com',
    CLAMAV_PORT: '3310',
    BACKUP_WORKER_ENABLED: 'false',
    BACKUP_SCHEDULE_ENABLED: 'false',
    BACKUP_WORKER_POLL_MS: '60000',
    ALLOW_DEMO_SEED: 'false',
    ALLOW_SEED_DATA_CLEANUP: 'false',
    ALLOW_PRODUCTION_ADMIN_TOOL_RUNS: 'false',
    ...overrides,
  };
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

const validProductionConfig = inspectRuntimeConfiguration(productionEnv());
assert(validProductionConfig.ok, `Valid production config fixture should pass: ${validProductionConfig.errors.join('; ')}`);
for (const [label, overrides, expected] of [
  ['local database', { DATABASE_URL: 'postgresql://projtrack:projtrack@localhost:5432/projtrack' }, 'DATABASE_URL cannot point to localhost'],
  ['weak access secret', { JWT_ACCESS_SECRET: 'short' }, 'JWT_ACCESS_SECRET is using a default or weak value'],
  ['missing account action key', { ACCOUNT_ACTION_TOKEN_ENC_KEY: '' }, 'ACCOUNT_ACTION_TOKEN_ENC_KEY is required'],
  ['stub mail', { MAIL_PROVIDER: 'stub' }, 'Production requires MAIL_PROVIDER=mailrelay'],
  ['local storage', { OBJECT_STORAGE_MODE: 'local' }, 'Production requires OBJECT_STORAGE_MODE=s3'],
  ['missing cors', { CORS_ORIGINS: '' }, 'CORS_ORIGINS must be explicitly configured'],
  ['memory rate limit', { HTTP_RATE_LIMIT_STORE: 'memory' }, 'HTTP_RATE_LIMIT_STORE must be database'],
  ['scanner disabled', { FILE_MALWARE_SCAN_MODE: 'disabled' }, 'FILE_MALWARE_SCAN_MODE must be fail-closed'],
  ['ambiguous node env', { NODE_ENV: 'development' }, 'NODE_ENV and APP_ENV must both be production'],
]) {
  const result = inspectRuntimeConfiguration(productionEnv(overrides));
  assert(!result.ok, `Production config fixture must reject ${label}.`);
  assert(result.errors.some((error) => error.includes(expected)), `Production config ${label} rejection must mention ${expected}.`);
}

assertThrows(
  () => validateMailTemplatePayload('made-up-template', {}),
  'Unknown mail template key',
  'Unknown mail template keys must be rejected.',
);
assertThrows(
  () => validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
    firstName: 'Ada',
    resetLink: 'javascript:alert(1)',
    expiresAt: new Date().toISOString(),
  }),
  'resetLink must use http or https',
  'Unsafe mail action URLs must be rejected.',
);
assertThrows(
  () => validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
    firstName: 'Ada',
    resetLink: 'https://www.projtrack.codes/reset',
    expiresAt: 'not-a-date',
  }),
  'expiresAt must be a valid date',
  'Invalid mail template dates must be rejected.',
);
const maliciousBroadcast = renderMailTemplate(MAIL_TEMPLATE_KEYS.BROADCAST, {
  title: 'Hello\r\nBcc: attacker@example.com',
  body: '<script>alert(1)</script><img src=x onerror=alert(1)>',
});
assert(!/[\r\n]/.test(maliciousBroadcast.subject), 'Rendered mail subjects must remove CRLF injection.');
assert(!maliciousBroadcast.html.includes('<script>'), 'Rendered mail HTML must escape script tags.');
assert(maliciousBroadcast.html.includes('&lt;script&gt;'), 'Rendered mail HTML must preserve user text safely escaped.');

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
  'groupStatusForMemberCount',
  'pg_advisory_xact_lock',
  'subjectId_studentId',
  'currentMemberCount',
  'subjectId: lockedGroup.subjectId',
]);
assert(!/Math\.random/.test(subjectRepository), 'Subject invite codes must not use Math.random.');

includes('src/auth/auth-session.service.ts', [
  'this.prisma.$transaction',
  'authSession.updateMany',
  'replacedBySessionId: nextSessionId',
  'expiresAt: { gt: now }',
  'consumed.count !== 1',
]);

includes('src/auth/account-action-token.service.ts', [
  'accountActionToken.updateMany',
  'usedAt: null',
  'revokedAt: null',
  'expiresAt: { gt: now }',
  'consumed.count !== 1',
]);

includes('src/submissions/submissions.service.ts', [
  'validateStudentSubmission',
  'requireStudentEnrolledInSubject',
  'openAt',
  'closeAt',
  'allowLateSubmission',
  'acceptedFileTypes',
  'maxFileSizeMb',
  'externalLinksAllowed',
  'status: \'ACTIVE\'',
  'resolvePendingUploadsForSubmission',
  'uploadId',
  'recordSubmissionEvent',
]);

includes('src/files/files.service.ts', [
  'requireUserCanDownloadFile',
  'FILE_ACCESS_DENIED',
  'FILE_DELETED',
  'decodeBase64Strict',
  'assertContentMatchesExtension',
  'FILE_DELETE_STORAGE_FAILED',
  'submissionFile.update',
  'deletedAt',
]);

includes('src/auth/password.service.ts', [
  'try {',
  'timingSafeEqual',
  'catch {',
  'return false',
]);

includes('src/admin/admin.service.ts', [
  'revokedAt',
  'canExposeAccountActionLinks',
  'EXPOSE_ACCOUNT_ACTION_LINKS',
  'process.env.APP_ENV',
  'skippedInactive',
  'notification.updateMany',
  'actor?.actorUserId',
  'CLEAN SEED DATA',
  'admin@projtrack.codes',
  'ALLOW_SEED_DATA_CLEANUP',
  'ALLOW_PRODUCTION_ADMIN_TOOL_RUNS',
  'Remaining candidate demo records after cleanup',
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
  'Type DELETE BACKUP to confirm deleting this backup.',
  'Type UNPROTECT BACKUP to confirm unprotecting this backup.',
  'Type RESTORE BACKUP to confirm restore.',
  'artifactAvailable',
  'restoreUnsupportedReason',
]);

includes('src/backups/backups.controller.ts', [
  "@Post(':id/restore')",
  "@Get(':id')",
  "@Delete(':id')",
  "@Post(':id/unprotect')",
  'confirmation',
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

const mainTs = read('src/main.ts');
assert(mainTs.includes("exposedHeaders: ['Content-Disposition', 'X-Request-Id']"), 'Backend CORS must expose download and request-id headers.');

const submissionDto = read('src/submissions/dto/submission.dto.ts');
assert(submissionDto.includes('uploadId!'), 'Student submission file DTO must require uploadId.');
assert(!submissionDto.includes('relativePath?:'), 'Student submission DTO must reject raw relativePath payloads.');

const submissionsService = read('src/submissions/submissions.service.ts');
assert(submissionsService.includes('resolvePendingUploadsForSubmission'), 'Student submissions must resolve owned pending uploads before attaching files.');
assert(!submissionsService.includes('validateUploadedFileReferences(linkedPaths)'), 'Student submissions must not trust client-provided relativePath references.');

const submissionRepositorySource = read('src/repositories/submission.repository.ts');
assert(submissionRepositorySource.includes('consumePendingUploads'), 'Submission repository must consume pending uploads inside the submission transaction.');
assert(submissionRepositorySource.includes('pendingUpload.updateMany'), 'Pending upload consumption must be guarded by an atomic updateMany.');
assert(submissionRepositorySource.includes("status: 'CONSUMED'"), 'Consumed uploads must be marked consumed.');

const filesServiceSource = read('src/files/files.service.ts');
assert(filesServiceSource.includes('pendingUpload.create'), 'Upload endpoint must persist pending upload ownership metadata.');
assert(filesServiceSource.includes('cleanupExpiredPendingUploads'), 'Expired pending uploads must have a cleanup path.');

const frontendRuntime = readRepo('src/app/lib/api/runtime.ts');
assert(frontendRuntime.includes('VITE_API_BASE_URL is required for production builds.'), 'Production frontend must fail fast when VITE_API_BASE_URL is missing.');
assert(frontendRuntime.includes('VITE_API_BASE_URL cannot point to localhost in production builds.'), 'Production frontend must not fall back to localhost.');

const protectedPortal = readRepo('src/app/components/ProtectedPortal.tsx');
assert(protectedPortal.includes('apiRuntime.useBackend'), 'ProtectedPortal must distinguish real backend mode from mock mode.');
assert(protectedPortal.includes('Session verification is temporarily unavailable'), 'ProtectedPortal must not grant backend-mode access from localStorage when /auth/me fails.');

const frontendRoutes = readRepo('src/app/routes.tsx');
assert(frontendRoutes.includes('return <Navigate to="/student/login" replace />;'), 'Logged-out public entry must redirect to /student/login.');
assert(frontendRoutes.includes('{ path: "/portals", element: <Navigate to="/student/login" replace /> }'), '/portals must redirect to /student/login.');
assert(!frontendRoutes.includes('LoginSelector'), 'Public LoginSelector must not be routed.');
assert(!fs.existsSync(path.join(repoRoot, 'src/app/pages/auth/LoginSelector.tsx')), 'Public portal chooser component must not remain active.');

const roleLoginPage = readRepo('src/app/pages/auth/RoleLoginPage.tsx');
assert(!roleLoginPage.includes('Choose another portal'), 'Role login pages must not link to a portal chooser.');
assert(!roleLoginPage.includes('to="/portals"'), 'Role login pages must not link to /portals.');
assert(roleLoginPage.includes('Student Portal Login'), 'Student login page must keep the approved role-specific headline.');
assert(roleLoginPage.includes('Teacher Portal Login'), 'Teacher login page must keep the approved role-specific headline.');
assert(roleLoginPage.includes('Admin Portal Login'), 'Admin login page must keep the approved role-specific headline.');

const roleTheme = readRepo('src/app/lib/roleTheme.ts');
assert(roleTheme.includes('teacher') && roleTheme.includes('#8b5cf6'), 'Teacher role theme must be purple.');
assert(roleTheme.includes('admin') && roleTheme.includes('#ff7900'), 'Admin role theme must be orange.');
assert(roleTheme.includes('student') && roleTheme.includes('#1d4ed8'), 'Student role theme must be blue.');

const authLayout = readRepo('src/app/components/auth/AuthLayout.tsx');
assert(authLayout.includes('<ProjTrackLogo') && authLayout.includes('role={role}'), 'Role login pages must use the shared role-colored ProjTrack logo.');
assert(authLayout.includes('auth-starry-login'), 'Role login pages must keep the approved dark starry login shell.');
assert(!authLayout.includes('auth-role-tabs'), 'Separated role login pages must not render role tabs.');
assert(!authLayout.includes('NavLink'), 'Separated role login pages must not include a role switcher.');

const portalLayout = readRepo('src/app/layouts/PortalLayout.tsx');
assert(portalLayout.includes('<ProjTrackLogo') && portalLayout.includes('role={role}'), 'Authenticated portal layout must use the shared role-colored ProjTrack logo.');
assert(portalLayout.includes('showRoleDot={!isCollapsed}'), 'Authenticated portal brand must show one role-colored dot with the role label.');
assert(!portalLayout.includes('<GraduationCap size={23}'), 'Authenticated portal brand must not use the old hat-only logo.');

const brandingService = read('src/branding/branding.service.ts');
assert(brandingService.includes('BRANDING_UPLOAD_MAX_BYTES'), 'Branding uploads must enforce the 2MB size limit.');
assert(brandingService.includes('Unsafe SVG content was rejected.'), 'Branding uploads must reject unsafe SVG payloads.');

const brandingConstants = read('src/branding/branding.constants.ts');
assert(brandingConstants.includes("'/branding-assets'"), 'Branding asset URLs must be served from the safe public branding route.');

const brandingAdminController = read('src/branding/admin-branding.controller.ts');
assert(brandingAdminController.includes("@Roles('ADMIN')"), 'Branding mutations must remain admin-only.');
assert(brandingAdminController.includes("@UseGuards(JwtAuthGuard)"), 'Branding mutations must require JWT auth.');
assert(brandingAdminController.includes("@Post('logo')"), 'Admin branding controller must expose the logo upload route.');
assert(brandingAdminController.includes("@Post('icon')"), 'Admin branding controller must expose the icon upload route.');
assert(brandingAdminController.includes("@Post('favicon')"), 'Admin branding controller must expose the favicon upload route.');
assert(brandingAdminController.includes("@Delete('reset')"), 'Admin branding controller must expose the reset route.');

const brandingSettings = readRepo('src/app/components/settings/BrandingSettingsSection.tsx');
assert(brandingSettings.includes('Save Branding'), 'Admin settings branding section must expose a Save Branding action.');
assert(brandingSettings.includes('Reset to Default'), 'Admin settings branding section must expose a Reset to Default action.');
assert(brandingSettings.includes('JPG does not support transparent backgrounds'), 'Branding settings must warn admins about JPG transparency limits.');
assert(brandingSettings.includes('was not present in the saved branding response'), 'Branding settings must not show success when saved uploads are missing from the response.');

const apiServices = readRepo('src/app/lib/api/services.ts');
assert(apiServices.includes('buildBackendFileUrl(raw)'), 'Branding asset URLs must resolve against the backend API origin.');
assert(apiServices.includes('/branding-assets/'), 'Branding asset URL normalization must target uploaded branding assets.');

const pagination = readRepo('src/app/components/ui/pagination.tsx');
assert(pagination.includes('type="button"'), 'Pagination controls must render real buttons.');
assert(!pagination.includes('<a'), 'Pagination controls must not render placeholder anchors.');

const dataTableCard = readRepo('src/app/components/lists/shared/DataTableCard.tsx');
assert(!dataTableCard.includes('href="#"'), 'DataTableCard pagination must not use href="#".');

const appModal = readRepo('src/app/components/ui/app-modal.tsx');
assert(appModal.includes('max-h-[calc(100dvh-1rem)]'), 'AppModal must stay inside the dynamic viewport.');
assert(appModal.includes('overflow-y-auto'), 'AppModal body/footer must preserve reachable actions.');

const backupsPage = readRepo('src/app/pages/admin/Backups.tsx');
assert(backupsPage.includes('Run Backup Now'), 'Backups page must expose the live backup trigger.');
assert(backupsPage.includes('Download Backup'), 'Backups page details modal must expose real download action.');
assert(backupsPage.includes('actionConfirmationWord'), 'Backups page must derive typed confirmation phrases for destructive actions.');
assert(backupsPage.includes('Confirm Restore'), 'Backups page must expose an explicit restore confirmation path.');
assert(!backupsPage.includes('Backup action completed.'), 'Backups page must not use a generic fabricated success banner.');

const notificationsMenu = readRepo('src/app/components/portal/TopbarNotificationMenu.tsx');
assert(notificationsMenu.includes('w-[min(calc(100vw-2rem),23rem)]'), 'Notification popover must fit mobile viewports.');

const runtimeSafety = read('src/config/runtime-safety.ts');
assert(runtimeSafety.includes('Production requires MAIL_PROVIDER=mailrelay'), 'Production runtime safety must require Mailrelay.');
assert(runtimeSafety.includes('SMTP is deprecated for production'), 'SMTP must be blocked or deprecated for production.');
assert(runtimeSafety.includes('FRONTEND_URL is required in production.'), 'Production runtime safety must require FRONTEND_URL.');
assert(runtimeSafety.includes('FRONTEND_URL cannot point to localhost'), 'Production runtime safety must block localhost FRONTEND_URL.');

const envExample = read('.env.example');
assert(envExample.includes('MAIL_PROVIDER=mailrelay'), 'backend/.env.example must use MAIL_PROVIDER=mailrelay.');
assert(envExample.includes('FRONTEND_URL=https://www.projtrack.codes'), 'backend/.env.example must document FRONTEND_URL.');
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
assert(mailService.includes('validateMailTemplatePayload'), 'Mail service must validate template keys and payloads before queueing.');
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

const mailTemplates = read('src/mail/mail.templates.ts');
assert(mailTemplates.includes('validateMailTemplatePayload'), 'Mail templates must expose a reusable payload validator.');
assert(mailTemplates.includes('Unknown mail template key'), 'Unknown mail template keys must throw instead of falling back to broadcast.');
assert(!/case MAIL_TEMPLATE_KEYS\.BROADCAST:\s*default:/.test(mailTemplates), 'Mail renderer must not route unknown template keys to broadcast.');
for (const phrase of ['escapeHtml', 'assertSafeUrl', 'normalizeSubject', 'requiredDate']) {
  assert(mailTemplates.includes(phrase), `Mail renderer must include ${phrase}.`);
}

const adminMailFlows = read('src/admin/admin.service.ts');
assert(adminMailFlows.includes("body.audience === 'ADMINS'"), 'Admin-only broadcasts must use admin sender routing.');
assert(adminMailFlows.includes('MAIL_CATEGORY_KEYS.NOTIFICATION'), 'Student/teacher/all broadcasts must use notification sender routing.');

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
for (const required of [
  'MAIL_FROM_SUPPORT',
  'MAIL_FROM_INVITE',
  'MAIL_FROM_NOREPLY',
  'MAIL_FROM_NOTIFY',
  'MAIL_FROM_ADMIN',
  'support@projtrack.codes',
  'notification@projtrack.codes',
  'admin@projtrack.codes',
  'noreply@projtrack.codes',
]) {
  assert(mailSenderConfig.includes(required), `Mail sender config must enforce production sender mapping for ${required}.`);
}
assert(mailSenderConfig.includes('return config.support;'), 'Auth mail category must use support@projtrack.codes, not a noreply sender.');

const healthService = read('src/health/health.service.ts');
assert(healthService.includes('processing'), 'Mail health status must expose processing count.');
assert(healthService.includes('providerName'), 'Mail health status must expose the active provider name.');
assert(healthService.includes('providerConfigured'), 'Mail health status must expose provider configuration status.');
assert(healthService.includes('workerExpected'), 'Mail health status must expose whether a worker is expected.');
assert(healthService.includes('lastSuccessfulSendAt'), 'Mail health status must expose last successful send timestamp.');
assert(healthService.includes('lastWorkerHeartbeatAt'), 'Mail health status must expose last worker heartbeat timestamp.');
assert(healthService.includes('latestProcessedJob'), 'Mail health status must expose last processed job details.');
assert(healthService.includes('workerHeartbeatAgeSeconds'), 'Mail health status must expose worker heartbeat age.');
assert(healthService.includes('workerHealthy'), 'Mail health status must expose worker health.');
assert(healthService.includes('heartbeatProviderMatches'), 'Mail health status must reject worker heartbeats from a different provider.');
assert(healthService.includes('realDeliveryActive'), 'Mail health status must expose whether real provider delivery is active.');
assert(healthService.includes('apiProcessWorkerEnabled'), 'Mail health status must distinguish API process worker flag from dedicated worker heartbeat.');
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
assert(frontendContracts.includes('realDeliveryActive'), 'Frontend mail runtime contract must expose real delivery status.');
assert(frontendContracts.includes('apiProcessWorkerEnabled'), 'Frontend mail runtime contract must expose API worker flag.');

const frontendMailJobs = readRepo('src/app/pages/admin/MailJobs.tsx');
assert(frontendMailJobs.includes('Mailrelay Sender Checklist'), 'Admin Mail Jobs must show the Mailrelay sender checklist.');
assert(frontendMailJobs.includes('Local stub provider active; no real email delivery'), 'Admin Mail Jobs must explain local stub delivery limits.');
assert(frontendMailJobs.includes('API process worker flag'), 'Admin Mail Jobs must show the API worker flag separately.');
assert(frontendMailJobs.includes('Dedicated worker heartbeat'), 'Admin Mail Jobs must show dedicated worker heartbeat separately.');
assert(frontendMailJobs.includes('Student ID:'), 'Admin Mail Jobs must display student IDs.');
assert(frontendMailJobs.includes('Teacher ID:'), 'Admin Mail Jobs must display teacher IDs.');
assert(frontendMailJobs.includes('External recipient'), 'Admin Mail Jobs must label external recipients.');
assert(frontendMailJobs.includes('Retry selected'), 'Admin Mail Jobs must support batch retry actions.');
assert(frontendMailJobs.includes('Archive old'), 'Admin Mail Jobs must support archiving older jobs.');
assert(frontendMailJobs.includes('Show archived'), 'Admin Mail Jobs must support showing archived jobs.');
assert(frontendMailJobs.includes('Last updated'), 'Admin Mail Jobs must show live refresh status.');
assert(frontendMailJobs.includes('Details'), 'Admin Mail Jobs must expose safe row details.');

const frontendApiServices = readRepo('src/app/lib/api/services.ts');
assert(frontendApiServices.includes('status?.providerName'), 'Frontend mail runtime mapping must read the backend providerName field.');
assert(!frontendApiServices.includes('mail_job_1'), 'Frontend mail jobs must not fabricate static local queue rows.');

const mailrelayRunbook = readRepo('MAILRELAY_RUNBOOK.md');
for (const key of ['MAIL_FROM_NAME', 'MAIL_FROM_ADMIN', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_INVITE', 'MAIL_FROM_NOTIFY', 'MAIL_FROM_SUPPORT']) {
  assert(mailrelayRunbook.includes(key), `MAILRELAY_RUNBOOK.md must document ${key}.`);
}
assert(!mailrelayRunbook.includes('MAIL_FROM_NOREPLY=admin@projtrack.codes'), 'MAILRELAY_RUNBOOK.md must not recommend remapping account mail to admin@projtrack.codes.');
assert(mailrelayRunbook.includes('From: support@projtrack.codes'), 'MAILRELAY_RUNBOOK.md must document account setup mail from support@projtrack.codes.');
for (const phrase of ['QUEUED -> PROCESSING -> SENT', 'Old dead jobs should be archived', 'Production needs one worker only', 'FRONTEND_URL', 'DATABASE_URL', 'GET /health/mail']) {
  assert(mailrelayRunbook.includes(phrase), `MAILRELAY_RUNBOOK.md must document ${phrase}.`);
}
for (const phrase of ['npm run dev:raw', 'npm run dev:worker', 'MAIL_PROVIDER="stub"', 'MAIL_WORKER_ENABLED=true']) {
  assert(mailrelayRunbook.includes(phrase), `MAILRELAY_RUNBOOK.md must document local worker command detail: ${phrase}.`);
}

const productionEnvTemplate = readRepo('docs/PRODUCTION_ENV_TEMPLATE.md');
for (const phrase of ['FRONTEND_URL=https://projtrack.codes', 'MAIL_FROM_NAME=ProjTrack', 'MAIL_FROM_SUPPORT=support@projtrack.codes', 'MAIL_FROM_NOTIFY=notification@projtrack.codes', 'MAIL_FROM_ADMIN=admin@projtrack.codes', 'MAIL_WORKER_ENABLED=false', 'MAIL_WORKER_ENABLED=true', 'npm run prisma:migrate:deploy']) {
  assert(productionEnvTemplate.includes(phrase), `docs/PRODUCTION_ENV_TEMPLATE.md must document ${phrase}.`);
}
assert(productionEnvTemplate.includes('MAILRELAY_API_URL=https://projtrack.ipzmarketing.com/api/v1'), 'docs/PRODUCTION_ENV_TEMPLATE.md must document the active Mailrelay API URL.');

const duplicateGuardMigration = read('prisma/migrations/20260427120000_production_duplicate_guards/migration.sql');
assert(duplicateGuardMigration.includes('"Submission_task_student_unique_idx"'), 'Submission individual uniqueness partial index migration is required.');
assert(duplicateGuardMigration.includes('WHERE "studentId" IS NOT NULL'), 'Submission individual uniqueness index must be partial.');
assert(duplicateGuardMigration.includes('"Submission_task_group_unique_idx"'), 'Submission group uniqueness partial index migration is required.');
assert(duplicateGuardMigration.includes('WHERE "groupId" IS NOT NULL'), 'Submission group uniqueness index must be partial.');

const groupMemberSubjectMigration = read('prisma/migrations/20260429103000_group_member_subject_invariant/migration.sql');
assert(groupMemberSubjectMigration.includes('ADD COLUMN IF NOT EXISTS "subjectId"'), 'GroupMember subjectId migration must add subjectId.');
assert(groupMemberSubjectMigration.includes('SET "subjectId" = g."subjectId"'), 'GroupMember subjectId migration must backfill from Group.subjectId.');
assert(groupMemberSubjectMigration.includes('"GroupMember_subjectId_studentId_key"'), 'GroupMember migration must enforce one group per subject per student.');

const backendPackage = JSON.parse(read('package.json'));
assert(backendPackage.scripts.worker === 'node -r ts-node/register src/worker.ts', 'Backend package must expose a local worker command.');
assert(backendPackage.scripts['dev:worker'] === 'node -r ts-node/register src/worker.ts', 'Backend package must expose a clear local dev worker command.');
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

// SENDER_NOT_CONFIRMED is intentionally retryable (30m/1h/2h/4h delays) so jobs
// auto-recover once the sender is confirmed in Mailrelay — no manual force-retry needed.
assertProviderClassification(
  'Sender-not-confirmed errors',
  providerError(422, "Sender email isn't confirmed in your account."),
  { failureReason: MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED, retryable: true },
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

const demoOnlySection = evaluateSeedSectionCandidate({
  explicitSeed: false,
  studentIds: ['seed-student'],
  enrollmentStudentIds: ['seed-student'],
  enrollmentSubjectIds: ['seed-subject'],
  groupIds: ['seed-group'],
  subjectSectionSubjectIds: ['seed-subject'],
  seedStudentProfileIds: new Set(['seed-student']),
  seedSubjectIds: new Set(['seed-subject']),
  seedGroupIds: new Set(['seed-group']),
});
assert(demoOnlySection.qualifiesAsSeed, 'Demo-only section links must be classified as seed cleanup candidates.');
assert(demoOnlySection.relationKind === 'demo-only', 'Demo-only section links must report a demo-only relation kind.');

const realLinkedSection = evaluateSeedSectionCandidate({
  explicitSeed: false,
  studentIds: ['seed-student', 'real-student'],
  enrollmentStudentIds: ['seed-student'],
  enrollmentSubjectIds: ['seed-subject'],
  groupIds: ['seed-group'],
  subjectSectionSubjectIds: ['seed-subject'],
  seedStudentProfileIds: new Set(['seed-student']),
  seedSubjectIds: new Set(['seed-subject']),
  seedGroupIds: new Set(['seed-group']),
});
assert(!realLinkedSection.qualifiesAsSeed, 'Sections linked to real academic records must stay blocked from seed cleanup.');
assert(realLinkedSection.relationKind === 'mixed', 'Mixed section links must report a mixed demo+real relation kind.');

if (failures.length) {
  console.error('Production hardening checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Production hardening checks passed.');
