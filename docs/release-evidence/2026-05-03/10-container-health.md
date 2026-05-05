# 10 — Container Health

**Date:** 2026-05-03  
**Command:** docker compose ps (from /opt/projtrack)

## Output

```
NAME                            IMAGE                       STATUS
projtrack-staging-backend       projtrack/backend:staging   Up About an hour (healthy)
projtrack-staging-backup-worker projtrack/backend:staging   Restarting (0) 5 seconds ago
projtrack-staging-clamav        clamav/clamav:latest        Up About an hour (healthy)
projtrack-staging-mail-worker   projtrack/backend:staging   Up About an hour (unhealthy)

PORTS
backend:       127.0.0.1:3002->3001/tcp
backup-worker: —
clamav:        3310/tcp, 7357/tcp
mail-worker:   3001/tcp
```

## Assessment

| Container | Status | Notes |
|---|---|---|
| backend | **healthy** | /health/live and /health/ready both return 200 |
| clamav | **healthy** | ClamAV daemon responding on port 3310 |
| backup-worker | Restarting | BACKUP_WORKER_ENABLED=false — cosmetic restart loop, non-blocking |
| mail-worker | unhealthy | Docker healthcheck misconfigured; Mailrelay connection confirmed via backend logs ("Mailrelay provider is configured for https://projtrack.ipzmarketing.com/api/v1/send_emails") |

mail-worker Docker healthcheck reports unhealthy but mail transport is functional.
/health/ready endpoint returns 200 with all checks true including mail.
Fixing the mail-worker healthcheck probe is a post-staging polish item.
