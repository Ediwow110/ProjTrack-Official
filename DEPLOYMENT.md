# ProjTrack Deployment

## Web Backend

Use separate web and worker processes in production.

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run backfill:subject-sections
npm run backfill:submission-events
npm run build
node dist/main.js
```

Required web environment:

```bash
NODE_ENV=production
APP_ENV=production
APP_URL=https://www.projtrack.codes
CORS_ORIGINS=https://www.projtrack.codes,https://projtrack.codes
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/projtrack
JWT_ACCESS_SECRET=replace-with-long-random-secret
JWT_REFRESH_SECRET=replace-with-long-random-secret
MAIL_PROVIDER=mailrelay
MAILRELAY_API_URL=https://your-mailrelay-api.example
MAILRELAY_API_KEY=replace-with-mailrelay-key
MAIL_FROM_NAME=ProjTrack
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
TESTMAIL_ENABLED=false
MAIL_WORKER_ENABLED=false
BACKUP_WORKER_ENABLED=false
MAIL_QUEUE_WARNING_MS=300000
MAIL_PROCESSING_WARNING_MS=300000
MAIL_PROCESSING_STALE_MS=600000
TRUST_PROXY=true
TRUST_PROXY_HOPS=1
```

`TRUST_PROXY=true` should only be set when the app is behind a trusted reverse proxy that overwrites forwarding headers.

## Worker Process

Run a separate worker using the same build artifact:

```bash
cd backend
MAIL_WORKER_ENABLED=true BACKUP_WORKER_ENABLED=true npm run start:worker
```

The worker entrypoint uses the Nest application context and does not open an HTTP listener. Only one mail worker and one backup worker should be active in production.

Mail job lifecycle expectations in production:

- `QUEUED` should remain temporary and means the worker has not processed the job yet.
- `PROCESSING` should remain temporary and means the worker claimed the job.
- `SENT` means Mailrelay accepted the message.
- `DEAD` means the job is non-retryable or exhausted the retry budget.

Old sent/dead jobs should be archived from the admin page instead of deleted.

If Mailrelay jobs stay `QUEUED`, verify the worker process is running, its `DATABASE_URL` matches the web backend, `MAIL_PROVIDER=mailrelay`, `MAIL_WORKER_ENABLED=true`, and the job `nextTryAt` is `null` or due.

If Mailrelay jobs move to failed/dead with `SENDER_NOT_CONFIRMED`, the queue and worker are functioning. Confirm the From address shown in Admin -> Mail Jobs in Mailrelay, or temporarily point all `MAIL_FROM_*` values at `admin@projtrack.codes` until `support@projtrack.codes` and `notification@projtrack.codes` are confirmed.

## Frontend

```bash
npm ci
npm run typecheck
npm run build
```

Deploy `dist/` behind HTTPS. Set:

```bash
VITE_API_BASE_URL=https://www.projtrack.codes
```

Public login routing:

- `/`, `/login`, and `/portals` redirect to `/student/login`.
- `/teacher/login` and `/admin/login` remain direct URL entry points for staff/admin distribution.
- Hidden URLs are not a security boundary; protected frontend routes, `JwtAuthGuard`, role guards, and backend authorization are the enforcement layer.

## Verification

```bash
npm run typecheck
npm run build
npm run check:click-targets
npm audit --omit=dev

cd backend
npx prisma validate
npx prisma generate
npm run backfill:subject-sections
npm run backfill:submission-events
npm run build
npm test
npm run test:unit
npm run check:runtime:prod        # Phase B: boots dist/main.js under NODE_ENV=production
npm run smoke:worker              # Phase B: boots dist/worker.js with mail+backup workers enabled
npm audit --omit=dev
```

The two Phase B scripts run in CI on every push (see `.github/workflows/ci.yml`, backend job).

Expected backend audit status is documented in `SECURITY_NOTES.md`.

## Health Checks

After deployment:

```http
GET /health/live
GET /health/ready
```

Monitoring should alert when:

| Signal | Threshold |
| --- | --- |
| `/health/live` 5xx or unreachable | any (page) |
| `/health/ready` not 200 for 5 min | warning |
| 5xx rate over 5-minute window | > 1% (warning), > 5% (page) |
| auth failure rate over 10-minute window | > 20% of attempts |
| mail-job `QUEUED` count | > 100 sustained 10 min |
| mail-job oldest pending | > `MAIL_PROCESSING_STALE_MS` |
| backup worker last successful run | > 25 hours ago |
| disposable disk usage | > 80% |
| DB unreachable from `/health/ready` | any (page) |

Alert ownership and escalation paths are recorded in `PRODUCTION_READINESS_AUDIT.md` § Monitoring.

## Phase B Operator Workflows (manual / staged)

These are honest manual workflows. They do **not** run in CI by default.

### Staging smoke (real accounts)

```bash
cd backend
SMOKE_ADMIN_EMAIL=...               \
SMOKE_ADMIN_PASSWORD=...            \
DATABASE_URL=postgresql://...staging... \
npm run smoke:staging:summary
```

The wrapper refuses to run when `DATABASE_URL` looks like production.

### Backup / restore drill (disposable target only)

```bash
BACKUP_DRILL_SOURCE_DATABASE_URL=postgresql://...staging... \
BACKUP_DRILL_TARGET_DATABASE_URL=postgresql://...drill-disposable... \
BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND \
node backend/scripts/backup-restore-drill.mjs
```

The script refuses to run unless the target URL contains a disposable hint
(`disposable`, `drill`, `scratch`, `throwaway`, `tmp`, `temp`, `test`) and
does not match any production pattern, and unless the explicit confirmation
env var is set.
