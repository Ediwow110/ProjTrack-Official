# Production Environment Checklist

Do not place real secrets in this document. Store real values in the approved secret manager.

| Variable | Required | Environment | Safety Rule | Example Format | Failure Mode If Wrong |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | staging, production, test | Must point to the intended PostgreSQL database; production cannot use localhost or SQLite | `postgresql://user:password@db.example.com:5432/projtrack?schema=public` | API boot failure, migration failure, or data written to wrong DB |
| `DIRECT_URL` | Optional unless provider requires it | staging, production | Use only if Prisma/provider requires a direct migration URL; keep secret | `postgresql://user:password@db-direct.example.com:5432/projtrack?schema=public` | Migration connection failure |
| `JWT_ACCESS_SECRET` | Required | staging, production, test | Long random value, not shared with refresh secret, rotate on exposure | `<64+ random chars>` | Token forgery risk or boot validation failure |
| `JWT_REFRESH_SECRET` | Required | staging, production, test | Long random value, distinct from access secret | `<64+ random chars>` | Refresh token forgery risk or boot validation failure |
| `JWT_ISSUER` | Required | production | Stable issuer string | `projtrack-api` | Token validation/key rotation ambiguity |
| `JWT_AUDIENCE` | Required | production | Stable frontend audience string | `projtrack-web` | Token validation ambiguity |
| `JWT_KEY_ID` | Required | production | Unique key ID per rotation | `prod-2026-05` | Rotation traceability gap |
| `ACCOUNT_ACTION_TOKEN_ENC_KEY` | Required | staging, production | 32-byte base64 or 64-char hex | `MDEyMz...` | Account activation/reset token failure |
| `AUTH_REFRESH_COOKIE_NAME` | Required | staging, production | Production must start with `__Secure-` or `__Host-` | `__Secure-projtrack_refresh` | Boot validation failure or weaker cookie posture |
| `AUTH_REFRESH_COOKIE_SAME_SITE` | Required | staging, production | Production must be `lax` or `strict`; never `none` | `lax` | Boot validation failure or refresh CSRF risk |
| `APP_URL` | Required | staging, production | HTTPS public frontend URL | `https://www.projtrack.codes` | Broken generated links |
| `FRONTEND_URL` | Required | staging, production | HTTPS public frontend URL | `https://www.projtrack.codes` | Broken CORS/link generation |
| `BACKEND_URL` | Required | staging, production | HTTPS public API URL | `https://api.projtrack.codes` | Broken CSP/connectivity diagnostics |
| `CORS_ORIGINS` | Required | staging, production | HTTPS origins only; no localhost in production | `https://www.projtrack.codes,https://projtrack.codes` | Browser auth/API failure or unsafe CORS |
| `TRUST_PROXY` | Required | production | Must be `true` behind reverse proxy | `true` | Incorrect client IP, secure cookie, and rate-limit behavior |
| `TRUST_PROXY_HOPS` | Required when proxy enabled | production | Match proxy chain length | `1` | Spoofed or incorrect client IP handling |
| `OBJECT_STORAGE_MODE` | Required | staging, production | Must be `s3` in production | `s3` | Boot validation failure or local-only uploads |
| `S3_ENDPOINT` | Required for S3-compatible providers | staging, production | HTTPS endpoint; no localhost in production | `https://s3.ap-southeast-1.amazonaws.com` | Storage client failure |
| `S3_REGION` | Required | staging, production | Match bucket region | `ap-southeast-1` | Signed URL/storage failure |
| `S3_BUCKET` | Required | staging, production | Private bucket only | `projtrack-private-prod` | Upload/download failure or public data exposure |
| `S3_ACCESS_KEY_ID` | Required | staging, production | Secret manager only | `<access-key-id>` | Storage auth failure |
| `S3_SECRET_ACCESS_KEY` | Required | staging, production | Secret manager only, rotate on exposure | `<secret-access-key>` | Storage auth failure or data exposure |
| `S3_FORCE_PATH_STYLE` | Optional | staging, production | Use only when provider requires path-style URLs | `false` | S3-compatible endpoint failures |
| `S3_SIGNED_URL_TTL_SECONDS` | Required | staging, production | Between 30 and 900 seconds | `300` | Boot validation failure or long-lived signed URLs |
| `S3_BUCKET_PUBLIC` | Required | staging, production | Must be `false` | `false` | Boot validation failure or public file exposure |
| `MAIL_PROVIDER` | Required | staging, production | Production requires `mailrelay` | `mailrelay` | Boot validation failure or no real email |
| `MAIL_FROM_NAME` | Required | staging, production | Approved brand sender name | `ProjTrack` | Mail validation failure |
| `MAIL_FROM_ADMIN` | Required | staging, production | Confirmed Mailrelay sender | `admin@projtrack.codes` | Provider rejection |
| `MAIL_FROM_NOREPLY` | Required | staging, production | Confirmed support sender per project policy | `support@projtrack.codes` | Activation/reset mail failure |
| `MAIL_FROM_INVITE` | Required | staging, production | Confirmed support sender | `support@projtrack.codes` | Invite mail failure |
| `MAIL_FROM_NOTIFY` | Required | staging, production | Confirmed notification sender | `notification@projtrack.codes` | Notification mail failure |
| `MAIL_FROM_SUPPORT` | Required | staging, production | Confirmed support sender | `support@projtrack.codes` | Account support mail failure |
| `MAILRELAY_API_KEY` | Required | staging, production | Secret manager only, rotate on exposure | `<mailrelay-api-key>` | Mail delivery failure |
| `MAILRELAY_API_URL` | Required | staging, production | HTTPS Mailrelay API URL | `https://projtrack.ipzmarketing.com/api/v1` | Mail delivery failure |
| `MAIL_WORKER_ENABLED` | Required | staging, production | `false` in API process, `true` in exactly one mail worker | `false` or `true` | Duplicate workers or stuck mail queue |
| `MAIL_WORKER_POLL_MS` | Required | staging, production | Number >= 1000 | `60000` | Boot validation failure or excessive polling |
| `FILE_MALWARE_SCAN_MODE` | Required | staging, production | Production must be `fail-closed` | `fail-closed` | Boot validation failure or unsafe uploads |
| `FILE_MALWARE_SCANNER` | Required | staging, production | Production must be `clamav` until another adapter exists | `clamav` | Boot validation failure |
| `CLAMAV_HOST` | Required | staging, production | Reachable from API and worker network | `clamav` | Uploads fail closed |
| `CLAMAV_PORT` | Required | staging, production | Numeric ClamAV port | `3310` | Uploads fail closed |
| `BACKUP_WORKER_ENABLED` | Required | staging, production | `false` in API/mail worker, `true` in one backup worker | `true` | Backups do not run |
| `BACKUP_SCHEDULE_ENABLED` | Required | staging, production | `true` only where automatic backups should run | `true` | Backups do not run or run in wrong process |
| `BACKUP_LOCAL_DIR` | Required if local backup storage used | staging, production | Must be durable mounted volume if local; prefer off-host provider | `data/system-tools/backups` | Backup loss with host loss |
| `BACKUP_STORAGE_PROVIDER` | Required | staging, production | Must match approved durable backup design | `local` or approved future provider | Backup not durable |
| `BACKUP_ENCRYPTION_KEY` | Required if backup encryption is enabled by provider/process | staging, production | Secret manager only | `<backup-encryption-key>` | Restore failure or unencrypted backups |
| `BACKUP_RETENTION_DAYS` | Required | staging, production | Match policy | `30` | Data retention compliance risk |
| `BACKUP_RETENTION_COUNT` | Required | staging, production | Match policy | `10` | Storage growth or insufficient recovery points |
| `HTTP_RATE_LIMIT_STORE` | Required | staging, production | Production must be `database`, `redis`, or `gateway`; not `memory` | `database` | Boot validation failure or per-instance rate-limit bypass |
| `VITE_USE_BACKEND` | Required for frontend build | staging, production | Must be `true` | `true` | Frontend may use mock/local behavior |
| `VITE_API_BASE_URL` | Required for frontend build | staging, production | HTTPS public API URL; no localhost | `https://api.projtrack.codes` | Production build validation failure or broken API calls |
| `VITE_PUBLIC_APP_URL` | Required for frontend build | staging, production | HTTPS public frontend URL | `https://www.projtrack.codes` | Link/share/canonical URL issues |
| `LOG_LEVEL` | Optional | staging, production | Do not log tokens or secrets | `info` | Missing diagnostics or noisy logs |
| `MONITORING_DSN` | Required if monitoring provider is enabled | staging, production | Secret manager only | `<monitoring-dsn>` | No production error telemetry |
| `SMOKE_ADMIN_IDENTIFIER` | Required for staging smoke | staging, test | Staging/test account only; never production admin password | `admin.smoke@example.test` | Smoke preflight fails |
| `SMOKE_ADMIN_PASSWORD` | Required for staging smoke | staging, test | Secret manager/GitHub secret only | `<staging-only-password>` | Smoke preflight fails |

