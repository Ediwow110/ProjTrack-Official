# Production Launch Runbook

This runbook is a final operator checklist. Do not deploy production unless every go/no-go item is complete with evidence.

## Pre-Launch Requirements

- Approved commit SHA is recorded.
- Staging verification runbook has passed on production-like infrastructure.
- CI is green for the approved SHA.
- Production environment variables are complete and validated.
- Secrets are rotated if any previous exposure risk exists.
- Database backup and restore drill evidence is attached.
- Rollback path has been tested.
- Monitoring, alerting, and incident contacts are active.
- Release owner, security owner, SRE owner, QA owner, and business approver are named.

## Release Freeze

1. Announce release freeze.
2. Stop non-critical merges.
3. Confirm no schema-affecting PRs are pending outside this release.
4. Confirm support staff are available for the monitoring window.

## Approved Commit SHA

Record:

- Commit SHA:
- Branch:
- Build artifact:
- Docker image tag:
- Frontend deployment artifact:
- Approval timestamp:
- Approver:

## Required Staging Evidence

Attach evidence for:

- Local/static checks.
- Docker build.
- Docker boot smoke.
- Prisma migrate deploy.
- `/health/live`, `/health/api-ready`, `/health/ready`.
- Worker heartbeat.
- Authenticated smoke.
- Upload/download/delete smoke.
- Invalid and oversized upload rejection.
- S3/object storage smoke.
- ClamAV scanner smoke.
- Mailrelay smoke.
- Backup job.
- Restore drill.
- Monitoring test alert.
- Rollback test.

## Secret Rotation Confirmation

Confirm these are unique, long, non-default, stored only in the production secret manager, and rotated if previously exposed:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCOUNT_ACTION_TOKEN_ENC_KEY`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `MAILRELAY_API_KEY`
- `SMOKE_ADMIN_PASSWORD` for staging only

## Database Backup Confirmation

Before migrations:

1. Take a production database backup.
2. Record backup ID, timestamp, size, checksum, and storage location.
3. Confirm backup is protected from accidental deletion.
4. Confirm restore drill evidence is current.

## Rollback Plan

Application rollback:

1. Repoint backend service to previous Docker image.
2. Repoint frontend to previous deployment artifact.
3. Restart API and workers.
4. Verify `/health/live`, `/health/api-ready`, login, refresh, and critical admin views.

Database rollback:

- Prefer forward fix for migrated schemas.
- If destructive rollback is required, stop writes, restore the protected backup to a new database, switch `DATABASE_URL`, and verify integrity before reopening traffic.

## Production Migration Steps

```powershell
git rev-parse HEAD
npm --prefix backend ci --include=dev
npm --prefix backend run prisma:generate
$env:DATABASE_URL="<production database url from secret manager>"
npm --prefix backend run prisma:migrate:deploy
```

Expected result: migrations apply cleanly with no drift or unresolved migration rows.

## Backend Deployment

```powershell
docker build -f Dockerfile.backend -t projtrack/backend:<approved-sha> .
docker compose -f infra/docker-compose.production.yml --env-file backend.env.production up -d
docker compose -f infra/docker-compose.production.yml ps
```

Expected result: backend service is healthy; mail worker and backup worker are running.

## Worker Deployment

Confirm exactly one mail worker and exactly one backup worker unless multi-worker locking has been explicitly tested.

```powershell
docker compose -f infra/docker-compose.production.yml logs --tail=200 mail-worker
docker compose -f infra/docker-compose.production.yml logs --tail=200 backup-worker
```

Expected result: no runtime safety errors; mail heartbeat appears fresh in `/health/mail`; backup schedule appears in `/health/backups`.

## Frontend Deployment

```powershell
npm ci --include=dev
npm run check:frontend-env:production
npm run build:production-fixture
```

Deploy the generated frontend artifact using the approved production hosting path.

Expected result: production frontend points to `https://api.projtrack.codes` or the approved API origin, not localhost.

## Post-Deploy Smoke Tests

Run:

- `GET /health/live`
- `GET /health/api-ready`
- `GET /health/ready`
- Login, refresh, logout.
- Admin dashboard load.
- Teacher dashboard load.
- Student dashboard load.
- Upload, metadata, download, delete.
- Invalid file rejection.
- Oversized file rejection.
- Mailrelay test email.
- Backup trigger and backup history.
- Monitoring test event.

## Monitoring Window

Minimum monitoring window: 2 hours after launch.

Watch:

- 5xx error rate.
- Login/refresh/logout failures.
- Queue depth and stale mail processing.
- Worker heartbeat freshness.
- Database connection errors.
- Storage probe failures.
- ClamAV scanner failures.
- Backup failures.
- Unusual rate-limit spikes.

## Rollback Triggers

Rollback immediately for:

- Authentication outage.
- Database migration corruption.
- API readiness failure lasting more than 5 minutes.
- Worker heartbeat missing with growing queue.
- S3 upload/download/delete failure affecting real users.
- Mailrelay outage blocking account activation/reset.
- Security control disabled or bypassed.
- Monitoring unavailable during active incident.

## Incident Severity Levels

- SEV-1: Full outage, data loss, auth compromise, or unsafe deployment.
- SEV-2: Major user-facing degradation, failed uploads/downloads, or stuck workers.
- SEV-3: Limited feature degradation with workaround.
- SEV-4: Cosmetic, documentation, or low-risk operational issue.

## Go/No-Go Rules

Go only if every launch blocker is closed with evidence. No-go if any gate is skipped, blocked, assumed, or manually overridden without written approval.

