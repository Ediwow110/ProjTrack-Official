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
CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes
DATABASE_URL=<production-postgres-url>
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
ALLOW_DEMO_SEED=false
```

## Mail

```env
MAIL_PROVIDER=mailrelay
MAIL_FROM_NAME=PROJTRACK
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
TESTMAIL_ENABLED=false
MAILRELAY_API_KEY=<mailrelay-api-key>
MAILRELAY_API_URL=<mailrelay-api-url>
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

## Optional Backup

```env
BACKUP_ENABLED=false
BACKUP_PROVIDER=google_drive
BACKUP_SCHEDULE_CRON=0 2 * * *
GOOGLE_DRIVE_BACKUP_FOLDER_ID=<folder-id>
GOOGLE_DRIVE_CLIENT_EMAIL=<service-account-email>
GOOGLE_DRIVE_PRIVATE_KEY=<service-account-private-key>
```

## Warning

Do not commit real values. Do not upload or share `backend/.env`. Rotate Mailrelay, Sender.net, JWT, database, and object-storage secrets if they were ever exposed outside the production secret manager.
