# ProjTrack Production Readiness

Date: 2026-04-28

## Completed Hardening

- Added a central backend access layer under `backend/src/access` and routed subject, submission, file, group, teacher, student, and admin permission checks through reusable guards.
- Hardened JWT auth so every protected request loads the current database user and rejects missing, inactive, or role-changed accounts.
- Revoked refresh sessions on admin deactivation/status changes and transactional activation/reset password flows.
- Removed raw user include patterns from backend responses and replaced them with safe user selections.
- Stopped activation/reset/setup links and token values from being returned by admin student email APIs.
- Enforced backend submission windows, late rules, file type/size limits, external link rules, group rules, and enrollment requirements.
- Added `SubmissionEvent` history for submission lifecycle and file events.
- Fixed teacher student visibility so no assigned subjects/enrollments returns an empty list instead of all students.
- Fixed teacher activity update/reopen authorization to verify subject ownership and activity-subject match.
- Hardened file list/download/delete permissions and added audit logging for download/delete/denied access.
- Added persisted import preview batches and CSV/file limits for student import.
- Added subject-section assignments using section IDs through `SubjectSection`.
- Added backup management with `BackupRun`, local artifacts, manifests, checksums, retention cleanup, protection, download, validation, and delete safety guards.
- Added Mailrelay test endpoint, worker enable flag, safe provider diagnostics, and admin mail operations UI.
- Added Mailrelay sender-confirmation diagnostics, admin-visible From sender details, and safe recipient identity display for Mail Jobs.
- Added shared mail worker heartbeat tracking, stale-job recovery, safe provider error classification, archived mail jobs, live queue health alerts, and admin-safe retry/cancel/archive controls.
- Split student setup invite from public forgot-password: Pending Setup students require an admin setup email that queues an `account-activation` Mailrelay job, while public forgot-password queues `password-reset` only for active users with a matching requested role.
- Added admin backup history UI and health center cards for backup/mail/database/environment status.
- Hardened frontend logout and refresh token single-flight behavior.
- Updated login routing so public entry points redirect to `/student/login`, valid sessions redirect to role dashboards, and `/teacher/login` plus `/admin/login` remain direct URL only.
- Scoped local student submit drafts by user and activity.
- Reworked unsafe settings UI so unenforced settings are disabled or described as environment controlled.
- Fixed portal table theme tokens for light/dark consistency.
- Final release review fixed shared table row styling so clickable and non-clickable rows both use the `portal-table-row` theme class.
- Final release review added a one-time retry to the local start script for transient Windows preparation crashes before backend launch.
- Added idempotent staging backfill scripts for `SubjectSection` and historical `SubmissionEvent` rows.
- Added `helmet` and `compression` middleware while preserving existing request IDs, CORS, no-store auth headers, and route rate limits.

## Migrations

- `backend/prisma/migrations/20260427120000_production_duplicate_guards/migration.sql`
  - Scopes submission task title uniqueness by subject.
  - Adds notification dedupe key uniqueness.
  - Adds individual/group submission uniqueness guards.
- `backend/prisma/migrations/20260427153000_production_ops_models/migration.sql`
  - Adds `SubjectSection`.
  - Adds `SubmissionEvent`.
  - Adds `BackupRun`.
  - Adds `ImportBatch`.
  - Adds soft-delete metadata to `SubmissionFile`.
- `backend/prisma/migrations/20260428143000_mail_jobs_reliability/migration.sql`
  - Adds `EmailJob.retryableFailure`.
  - Adds `EmailJob.archivedAt`.
  - Adds shared `WorkerHeartbeat` persistence for the dedicated mail worker.

