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
npm audit --omit=dev
```

Expected backend audit status is documented in `PRODUCTION_READINESS.md`.

## Health Checks

After deployment:

```http
GET /health/live
GET /health/ready
```

Admin-only checks:

```http
GET /health/database
GET /health/storage
GET /health/mail
GET /health/backups
GET /health/configuration
```

Mail Jobs operator check:

- worker heartbeat is fresh
- queue depth is expected
- `queuedTooLongCount` is zero
- `processingTooLongCount` is zero
- latest provider error is understood before retrying or archiving jobs

Do not ship `.env`, logs, `node_modules`, `.local-runtime`, `backend/uploads`, or `backend/data/system-tools/backups` inside the production package.
