# Monitoring Runbook

This runbook defines the alerts, dashboards, and probes that must be active
before flipping production DNS. Until every row is configured, the production
verdict remains **CONDITIONAL GO**.

## Probe targets

| Probe | URL | Expected | Frequency |
| --- | --- | --- | --- |
| Frontend reachable | `https://projtrack.codes/` | 200, body contains `<div id="root">` | 1 min |
| Backend liveness | `https://api.projtrack.codes/health/live` | 200 | 30 s |
| Backend readiness | `https://api.projtrack.codes/health/ready` | 200 | 30 s |
| Staging frontend | `https://staging.projtrack.codes/` | 200 | 5 min |
| Staging backend | `https://api-staging.projtrack.codes/health/ready` | 200 | 5 min |

DigitalOcean Uptime checks cover all five for free. Set them up under
**Monitoring → Uptime → Create check** and assign each to the relevant alert
policy below.

## Health endpoint reference

All health endpoints bypass rate-limiting. Public endpoints need no auth;
admin endpoints require a JWT with the `ADMIN` role.

| Route | Auth | What it checks | Expected |
| --- | --- | --- | --- |
| `GET /health` | Public | Root liveness (`{ok, uptimeSeconds}`) | 200 |
| `GET /health/live` | Public | Same as root — Docker HEALTHCHECK target | 200 |
| `GET /health/ready` | Public | Full composite: DB + storage + mail + config + backups | 200 / 503 |
| `GET /health/api-ready` | Public | DB + storage + config only (skips expensive mail/backup) | 200 / 503 |
| `GET /health/database` | Admin | DB probe, migration status, pending migrations | 200 |
| `GET /health/storage` | Admin | Real read-write-delete probe against S3 or local storage | 200 |
| `GET /health/mail` | Admin | Mail transport, queue depth, worker heartbeat, rate-limit status | 200 |
| `GET /health/backups` | Admin | Last success, failure count, storage used, worker status | 200 |
| `GET /health/configuration` | Admin | Runtime env-var validation (same as boot-time check) | 200 |

Use `/health/live` for load-balancer and orchestrator liveness probes.
Use `/health/ready` for the full application-health signal.
Use `/health/api-ready` when you need a faster readiness signal that skips the
expensive mail and backup checks (e.g., Docker `depends_on` chains).

## Alert policies

| Signal | Threshold | Severity | Notify |
| --- | --- | --- | --- |
| `/health/live` not 200 | 2 consecutive failures (1 min) | Page | on-call |
| `/health/ready` not 200 | 5 consecutive failures (~2.5 min) | Page | on-call |
| Frontend 5xx rate (Caddy logs) | > 5% over 5 min | Page | on-call |
| Frontend 5xx rate | > 1% over 5 min | Warning | channel |
| Auth failure rate (`POST /auth/login` 401) | > 20% over 10 min | Warning | channel |
| Mail-job `QUEUED` count | > 100 sustained 10 min | Warning | channel |
| Mail-job oldest pending | > `MAIL_PROCESSING_STALE_MS` (default 600 000 ms) | Page | on-call |
| Backup last successful run | > 25 hours ago | Page | on-call |
| Droplet CPU | > 85% sustained 10 min | Warning | channel |
| Droplet memory | > 90% sustained 5 min | Warning | channel |
| Droplet disk | > 80% | Warning | channel |
| Droplet disk | > 90% | Page | on-call |
| Container restart count | any container restarts > 3× in 10 min | Page | on-call |
| DB unreachable (from `/health/ready`) | any (page) | Page | on-call |
| Spaces 5xx rate | > 1% sustained 10 min | Warning | channel |

## Provider configuration

Choose **one** monitoring provider and configure the probes, alerts, and
dashboards below. The checklist is the same regardless of provider.

### Generic provider-agnostic checklist