Deploy with:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run backfill:subject-sections
npm run backfill:submission-events
npm run build
node dist/main.js
```

## Public Login Policy

- Public/default landing is Student Login.
- `/`, `/login`, and `/portals` redirect to `/student/login`.
- `/student/login`, `/teacher/login`, and `/admin/login` remain valid direct routes.
- Teacher/admin direct URLs are distribution choices, not a security boundary.
- Role guards, `JwtAuthGuard`, protected frontend routes, and backend authorization remain the real protection.

## Local Verification Run

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed on 2026-04-28 |
| `npm run build` | Passed on 2026-04-28 |
| `npm run check:click-targets` | Passed on 2026-04-28; 167 source files checked |
| `npm audit --omit=dev` | Passed on 2026-04-28; 0 vulnerabilities |
| `cd backend && npx prisma validate` | Passed on 2026-04-28 |
| `cd backend && npx prisma generate` | Passed on 2026-04-28 |
| `cd backend && npm run build` | Passed on 2026-04-28 |
| `cd backend && npm test` | Passed on 2026-04-28 |
| `cd backend && node scripts/production-hardening-checks.cjs` | Passed on 2026-04-28 |
| `cd backend && npx prisma migrate deploy` | Passed on 2026-04-28; no pending migrations locally |
| `cd backend && npm run backfill:subject-sections` | Passed on 2026-04-28; existing enrollment subject/section pairs verified |
| `cd backend && npm run backfill:submission-events` | Passed on 2026-04-28; no remaining rows needed historical events |
| `cd backend && npm audit --omit=dev` | Expected non-zero on 2026-04-28; findings documented below |
| `cd backend && npm run infra:up` | Passed on rerun; local PostgreSQL and MinIO containers started |
| `GET /health/live` | Passed locally |
| `GET /health/ready` | Passed locally after DB and MinIO were running |

Backend production audit remaining findings: 5 total, 4 moderate and 1 high.

- `xlsx`: high advisories with no npm audit fix. Risk is isolated by file size, row, and column limits in student import; keep spreadsheet import admin-only and prefer CSV where possible.
- Nest 10 advisories in `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, and transitive `file-type` require a framework-major upgrade to Nest 11. Direct `multer` was removed and transitive `multer` is overridden to `2.1.1`.

Follow-up plan:

- Schedule a Nest 11 upgrade and run a full API regression pass.
- Replace `xlsx` with a maintained parser or make production imports CSV-only.
- Keep admin import limits set with `STUDENT_IMPORT_MAX_FILE_MB`, `STUDENT_IMPORT_MAX_ROWS`, `STUDENT_IMPORT_MAX_COLUMNS`, and `STUDENT_IMPORT_MAX_SHEETS`.

## Manual QA Checklist

- Access control: verify unenrolled student subject/activity/submission/file access is denied.
- Access control: verify Teacher A cannot view Teacher B students, submissions, activities, or files.
- File permissions: verify non-admin orphan file downloads are denied and admin file inventory still works.
- Mailrelay: send Admin -> Mail Operations test email to Gmail and verify `EmailJob` plus Mailrelay dashboard.
- Mailrelay: verify `QUEUED -> PROCESSING -> SENT`, auto refresh, worker heartbeat, stuck-queue warnings, and archive flow in Admin -> Mail Jobs.
- Auth: verify Admin -> Students `Send Setup Email` creates a fresh `account-activation` MailJob for a Pending Setup student, with `provider=mailrelay` and From resolved from `MAIL_FROM_INVITE`.
- Auth: verify forgot-password with the correct role creates a fresh `password-reset` MailJob for active student, teacher, and admin accounts, while public responses remain generic.
- Auth: verify Pending Setup forgot-password does not send reset email and diagnostics point admins to the setup invite flow.
- Backup: create, download, view manifest, validate checksum, protect, and verify protected/latest delete is blocked.
- Restore: rehearse restore into a disposable database before production launch.

## Mailrelay Test Steps

1. Confirm sender addresses in Mailrelay:
   - `admin@projtrack.codes`
   - `support@projtrack.codes`
   - `notification@projtrack.codes`
2. Restart backend web process.
3. Restart worker process with `MAIL_WORKER_ENABLED=true`.
4. Open Admin -> Mail Jobs.
5. Send a fresh Mailrelay test email to Gmail.
6. Confirm job moves:
   `QUEUED -> PROCESSING -> SENT`
7. Confirm `provider=mailrelay`.
8. Confirm `lastError=null`.
9. Confirm `sentAt` is filled.
10. Confirm Mailrelay dashboard shows accepted/sent.
11. Confirm Gmail inbox/spam/promotions receives the message.

Do not keep retrying old jobs until sender confirmation is fixed; they will keep dying with the same provider rejection. If a fresh job stays `QUEUED`, check worker process, worker env, worker database URL, `nextTryAt`, and worker logs before debugging Gmail delivery.

