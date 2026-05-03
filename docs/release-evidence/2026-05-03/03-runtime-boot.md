# 03 — Runtime Boot

**Date:** 2026-05-03  
**Source:** docker compose logs --tail=50 backend

## Key log lines (captured ~6:18–6:20 PM local / 10:18–10:20 UTC)

```
[MailTransportService] Mailrelay mail provider ready: Mailrelay provider is configured for
  https://projtrack.ipzmarketing.com/api/v1/send_emails.

[Nest] 7 - 05/03/2026, 6:18:11 PM  LOG [HTTP] {"event":"request.complete",
  "path":"/health","statusCode":200,"durationMs":1.25,"ipAddress":"::ffff:127.0.0.1"}

[Nest] 7 - 05/03/2026, 6:18:26 PM  LOG [HTTP] {"event":"request.complete",
  "path":"/health/ready","statusCode":200,"durationMs":101.5,"ipAddress":"45.55.238.127"}

[Nest] 7 - 05/03/2026, 6:18:28 PM  LOG [HTTP] {"event":"request.complete",
  "path":"/health/live","statusCode":200,"durationMs":0.83,"ipAddress":"143.198.30.208"}

[Nest] 7 - 05/03/2026, 6:19:45 PM  LOG [MailTransportService] Mailrelay mail provider ready

[Nest] 7 - 05/03/2026, 6:19:46 PM  LOG [HTTP] {"event":"request.complete",
  "path":"/health/ready","statusCode":200,"durationMs":85.17,"ipAddress":"178.128.68.58"}

[Nest] 7 - 05/03/2026, 6:20:11 PM  LOG [HTTP] {"event":"request.complete",
  "path":"/health","statusCode":200,"durationMs":1.32,"ipAddress":"::ffff:127.0.0.1"}
```

## Summary

- NestJS application started successfully (Nest] 7 — worker PID 7)
- Mailrelay transport provider initialised on boot
- /health/live: 200 consistently (~0.83–1.07 ms)
- /health/ready: 200 consistently (~85–101 ms, includes DB + storage checks)
- HEAD / → 404 Not Found: expected — Caddy liveness probe hits API root which has no registered route
- Requests arriving from DO Uptime check source IPs (45.55.x, 143.198.x, 104.248.x, 178.128.x)
