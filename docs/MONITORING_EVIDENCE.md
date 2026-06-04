# Monitoring Evidence

> **Note:** This document reflects the **production** monitoring state. For
> **staging** evidence from the 2026-05-03 release cycle, see
> `docs/release-evidence/2026-05-03/08-monitoring.md`.

Capture proof that production operators can detect and respond to failures before launch.

## Status

**BLOCKED (Production)** — No production monitoring provider is configured. No
DigitalOcean Droplet or production environment is provisioned. Health endpoints
cannot be called against a live production server.

**PARTIAL (Staging)** — Staging had partial monitoring configured during the
2026-05-03 release cycle (see `docs/release-evidence/2026-05-03/08-monitoring.md`):
DO Monitoring agent active, 3 resource alert policies, 3 uptime checks.
App-level alerts not wired.

## Blocker Details

- No production DigitalOcean Uptime checks are configured.
- No production alert policies are wired.
- Backend health endpoints (`/health/live`, `/health/ready`) are implemented
  in the NestJS health module but cannot be verified without a running
  production server accessible over the network.
- The full alert policy list and configuration steps are in `MONITORING_RUNBOOK.md`
  (root of the repository).

## Next Actions (in order)

1. Provision DigitalOcean Droplet and deploy backend (see `DEPLOY_DIGITALOCEAN.md`).
2. Confirm `GET /health/live` returns HTTP 200.
3. Confirm `GET /health/ready` returns HTTP 200 with a JSON body containing `database`, `mailQueue`, and `backupWorker` fields.
4. Set up DigitalOcean Uptime checks for all 5 probe targets in `MONITORING_RUNBOOK.md`.
5. Create alert policies for every row in the alert table in `MONITORING_RUNBOOK.md`.
6. Test-fire at least one alert per category and record the alert ID and timestamp.
7. Fill in the evidence below with real results.
8. Update `docs/PRODUCTION_READINESS_SCORECARD.md` category 9 from `Blocked` to `Partial` or `Pass`.

## Health And Availability

- Frontend uptime check configured: _not yet_
- Backend `/health/live` check configured: _not yet_
- Backend `/health/ready` check configured: _not yet_
- Alert destination: _not yet configured_
- On-call owner: _TBD_

## Required Alerts

- API unavailable for 5 minutes: _not yet configured_
- Readiness failure for 5 minutes: _not yet configured_
- Database unreachable: _not yet configured_
- Mail worker heartbeat stale: _not yet configured_
- Backup worker heartbeat stale: _not yet configured_
- Backup failure or missing recent backup: _not yet configured_
- High 5xx rate: _not yet configured_
- Authentication failure spike: _not yet configured_
- File upload rejection spike: _not yet configured_

## Evidence

- Alert test date: _not yet run_
- Alert test method: _not yet run_
- Screenshot or alert link: _not yet run_
- Notification received by: _not yet run_
- Time to detection: _not yet run_
- Time to acknowledgement: _not yet run_
- Gaps found: _not yet run_
- Follow-up owner: _TBD_