## Backup/Restore Test Steps

1. Run a manual backup from Admin Backup History.
2. Download the artifact and inspect the manifest fields: app, backupId, createdAt, backupType, recordCounts, checksum, schema/app version.
3. Run checksum validation and confirm success.
4. Protect the backup and verify delete is blocked.
5. Create a newer successful backup and verify the latest successful backup is still blocked from deletion.
6. Rehearse restore only into a disposable database using the runbook, then run `/health/ready`.
7. Keep the pre-restore backup and database snapshot until the rehearsal is verified.

## Staging Validation Checklist

Run these against staging before production cutover:

- `npx prisma migrate deploy` completes successfully.
- `npm run backfill:subject-sections` reports existing enrollment pairs verified/backfilled.
- `npm run backfill:submission-events` completes; rerun until no rows need backfill.
- Existing subjects, enrollments, submissions, files, groups, and dashboards load correctly.
- Student cannot access an unenrolled subject, activity, submission, group, or file.
- Teacher cannot access another teacher's students, activities, submissions, or files.
- Admin-only file inventory and backup pages work.
- Mailrelay test email reaches a Gmail mailbox.
- Forgot password email works.
- Account activation/setup email works.
- Backup create, download, manifest view, and checksum validation work.
- Latest successful, protected, and running backup delete attempts are blocked.
- Restore rehearsal succeeds from a validated artifact into a disposable database.
- `/health/live` returns ok.
- `/health/ready` returns ok after DB, storage, mail, config, and backup checks are healthy.
- Exactly one mail worker has `MAIL_WORKER_ENABLED=true`.
- Exactly one backup worker has `BACKUP_WORKER_ENABLED=true`.
- Admin -> Mail Jobs shows `queuedTooLongCount=0` and `processingTooLongCount=0` before cutover.
- Old sent/dead mail jobs are archived instead of deleted.

## Production Launch Checklist

- Production env has `NODE_ENV=production` and `APP_ENV=production`.
- Production env has `APP_URL=https://www.projtrack.codes`.
- Production env has `CORS_ORIGINS=https://www.projtrack.codes,https://projtrack.codes`.
- Production env has `MAIL_PROVIDER=mailrelay`.
- Production env has `TESTMAIL_ENABLED=false`.
- Production env has confirmed Mailrelay senders for `MAIL_FROM_ADMIN`, `MAIL_FROM_NOREPLY`, `MAIL_FROM_INVITE`, `MAIL_FROM_NOTIFY`, and `MAIL_FROM_SUPPORT`.
- Web process has `MAIL_WORKER_ENABLED=false` and `BACKUP_WORKER_ENABLED=false`.
- Dedicated worker process uses `npm run start:worker` with `MAIL_WORKER_ENABLED=true` and `BACKUP_WORKER_ENABLED=true`.
- Dedicated worker process must be the only process writing the shared mail worker heartbeat.
- SMTP variables are not active and `MAIL_PROVIDER=smtp` is not used.
- Package artifact excludes `.env`, logs, `node_modules`, `dist` source maps if not needed, uploads, local runtime data, and backup artifacts.
- Run `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, both backfill scripts, `npm run build`, then start `node dist/main.js`.

## Rollback Plan

1. Keep the pre-deploy database snapshot and latest successful ProjTrack backup.
2. If migration fails, stop deployment and restore the pre-deploy database snapshot.
3. If runtime health fails after deploy, revert the application artifact and keep the migrated database unless the failure is data-related.
4. For data-related failures, put the site in maintenance mode, validate the rollback snapshot, restore it, and rerun `/health/ready`.
5. Revoke any test reset/setup links generated during failed validation.

## Remaining Limitations

- Full Google Drive backup storage is not implemented; storage is structured for future `gdrive`/`s3` providers.
- In-app restore is intentionally not enabled. Restore remains a manual operator runbook action because it is destructive.
- No full database-backed Jest suite existed. A backend `npm test` production-hardening regression script was added to catch permission and safety regressions without requiring seeded data.
- Nest 11 upgrade and an `xlsx` replacement or CSV-only import policy remain follow-up items.
