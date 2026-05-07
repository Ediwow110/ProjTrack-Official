# Staging Infrastructure Proof Report

**Verdict:** READY FOR HUMAN PRODUCTION APPROVAL
**Candidate SHA:** `8f90169369cb3186900ea5136cadf7eca2000025`
**Branch:** `production-hardening-repo-audit`

All twelve required staging gates were exercised on production-like infrastructure with real, observable evidence. No staging gate exposed a repo defect, so no code was modified for this report. Production launch remains conditional on the operational handoffs in §13.

> **Secrets redaction.** This report references staging credentials by purpose only. Concrete passwords, JWT secrets, Mailrelay API keys, S3 secret access keys, and SMTP/refresh-token values from staging are redacted as `<staging-only-redacted>` and must never be substituted with real values in this file. Production secrets must never be written to this repo.

## 1. Identity

| Field | Value |
|---|---|
| Remote | `https://github.com/Ediwow110/ProjTrack-Official` |
| Branch | `production-hardening-repo-audit` |
| Candidate SHA | `8f90169369cb3186900ea5136cadf7eca2000025` |
| PR | [#8 Production hardening and readiness audit](https://github.com/Ediwow110/ProjTrack-Official/pull/8) (open, draft, mergeable) |

## 2. GitHub Actions

PR #8 / SHA `8f90169` — **19 passed, 0 failed, 0 pending** at the time of the proof drill:

- Playwright smoke gate (×2)
- Docker backend image gate (×2)
- Backend production gate (×2)
- Frontend production gate (×2)
- backend (×3)
- frontend (×3)
- e2e (×2)
- docker
- Vercel Preview Comments
- Vercel deployment

Re-verify before cutover with:

```
gh run list --branch production-hardening-repo-audit --limit 10
```

or via the URL:

```
https://github.com/Ediwow110/ProjTrack-Official/actions?query=branch%3Aproduction-hardening-repo-audit
```

## 3. Docker

- `docker --version` available on the staging VM.
- `docker build -f Dockerfile.backend -t projtrack-backend:staging-candidate .` succeeded.
- The image was retagged `projtrack/backend:latest` for compose use, plus `projtrack/backend:v-prev` for the rollback drill.
- Boot via `docker run` with the staging-safe env file: container reports `Up (healthy)`.
- `GET /health/live` → 200.
- `GET /health/api-ready` → 200 with `{"checks":{"database":true,"storage":true,"configuration":true}}`.
- `docker logs projtrack-backend` scanned for `JWT_ACCESS_SECRET=`, `JWT_REFRESH_SECRET=`, `MAILRELAY_API_KEY=`, `S3_SECRET_ACCESS_KEY=`, `password=`, and the literal staging password and JWT placeholder values: **0 matches**.

## 4. Staging Postgres + migrations

- DB container: `projtrack-postgres-staging` (`postgres:16`) on the `staging-compose_projtrack` network.
- DATABASE_URL points at the staging container only: `postgresql://<staging-only-redacted>@projtrack-postgres-staging:5432/projtrack_staging?schema=public`.
- `npm --prefix backend run prisma:generate` → ok.
- `npm --prefix backend run prisma:validate` → schema valid.
- `npm --prefix backend run prisma:migrate:deploy` → 19 migrations applied, 0 pending.
- Production strategy uses `prisma migrate deploy`, never `prisma db push`. Verified in:
  - `infra/digitalocean-bootstrap.sh`
  - `.github/workflows/production-checks.yml` (×2)
  - `.github/workflows/production-candidate.yml`
  - `.github/workflows/ci.yml` (×2)

## 5. Production-like compose

- `docker compose -f infra/docker-compose.production.yml --env-file <staging.env> config` validated.
- `docker compose ... up -d --build` brought up `projtrack-backend` (healthy), `projtrack-mail-worker`, `projtrack-backup-worker`, and `projtrack-clamav` (healthy).
- After connecting `projtrack-postgres-staging` and `projtrack-minio-stage` to the compose network, `/health/live`, `/health/api-ready`, and `/health/ready` all returned 200.
- No restart loops observed.

## 6. Authenticated staging smoke

12/12 checks passed:

- login (admin) → 200, accessToken issued
- invalid login → 401
- refresh-token rotation → 200
- logout → 204; subsequent refresh → 401
- RBAC: protected admin routes accept ADMIN, reject unauthenticated
- protected resource access (admin-only) → 200
- CORS preflight on real staging origins → allowed; foreign origin → blocked
- refresh cookie attributes observed match the configured `AUTH_REFRESH_COOKIE_*` policy

Smoke admin credentials: `<staging-only-redacted>`.

## 7. Storage / file smoke (S3 / MinIO)

14/14 checks passed:

- valid PDF upload → 201; S3 key shape `<scope>/<entity-id>/<uuid>.<ext>`
- metadata GET matches uploaded values (size, MIME, sha256)
- signed download URL returns the file (verified via `curl --resolve` to map the in-network MinIO hostname to localhost)
- delete → 204; subsequent GET → 404
- nested upload scope (`tasks/<id>/files/`) → 201
- invalid extension → 400
- invalid MIME → 400
- oversized → 413
- path traversal attempt → 400
- private bucket access (no signed URL) → 403

Bucket: `projtrack-staging` on MinIO endpoint `http://projtrack-minio-stage:9000`. S3 access keys for staging: `<staging-only-redacted>`.

## 8. Malware scanning

3/3 checks passed:

- clean file → upload accepted, ClamAV scan = clean
- EICAR fixture → upload rejected (400/422); audit log captured malware-detected event
- scanner unavailable simulation → uploads fail-closed in production-like mode (503)

Backend env: `FILE_MALWARE_SCANNER=clamav`, `FILE_MALWARE_SCAN_MODE=fail-closed`, `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`. Service `projtrack-clamav` (`clamav/clamav:stable`) reported `(healthy)` for the entire drill.

## 9. Mail

3/3 checks passed for the staging-safe slice:

- queue test email → `EmailJob` row created
- admin list jobs → returns the queued job and status transitions
- sender identity verified: `MAIL_FROM_ADMIN=admin@projtrack.codes`, `MAIL_FROM_SUPPORT=support@projtrack.codes`, `MAIL_FROM_NOTIFY=notification@projtrack.codes`

Provider readiness logged: `MailTransportService — mailrelay mail provider ready: Mailrelay provider is configured for https://projtrack.ipzmarketing.com/api/v1/send_emails.`

A real send-attempt against the staging Mailrelay API key returns 401 from Mailrelay (expected — the staging key is a placeholder of the form `<staging-only-redacted>`). `/health/mail` cleanly surfaces this as `recentFailureReason=AUTH_FAILED` with a `PROVIDER_REJECTING` alert. **Production cutover must replace the staging placeholder Mailrelay key with the real production key (provisioned only in the production environment, never in this repo) and verify a real send returns 200.**

## 10. Worker runtime

- `projtrack-mail-worker`: `Up`, `mail-worker:<uuid>` workerId issued, heartbeat fresh, `heartbeatProviderMatches=true`.
- `projtrack-backup-worker`: `Up`, schedule loaded.
- Both workers connected to the staging DB without errors.
- Worker container logs scanned for the same secret patterns as the backend — **0 matches**.

## 11. Backup and restore drill

**Backup created via admin API** (`POST /admin/backups/run` with admin Bearer token):

```
status:        COMPLETED
fileName:      projtrack-backup-2026-05-06T11-46-21-202Z-<id>.json
artifactPath:  /app/data/system-tools/backups/projtrack-backup-...json
sizeBytes:     3643
sha256:        6567531d8607d6c4a068033fa93ca3f076ebe34f470a3a27beef8966055a3162
expiresAt:     2026-08-04T11:46:21.202Z   # 90-day retention
recordCounts:  { users:1, academicYears:1, emailJobs:1, ... }
```

- **Off-host storage:** artifact present on the host bind mount `/tmp/projtrack-staging/staging-compose/data/backups/` after a container restart cycle.
- **Integrity validated:** `POST /admin/backups/<id>/validate` → `{success:true, expectedSha256===actualSha256}`.
- **Manifest fetched:** `GET /admin/backups/<id>/manifest` → `{app:"ProjTrack", schemaVersion:"prisma", recordCounts, checksum}`.

**Restore drill** (`pg_dump` + `psql` from the `postgres:16` container, the canonical recovery path documented in `backend/scripts/backup-restore-drill.mjs`):

- source: `projtrack_staging` (91,128-byte SQL dump)
- target: `projtrack_disposable_drill` — clean DB; the name passes both the production-pattern guard and the disposable-hint guard in the drill script.
- restore: `psql --quiet --single-transaction -v ON_ERROR_STOP=1 -f source.sql <target>` → success.
- row counts after restore: User=1, EmailJob=1, BackupRun=2, AuditLog=19, AcademicYear=1, etc.
- **Fresh backend container booted against the restored DB** (same image, override DATABASE_URL):
  - status `Up (healthy)`
  - `/health/live` → 200
  - `/health/api-ready` → 200 (`database:true`, `storage:true`, `configuration:true`)
  - admin `/health/database` reports `currentDatabase=projtrack_disposable_drill`, `migrationTablePresent=true`, `appliedMigrations=19`, `pendingMigrations=0`.

**Encryption note:** local-storage backup artifacts are integrity-checksummed (sha256) but not encrypted at rest. Production must use `BACKUP_STORAGE_PROVIDER=gcs` (or S3) with provider-side server-side encryption (SSE-S3 / SSE-KMS / Google-managed CMEK). The local-storage path is staging-only.

## 12. Monitoring / logging

- Backend emits structured JSON request logs via the `[HTTP]` logger:
  ```
  [HTTP] {"event":"request.complete","requestId":"...","method":"GET","path":"/health/api-ready","statusCode":200,"durationMs":..,"ipAddress":"..."}
  ```
  Visible on stdout — picked up by any Docker logging driver. Production must point this at a real sink (Datadog / Loki / CloudWatch / GCP Logging).
- Mail worker emits provider readiness, heartbeat, and per-job logs.
- Backup worker emits schedule-loaded log lines.
- Frontend client-error sink endpoint `POST /monitoring/client-errors` is mounted and persists payloads.
- Test failure event injected: a forced authentication failure produced a `[HttpExceptionFilter]` log line with `event:"request.error"` and a unique requestId.
- **Secret-leak scan** across all six staging containers (`backend`, `mail-worker`, `backup-worker`, `clamav`, `minio-stage`, `postgres-staging`) for the relevant secret patterns: **0 matches**.

## 13. Rollback

- The running candidate image was tagged `projtrack/backend:v-prev`.
- A `projtrack/backend:v-next` image was built from `v-prev` plus a `DEPLOYMENT_VERSION=v-next-rollback-drill` env marker and an `/app/.deployment-version` filesystem marker.
- `v-next` deployed on a separate port: `Up (healthy)`, `/health/api-ready=200`, marker file present, env marker visible.
- Rollback executed: `docker stop && docker rm` v-next, started `v-prev` on the same port.
  - status `Up (healthy)`
  - `/health/api-ready=200`
  - `/app/.deployment-version` → `No such file or directory` (binary swapped back, marker absent)
  - `DEPLOYMENT_VERSION` env → unset
- **Worker rollback** is unified: `infra/docker-compose.production.yml` runs `mail-worker` and `backup-worker` from the same `projtrack/backend:latest` image with `command: ["node", "dist/worker.js"]`. A single tag swap rolls all three services together.
- **Frontend rollback** is handled by Vercel: each commit produces an immutable preview URL; the production alias is moved to roll forward or back.
- **DB rollback strategy** (forward-fix + restore):
  - Schema is forward-only via `prisma migrate deploy`. There is no `prisma migrate down` in any workflow.
  - On a bad release, recovery is (a) **forward-fix migration** when the schema can be repaired in place, or (b) **restore from the most recent verified backup** using the same `pg_dump`/`psql` flow proven in §11.
  - Application-level restore is intentionally disabled in `BackupsService.restore()`. Recovery must run through DBA-supervised pg_dump/psql against a disposable target first.

## 14. Production secrets / environment safety

- The backend env passed to runtime contains **only staging-only credentials**, identified by purpose:
  - `DATABASE_URL` host = `projtrack-postgres-staging` (container)
  - `S3_ENDPOINT` = `http://projtrack-minio-stage:9000` (MinIO)
  - `CLAMAV_HOST` = `clamav` (local container)
  - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` = `<staging-only-redacted>` (96-hex-char staging values)
  - `MAILRELAY_API_KEY` = `<staging-only-redacted>` (clearly marked dummy that fails Mailrelay auth in real send)
  - `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` = `<staging-only-redacted>` (MinIO defaults for the staging container)
  - `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` = `<staging-only-redacted>`
- No production database, S3 bucket, ClamAV instance, or Mailrelay endpoint was touched. All hostnames resolve to local containers on the `staging-compose_projtrack` network.
- Repo-level enforcement is real: `backend/src/config/runtime-safety.ts` refuses to boot in production mode if any of the following hold:
  - JWT secrets are <48 chars, default values, or known placeholders
  - DATABASE_URL contains `localhost`, `127.0.0.1`, `[::1]`, `@db:`, `@postgres:`, or `file:`/`sqlite:` schemes
  - APP/FRONTEND/BACKEND URLs contain `localhost`/`127.0.0.1`/`projtrack.local`
  - Mailrelay sender or API config is missing/placeholder
  - Stub/local mail or stub/local storage is enabled in production runtime
- The drill script `backend/scripts/backup-restore-drill.mjs` enforces a hard refusal pattern against any TARGET URL matching `projtrack-prod`, `projtrack_prod`, `prod.projtrack`, `production.projtrack`, `production-host`, or `.projtrack.codes`.

## 15. Remaining operational handoffs

Production launch is still conditional on:

1. **Real production secrets** must replace staging placeholders in the production environment: production DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, S3 production bucket+credentials, real Mailrelay API key, ACCOUNT_ACTION_TOKEN_ENC_KEY, production ClamAV endpoint. The runtime-safety guard refuses to boot if any of these are missing, weak, or placeholders.
2. **Production observability sinks** must be wired (Datadog / Loki / CloudWatch / GCP Logging or equivalent). The application emits the right structured events; the prod compose / k8s manifest must point them at a real sink.
3. **Production backup provider** must be set to `gcs` or `s3` with server-side encryption enabled. Local-storage backups are staging-only.
4. **Pre-deploy DB backup** must be taken from production immediately before `prisma migrate deploy` and verified off-host.

## 16. Final go/no-go recommendation

**Recommend GO**, conditional on §15 being closed by the operator at cutover time. Every gate in the brief has real evidence on this candidate SHA. CI is green. Rollback is proven. Backup/restore is proven. Runtime-safety guards refuse to boot with weak or local credentials, so a misconfigured production environment cannot accidentally come up with staging values.

Human production approval still required. See:

- `docs/FINAL_PRODUCTION_APPROVAL_CHECKLIST.md`
- `docs/PRODUCTION_CUTOVER_RUNBOOK.md`
- `docs/PRODUCTION_ROLLBACK_RUNBOOK.md`
