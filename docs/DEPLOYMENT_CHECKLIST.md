# Deployment Checklist

Use this checklist before every staging or production deployment.

## 1. Environment validation

- Frontend env values set and reviewed:
  - `VITE_USE_BACKEND=true`
  - `VITE_API_BASE_URL=https://api.projtrack.codes`
  - `VITE_PUBLIC_APP_URL=https://projtrack.codes`
- Backend env values set and reviewed:
  - `NODE_ENV=production`
  - `APP_ENV=production`
  - `APP_URL=https://projtrack.codes`
  - `FRONTEND_URL=https://projtrack.codes`
  - `BACKEND_URL=https://api.projtrack.codes`
  - `CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes`
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `ACCOUNT_ACTION_TOKEN_ENC_KEY`
- Mail and storage reviewed:
  - `MAIL_PROVIDER`
  - `MAILRELAY_API_KEY`
  - `MAILRELAY_API_URL`
  - `MAIL_WORKER_ENABLED`
  - `OBJECT_STORAGE_MODE`
  - `S3_BUCKET`
  - `S3_REGION`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`

## 2. Build and verification

- `npm run security:secrets`
- `npm run check:release-hygiene`
- `npm run typecheck`
- `npm run build`
- `npm --prefix backend run build`
- `npm --prefix backend run prisma:validate`
- `npm --prefix backend run test`
- `npm audit --audit-level=high`
- `npm --prefix backend audit --audit-level=high`

## 3. Smoke coverage

- Local/disposable environment:
  - `npm --prefix backend run smoke:local`
- Staging/real accounts:
  - `npm --prefix backend run smoke:real`
- Browser verification:
  - `npm run e2e:smoke`

## 4. Runtime readiness

- Admin health endpoints healthy:
  - `/health/database`
  - `/health/storage`
  - `/health/mail`
  - `/health/configuration`
- Frontend login tested for admin, teacher, and student
- ErrorBoundary fallback can report client errors
- Offline banner and network activity overlay verified in browser

## 5. Release decision

- Deployment and rollback steps reviewed in `docs/PRODUCTION_RELEASE_RUNBOOK.md`
- Backup and restore readiness reviewed in `docs/BACKUP_RUNBOOK.md`
- Mail relay runbook reviewed in `docs/MAILRELAY_RUNBOOK.md`
- Any skipped smoke checks documented in release notes
- CI status green before `git push`
