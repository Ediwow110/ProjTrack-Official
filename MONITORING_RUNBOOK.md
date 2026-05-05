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

## DigitalOcean configuration steps

1. **Project → Monitoring → Add metrics agent** to the Droplet (auto-installs `do-agent`).
2. **Monitoring → Uptime** → create the 5 probes above.
3. **Monitoring → Alert policies** → create one policy per row in the table above.
   For application-level signals (mail backlog, backup staleness, auth failure
   rate) wire them via webhook from the backend's `/health/ready` JSON payload
   into a Better Uptime / OpsGenie / Slack webhook of your choice — DO does
   not natively understand the JSON contents.
4. **Notification channels** → at minimum: an email distribution list and one
   chat channel (Slack/Discord/etc.).
5. **Spaces metrics** → enable per-bucket logging on `projtrack-prod-uploads`
   and `projtrack-prod-backups`.

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

Minimum dashboards (DO Monitoring + chosen logging tool):

1. **Liveness/readiness panel** — uptime % over 24 h and 7 d for all 5 probes.
2. **Backend latency** — p50/p95/p99 for `/api/*` (from Caddy logs).
3. **Auth panel** — login success/failure counts, refresh-token activity.
4. **Mail panel** — queued / processing / sent / dead counts; oldest pending age.
5. **Backup panel** — last success timestamp, last duration, last byte count.
6. **Droplet panel** — CPU, memory, disk, network in/out.

## Manual verification (perform after wiring)

For each alert policy, force a test failure and confirm the alert fires
within the documented window. Capture the alert ID and timestamp in
`FINAL_READINESS_CHECKLIST.md` next to "Hosting-provider monitoring active".

## Status

Monitoring is **NOT yet wired**. This runbook is the prerequisite document.
Wiring requires DigitalOcean console access, which the build automation
deliberately does not have. Mark "monitoring complete" only after every alert
policy above is configured and at least one alert per category has been
test-fired successfully.