1. Add a metrics/logs agent to every Droplet (or use the cloud's built-in agent).
2. Configure **uptime checks** for the 5 probe targets above from ≥ 2 regions.
3. Create **alert policies** matching the table above. Use the threshold values
   as-is; adjust notification cadence to your team's on-call schedule.
4. Wire **application-level signals** (mail backlog, backup staleness, auth
   failure rate) via a webhook or synthetic check that parses the
   `/health/ready` JSON payload — most cloud providers do not natively
   understand the JSON contents.
5. Configure **notification channels** — at minimum: email distribution list
   and one chat channel (Slack / Discord / etc.).
6. Enable **storage/bucket-level logging** for the uploads and backups buckets.

### DigitalOcean-specific setup (if using DO)

1. **Project → Monitoring → Add metrics agent** to the Droplet (auto-installs `do-agent`).
2. **Monitoring → Uptime** → create the 5 probes from ≥ 2 regions.
3. **Monitoring → Alert policies** → create one policy per row in the alert table
   below. For application-level signals (mail backlog, backup staleness, auth
   failure rate) wire them via a synthetic check that calls `/health/ready` and
   emits to a Slack / OpsGenie / Better Uptime webhook.
4. **Notification channels** → email distribution list + chat channel.
5. **Spaces metrics** → enable per-bucket logging on `projtrack-prod-uploads`
   and `projtrack-prod-backups`.

### Alternative providers (if not using DO)

| Provider | Uptime checks | Alert policies | Pricing model |
| --- | --- | --- | --- |
| **Better Uptime** | Yes, multi-region | Yes, with Slack/PagerDuty/OpsGenie | Free tier: 5 checks at 1 min |
| **Checkly** | Yes, Playwright-based | Yes, multi-channel | Pay-per-check |
| **Cronitor** | Yes, multi-region | Yes | Per-check |
| **Pingdom** | Yes, multi-region | Yes | Per-check |
| **AWS CloudWatch** | Synthetics canary | Yes, via SNS | Pay-per-run |
| **Self-hosted (Uptime Kuma)** | Yes | Yes, via webhook | Free (self-hosted) |

## Application-level health JSON contract

`/health/ready` returns a JSON body with these fields (already implemented in
the Nest health controller):

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "mailQueue": { "queued": 12, "oldestPendingMs": 4500 },
    "backupWorker": { "lastRunAgoMs": 3600000, "lastStatus": "ok" }
  }
}
```

A separate "synthetic check" hitting this endpoint, parsing the JSON, and
emitting alerts is the recommended way to wire mail and backup signals.

## Dashboards

Minimum dashboards (provider monitoring UI + chosen logging tool):

1. **Liveness/readiness panel** — uptime % over 24 h and 7 d for all 5 probes.
2. **Backend latency** — p50/p95/p99 for `/api/*` (from Caddy logs).
3. **Auth panel** — login success/failure counts, refresh-token activity.
4. **Mail panel** — queued / processing / sent / dead counts; oldest pending age.
5. **Backup panel** — last success timestamp, last duration, last byte count.
6. **Droplet panel** — CPU, memory, disk, network in/out.

## Post-deploy verification

After each deploy to staging or production, run these verification scripts:

| Script | What it verifies | When to run |
| --- | --- | --- |
| `scripts/post-deploy-smoke.mjs` | Login pages render (admin/student/teacher) at desktop + mobile viewports, console errors, API destination routing | Immediately after deploy |
| `scripts/verify-deploy.sh` | Repo HEAD commit, Docker compose state, container health, running image revision label, HTTP health endpoints | On the Droplet after deploy |
| `scripts/doctor-local.mjs` | Frontend/backend reachability, DB/storage/mail probes, ready status | Local dev triage |
| `scripts/backend-doctor.mjs` | Prisma client, Docker state, PostgreSQL port, backend `/health/live` | Local dev triage |

**Note:** `post-deploy-smoke.mjs` is not wired into CI — it is designed for
manual execution on the target environment. See `scripts/verify-deploy.sh` for
full drift detection (compares running image commit label against
`EXPECTED_COMMIT`).

**Required environment variables for smoke scripts:**

| Variable | Used by | Purpose |
| --- | --- | --- |
| `SMOKE_TARGET_HOST` | `post-deploy-smoke.mjs` | Frontend base URL (default: `https://www.projtrack.codes`) |
| `SMOKE_EXPECTED_API_HOST` | `post-deploy-smoke.mjs` | Expected API backend host (default: `https://api.projtrack.codes`) |
| `EXPECTED_COMMIT` | `verify-deploy.sh` | Git SHA that must match repo HEAD and running image label |

## Request ID correlation

Every HTTP request is assigned a `requestId` (UUID) propagated via
`AsyncLocalStorage`, returned as the `X-Request-Id` response header, and
surfaced in structured log events (`request.complete`, `request.error`,
`client.error`). The request ID is also recorded in the `AuditLog` record
for every audited action (`requestId` field added via OPS2-005).

**During incident investigation**, use the request ID to trace:
1. HTTP request → audit log entry → affected resources
2. Frontend error report (`POST /monitoring/client-errors`) → backend logs
3. Structured log event → exact request context (actor, IP, session)

To query audit logs by request ID (via admin API or direct DB):

```sql
SELECT * FROM "AuditLog" WHERE "requestId" = '<request-uuid>' ORDER BY "createdAt";
```

## Related runbooks

| Runbook | Purpose |
| --- | --- |
| `docs/BACKUP_RESTORE_RUNBOOK.md` | Backup/restore procedures (in-app worker) |
| `docs/INCIDENT_RESPONSE.md` | SEV1-SEV4 severity matrix, containment scenarios |
| `docs/PRODUCTION_CHECK_FAILURE_RUNBOOK.md` | Triage for failed `production-checks.yml` runs |
| `docs/SECRET_LEAK_RESPONSE.md` | Credential exposure response |
| `docs/PRODUCTION_LAUNCH_RUNBOOK.md` | Pre-launch checklist including monitoring test alert |
| `docs/PRODUCTION_ROLLBACK_RUNBOOK.md` | Rollback triggers and verification steps |
| `PRODUCTION_READINESS_SCORECARD.md` | Scorecard tracking monitoring as `Blocked` until wired |
| `docs/PRODUCTION_ENVIRONMENT_CHECKLIST.md` | Required env vars including `MONITORING_DSN` |

## Manual verification (perform after wiring)

For each alert policy, force a test failure and confirm the alert fires
within the documented window. Capture the alert ID and timestamp in
`FINAL_READINESS_CHECKLIST.md` next to "Hosting-provider monitoring active".

## Status

### Production
Monitoring is **NOT wired**. This runbook is the prerequisite document.
Wiring a production monitoring provider is operator work (requires provider
console access, which the build automation does not have). Mark "monitoring
complete" only after every alert policy above is configured and at least one
alert per category has been test-fired successfully.

### Staging
Partial monitoring was configured during the 2026-05-03 release cycle
(see `docs/release-evidence/2026-05-03/08-monitoring.md`):
- DO Monitoring agent (`do-agent`) active
- 3 resource alert policies (CPU >70 %, Memory >90 %, Disk >85 %)
- 3 uptime checks (SPA, API live, API ready) from multiple regions
- Stress test validation (CPU peaked at 96.96 %)

**Known gaps on staging:** App-level alert policies (mail backlog, backup
staleness, auth failure rate) are not wired. Alert email delivery was not
confirmed. An incident drill has not been conducted.
