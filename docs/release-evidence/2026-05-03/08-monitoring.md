# 08 — DigitalOcean Monitoring

**Date:** 2026-05-03
**Configured by:** Ediwow110 (DO console, team ?i=969976)

## Monitoring agent

```
systemctl status do-agent  →  active (running)
Started: 2026-05-03 08:33:21 UTC
```

CPU metrics confirmed flowing to DO: Droplet Insights graph shows clear spike
to ~97% CPU during stress test runs at ~17:17–17:23 UTC.
"Monitoring Agent Enabled" badge shown in Insights view.

## Resource Alert policies

| Name | Metric | Rule | Duration | Droplet | Notification |
|---|---|---|---|---|---|
| CPU Utilization Percent is running high | CPU % | > 70% | 5 min | projtrack-staging-01 | edmarcipriano43@gmail.com |
| Memory Utilization Percent is running high | Memory % | > 90% | 5 min | projtrack-staging-01 | edmarcipriano43@gmail.com |
| Disk Utilization Percent is running high | Disk % | > 85% | 5 min | projtrack-staging-01 | edmarcipriano43@gmail.com |

## Stress test fire (CPU alert)

Three stress-ng runs completed using --cpu-method matrixprod (required for DO vCPU):

| Run | Peak CPU | Duration | Alert policies active? |
|---|---|---|---|
| 1 | 96.55% | 360 s | No (policies created after) |
| 2 | 96.76% | 360 s | No (policies created after) |
| 3 | 96.96% | 360 s | Yes |

**Known gap:** Alert email to edmarcipriano43@gmail.com not confirmed received after run 3.
CPU metrics confirmed flowing (Insights graph shows spike). Root cause: possible
DO first-alert initialization delay on GitHub-OAuth accounts. Metrics pipeline proven;
email delivery to be re-confirmed within 24 h.

## Uptime checks

| Name | URL | Regions | Status | Downtime alert |
|---|---|---|---|---|
| projtrack-staging-spa | https://staging.projtrack.codes/ | Asia East, USA East, USA West, Europe | Up (6 h) | staging-spa-downtime |
| projtrack-staging-api-live | https://api-staging.projtrack.codes/health/live | Asia East, USA East, USA West, Europe | Up (6 h) | staging-api-live-downtime |
| projtrack-staging-api-ready | https://api-staging.projtrack.codes/health/ready | Asia East, USA East, USA West, Europe | Up (6 h) | staging-api-ready-downtime |

All 3 downtime alerts: threshold 1 ms, wait 2 min, status Not Triggered.
Notification recipient: edmarcipriano43@gmail.com.
