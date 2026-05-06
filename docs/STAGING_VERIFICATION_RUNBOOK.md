# Staging Verification Runbook

Use this runbook before any production approval. Run commands from the repository root unless a command uses `npm --prefix backend`.

## Preconditions

- Target branch is `production-hardening-repo-audit`.
- Staging uses production-like PostgreSQL, S3-compatible object storage, Mailrelay, ClamAV, dedicated mail worker, dedicated backup worker, and monitoring.
- Use staging-only smoke accounts and secrets. Do not use production user passwords.
- Record the commit SHA, operator, environment URL, start time, command output, and screenshots where useful.

## 1. Repository Identity

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected result: repo root is this repository, branch is the approved branch, and status is clean or intentionally documented.

## 2. Dependency Install

```powershell
npm ci --include=dev
npm --prefix backend ci --include=dev
```

Expected result: both installs finish with no high-severity audit failures.

## 3. Static, Build, and Security Gates

```powershell
npm run security:secrets
npm run check:release-hygiene
npm run check:frontend-env:production
npm run check:frontend-env
npm run typecheck
npm run build:production-fixture
npm --prefix backend run prisma:generate
$env:DATABASE_URL="postgresql://<staging-user>:<staging-password>@<staging-host>:5432/<staging-db>?schema=public"
npm --prefix backend run prisma:validate
npm --prefix backend run build
npm --prefix backend run check:boot:production
npm --prefix backend run check:boot:worker
npm --prefix backend test
npm --prefix backend run test:unit
npm run e2e:responsive
npm run check:click-targets
npm run check:theme
npm audit --audit-level=high
npm --prefix backend audit --audit-level=high
```

Expected result: every command exits 0. Theme warnings are allowed only if already listed in the risk register and not launch blocking.

## 4. Prisma Migration Deploy Against Staging DB

```powershell
$env:DATABASE_URL="postgresql://<staging-user>:<staging-password>@<staging-host>:5432/<staging-db>?schema=public"
npm --prefix backend run prisma:migrate:deploy
```

Expected result: Prisma reports all migrations applied or no pending migrations. Any drift, failed migration, or unresolved migration row is a launch blocker.

## 5. Docker Backend Build

```powershell
docker build -f Dockerfile.backend -t projtrack/backend:<commit-sha> .
```

Expected result: image builds successfully from a clean checkout.

## 6. Docker Backend Boot

Use a staging env file with real staging values and no production secrets:

```powershell
docker run --rm --name projtrack-api-boot `
  --env-file .\backend.env.staging `
  -p 3001:3001 `
  projtrack/backend:<commit-sha>
```

In another terminal:

```powershell
Invoke-WebRequest http://127.0.0.1:3001/health/live
Invoke-WebRequest http://127.0.0.1:3001/health/api-ready
```

Expected result: container remains running; `/health/live` and `/health/api-ready` return HTTP 200 with `ok: true`.

## 7. Production Compose Boot Smoke

Place the staging env file next to `infra/docker-compose.production.yml` as `backend.env.production` only in the staging host directory.

```powershell
docker compose -f infra/docker-compose.production.yml --env-file backend.env.production up -d --build
docker compose -f infra/docker-compose.production.yml ps
docker compose -f infra/docker-compose.production.yml logs --tail=200 backend
docker compose -f infra/docker-compose.production.yml logs --tail=200 mail-worker
docker compose -f infra/docker-compose.production.yml logs --tail=200 backup-worker
```

Expected result: backend is healthy; worker containers are running; backend logs show no runtime safety errors.

## 8. Health Checks

```powershell
Invoke-WebRequest https://<staging-api-host>/health/live
Invoke-WebRequest https://<staging-api-host>/health/api-ready
Invoke-WebRequest https://<staging-api-host>/health/ready
```

Expected result:

- `/health/live`: HTTP 200, `ok: true`.
- `/health/api-ready`: HTTP 200, database/storage/config all true.
- `/health/ready`: HTTP 200 only after mail and backup worker health is verified.

## 9. Worker Boot Check

```powershell
$env:DATABASE_URL="postgresql://<staging-user>:<staging-password>@<staging-host>:5432/<staging-db>?schema=public"
npm --prefix backend run check:boot:worker
npm --prefix backend run smoke:worker
```

Expected result: worker boot fixtures pass and dedicated worker process logs its ready line before graceful shutdown.

## 10. Smoke Dependency and Environment Checks

```powershell
npm run check:smoke-deps
$env:SMOKE_ADMIN_IDENTIFIER="admin.smoke@example.test"
$env:SMOKE_ADMIN_PASSWORD="<staging-only-password>"
npm run check:smoke-env
```

Expected result: Docker/PostgreSQL/browser dependencies are ready; smoke credentials are present and never printed.

## 11. Authenticated Browser Smoke

```powershell
npm run seed:smoke
npm run e2e:smoke
npm run e2e:responsive:auth
```

Expected result: admin, teacher, and student smoke flows pass, including login, refresh, logout, and protected route behavior.

## 12. Upload, Download, Delete Smoke

```powershell
npm --prefix backend run smoke:storage
```

Also run the browser smoke path that uploads a valid file, views metadata, downloads it, deletes it, and confirms it is no longer accessible.

Expected result: valid uploads succeed; metadata resolves; download works; delete removes metadata/storage; invalid and oversized uploads are rejected with user-visible errors.

## 13. Mailrelay Email Smoke

```powershell
npm --prefix backend run smoke:mail
```

Expected result: test mail job queues, worker sends through Mailrelay, `/health/mail` shows provider configured, worker heartbeat fresh, and no recent delivery failure.

## 14. S3/Object Storage Smoke

```powershell
npm --prefix backend run smoke:storage
```

Expected result: S3-compatible bucket supports put, head, signed download URL, and delete. Bucket must be private; signed URLs must expire within configured TTL.

## 15. ClamAV/Malware Scanner Smoke

Production requires:

```powershell
$env:FILE_MALWARE_SCAN_MODE="fail-closed"
$env:FILE_MALWARE_SCANNER="clamav"
$env:CLAMAV_HOST="<staging-clamav-host>"
$env:CLAMAV_PORT="3310"
```

Run a valid clean upload and an EICAR test upload through the staging API.

Expected result: clean upload succeeds; EICAR or scanner-positive payload is rejected; scanner outage causes upload failure, not success.

## 16. Backup Job Smoke

```powershell
npm --prefix backend run smoke:worker
```

Trigger an admin backup from the staging admin UI or API, then verify the backup appears in backup history.

Expected result: backup completes, checksum is recorded, protected/latest backup cannot be deleted accidentally.

## 17. Restore Drill

```powershell
npm --prefix backend run drill:backup-restore
```

Expected result: restore drill completes against a disposable staging database or restore target. Never run a destructive restore against production without explicit approval.

## 18. Rollback Verification

```powershell
docker image ls projtrack/backend
docker compose -f infra/docker-compose.production.yml config
```

Verify:

- Previous backend image is still available.
- Previous frontend deployment artifact is still available.
- Database rollback plan is documented for irreversible migrations.
- Rollback operator has access and approval path.

Expected result: rollback can be executed within the documented recovery time objective.

