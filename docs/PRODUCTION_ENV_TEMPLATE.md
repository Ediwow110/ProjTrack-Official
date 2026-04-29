# PROJTRACK Production Environment Template

Use placeholders only in committed documentation. Set real values directly in the hosting provider secret manager or environment settings.

## Frontend

```env
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://api.projtrack.codes
```

## Backend

```env
NODE_ENV=production
APP_ENV=production
APP_URL=https://projtrack.codes
FRONTEND_URL=https://projtrack.codes
CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes
DATABASE_URL=<production-postgres-url>
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
ALLOW_DEMO_SEED=false
```

## Mail

```env
MAIL_PROVIDER=mailrelay
MAIL_FROM_NAME=ProjTrack
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
TESTMAIL_ENABLED=false
MAILRELAY_API_KEY=<mailrelay-api-key>
MAILRELAY_API_URL=https://projtrack.ipzmarketing.com/api/v1
```

## Processes

Run the API process with HTTP enabled and workers disabled:

```bash
cd backend
MAIL_WORKER_ENABLED=false BACKUP_WORKER_ENABLED=false npm run start:prod
```

Run one dedicated worker process against the same production `DATABASE_URL`:

```bash
cd backend
MAIL_WORKER_ENABLED=true BACKUP_WORKER_ENABLED=true npm run start:worker
```

Deploy migrations before starting the API or worker:

```bash
cd backend
npm run prisma:migrate:deploy
```

Do not set these in production:

```env
TESTMAIL_API_KEY=
TEST_EMAIL_ACTIVATION=
TEST_EMAIL_PASSWORD_RESET=
TEST_EMAIL_INVITE=
TEST_EMAIL_NOTIFICATION=
```

## Storage

```env
OBJECT_STORAGE_MODE=s3
S3_BUCKET=<bucket>
S3_REGION=<region>
S3_ENDPOINT=<provider-endpoint-if-needed>
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
S3_FORCE_PATH_STYLE=<true-or-false>
```

## Backup

```env
BACKUP_LOCAL_DIR=data/system-tools/backups
BACKUP_WORKER_ENABLED=false
BACKUP_SCHEDULE_ENABLED=false
BACKUP_DEFAULT_FREQUENCY=daily
BACKUP_DEFAULT_TIME=02:00
BACKUP_TIMEZONE=Asia/Manila
BACKUP_RETENTION_DAYS=30
BACKUP_RETENTION_COUNT=10
BACKUP_WORKER_POLL_MS=60000
BACKUP_STORAGE_PROVIDER=local
```

Keep `BACKUP_WORKER_ENABLED=false` in the API process. Run exactly one dedicated backup worker with `BACKUP_WORKER_ENABLED=true` when automatic backups are enabled in Admin -> Backups.

## Warning

Do not commit real values. Do not upload or share `backend/.env`. Rotate Mailrelay, Sender.net, JWT, database, and object-storage secrets if they were ever exposed outside the production secret manager.
