# ProjTrack Production Release Runbook

This runbook matches the current production hardening code paths. Production must fail closed: no local database, local object storage, stub mail, mock frontend mode, or localStorage refresh-token flow.

## Environment

Backend production requires `NODE_ENV=production`, `APP_ENV=production`, managed PostgreSQL in `DATABASE_URL`, public `https://` values for `APP_URL`, `FRONTEND_URL`, `BACKEND_URL`, and `CORS_ORIGINS`, `TRUST_PROXY=true`, strong JWT secrets, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_KEY_ID`, and a 32-byte `ACCOUNT_ACTION_TOKEN_ENC_KEY`.

Mail requires `MAIL_PROVIDER=mailrelay`, verified sender variables, `MAILRELAY_API_KEY`, `MAILRELAY_API_URL`, and one dedicated worker process with `MAIL_WORKER_ENABLED=true`.

Storage requires `OBJECT_STORAGE_MODE=s3`, a private bucket, credentials, and short signed URL TTLs. Upload scanning requires `FILE_MALWARE_SCAN_MODE=fail-closed`, `FILE_MALWARE_SCANNER=clamav`, `CLAMAV_HOST`, and `CLAMAV_PORT`.

Frontend production requires `VITE_USE_BACKEND=true`, `VITE_API_BASE_URL=https://...`, and `VITE_PUBLIC_APP_URL=https://...`.

## Auth And Sessions

Access tokens are short-lived bearer tokens. In production, refresh tokens are set only as `httpOnly`, secure, same-site cookies scoped to `/auth`; the API does not return refresh tokens in JSON. The frontend stores access tokens in memory and persists only non-token session display data.

Refresh token rotation is server-side through `AuthSession`. Reusing a rotated refresh token revokes all active sessions for the user. Logout clears the refresh cookie and revokes the current server-side session. Every guarded request reloads the user, checks `status === ACTIVE`, and rejects role drift.

The custom token format is HMAC-SHA256 with `alg`, `typ`, `kid`, issuer, audience, `iat`, and `exp`. Rotate keys by changing `JWT_KEY_ID` and the matching secret during a controlled session invalidation window.

## Upload Policy

Use `POST /files/upload` with multipart form data. `POST /files/upload-base64` is retained for development compatibility and is blocked in production unless `ALLOW_BASE64_UPLOADS_IN_PRODUCTION=true`.

Uploads enforce max size, extension allowlists, executable/script blocking, archive blocking unless explicitly enabled, MIME checks, magic-byte checks, filename sanitization, ClamAV scanning in production, attachment-only downloads, signed S3 downloads, and authorization checks before metadata, download, or delete.

Submission attachment uses a pending-upload ownership model. `POST /files/upload` creates a `PendingUpload` row with owner user id, storage key, sanitized filename, MIME type, extension, size, SHA-256, status, and expiry. Student submission payloads must send `uploadId`; raw `relativePath` is rejected by DTO validation. The submission transaction creates the `SubmissionFile` rows and atomically marks each pending upload `CONSUMED`, so another student cannot attach someone else's upload and consumed uploads cannot be reused.

Set `PENDING_UPLOAD_TTL_MINUTES` to control unconsumed upload retention. Expired pending uploads can be cleaned through the `FilesService.cleanupExpiredPendingUploads` path or a maintenance job. Orphaned objects remain private and must never be publicly listed.

## Mail

Mail jobs are persisted in PostgreSQL before delivery. The API process queues jobs; a dedicated worker sends them. Production rejects `stub`, testmail, and deprecated SMTP. Mailrelay provider errors are classified and redacted before admin display. Permanent failures are stored as dead jobs; retryable failures use scheduled retry/backoff.

Template keys are canonical and strict: `account-activation`, `password-reset`, `email-verification`, `teacher-activity-notice`, `bulk-invitation`, and `broadcast`. Unknown template keys throw before queueing or rendering. Payload validation rejects missing required fields, malformed action URLs, invalid dates, CRLF subject injection, and oversized text. User-provided HTML is escaped in rendered HTML and readable text bodies are generated for every template.

Staging smoke:

```bash
cd backend
MAIL_SMOKE_TO=admin@example.com npm run smoke:mail
```

## Object Storage

Production requires private S3-compatible object storage. Buckets must block public access; downloads happen through short-lived signed URLs with attachment disposition. Object keys use unguessable UUID names under validated scopes.

Staging smoke:

```bash
cd backend
npm run smoke:storage
```

## Database And Restore

Release procedure: restore a recent production-like snapshot into staging, run `npx prisma validate`, `npx prisma generate`, and `npx prisma migrate deploy`, run backend and E2E smoke tests, take a production backup, then deploy migrations in production. Use forward-fix migrations unless the hosting provider can restore a verified snapshot.

Seed data is not automatically inserted by production startup. Demo cleanup and destructive tools are locked by environment flags, typed confirmations, rate limits, and audit logs.

Backup readiness requires database backups, object storage backups/versioning, encrypted retention, access controls, and a restore drill in staging before go-live.

## Admin Tools

Dangerous admin tools are disabled by default in production. To execute destructive tools, the deployment must explicitly enable the relevant environment flag, the admin must provide the typed confirmation phrase, and the action is audit logged. Restore remains intentionally unsupported in-app; use verified database snapshots and object storage recovery.

## Headers And XSS Posture

Backend Helmet and Vercel headers set CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `base-uri`, `object-src`, `form-action`, and `frame-ancestors`. `style-src 'unsafe-inline'` is temporarily allowed because the current React UI and chart components still use inline styles; remove inline style usage before tightening this directive.

## CI Gates

CI runs frontend install, secret scan, release hygiene, click-target check, frontend env validation, typecheck, production build, audit, backend install, Prisma validate/generate/migrate deploy, build, production hardening tests, audit, and E2E smoke.

Local Windows shells may fail when assigning production env inline. Use `npm run check:frontend-env:production` and `npm run build:production-fixture` for local verification; CI still uses real environment variables and `npm run build`.

## Release Checklist

1. Set real production secrets in the deployment provider, never in the repo.
2. Verify Mailrelay sender domain and DNS.
3. Create private S3 bucket and IAM credentials.
4. Deploy ClamAV or a compatible scanner.
5. Run storage and mail smoke commands in staging.
6. Run E2E smoke in staging.
7. Verify monitoring for API, worker heartbeat, DB, storage, mail dead jobs, and uptime.
8. Run a restore drill in staging and record the result.

## Incident Basics

Auth token leak: rotate JWT secrets and `JWT_KEY_ID`, revoke `AuthSession`, and rotate account-action encryption only after outstanding activation/reset tokens can be invalidated. Mail provider compromise: rotate provider API key, pause worker, review dead/retried jobs, then resume. Storage credential leak: rotate IAM keys, audit object access logs, and invalidate signed URLs by rotating credentials. Database incident: stop writes if needed, restore a verified snapshot in staging first, then execute provider-supported recovery.
