# PROJTRACK

PROJTRACK uses a React frontend and a NestJS + Prisma backend backed by PostgreSQL.

## Local setup

1. Install frontend dependencies with `npm ci`
2. Install backend dependencies with `npm --prefix backend ci`
3. Copy and review the env files:
   - frontend local template: `.env.example`
   - backend local template: `backend/.env.local.example`
   - backend production template: `backend/.env.production.example`
4. Run `npm start`

Frontend only: `npm run dev`
Backend only: `npm --prefix backend run dev`
Direct backend console: `npm run backend:local`
Direct frontend console: `npm run frontend:local`
Backend one-shot server: `npm --prefix backend run serve:local`
Bootstrap infra only: `npm run prepare:local`
Health check your local stack: `npm run doctor:local`
Portable Node launcher: `npm run start:portable`
Stop local app servers: `npm run stop:local`

Production-like local infrastructure: `npm --prefix backend run infra:up`

On Windows, `npm start` now uses native `.cmd` launchers for a more reliable local boot sequence. It does the following:
- starts PostgreSQL and MinIO
- waits for both services to accept connections
- runs `prisma generate`
- runs `prisma migrate deploy`
- starts detached backend and frontend processes with logs in `.local-runtime/`

## Build validation

- Frontend typecheck: `npm run typecheck`
- Frontend production build: `npm run build`
- Backend build: `npm --prefix backend run build`
- Backend smoke suite: `npm --prefix backend run smoke`
- Backend smoke suite (local mutation-safe): `npm --prefix backend run smoke:local`
- Backend smoke suite (real accounts, non-destructive): `npm --prefix backend run smoke:real`
- Browser auth smoke suite: `npm run e2e:smoke`

## Smoke modes

- `npm --prefix backend run smoke:local` is intended for local or disposable environments. It exercises forgot-password persistence, admin profile updates, avatar uploads, and storage roundtrips.
- `npm --prefix backend run smoke:real` is intended for staging or production-like environments with real accounts. It verifies health, login, refresh, logout, and throttling while skipping destructive checks.
- Real-account smoke credentials can use either `SMOKE_*_IDENTIFIER` or `SMOKE_*_EMAIL`, plus the matching `SMOKE_*_PASSWORD`.
- The full Phase 7 operator prompt lives in [PHASE7_SMOKE_REAL_ACCOUNTS_PROMPT.md](/PHASE7_SMOKE_REAL_ACCOUNTS_PROMPT.md).

## Runtime notes

- Frontend backend mode is environment-driven via `VITE_USE_BACKEND`.
- Frontend runtime UX and monitoring toggles are documented in `.env.example` via `VITE_ENABLE_CLIENT_ERROR_REPORTING`, `VITE_ENABLE_OFFLINE_BANNER`, `VITE_ENABLE_NETWORK_OVERLAY`, and `VITE_ENABLE_REAL_ACCOUNT_SMOKE_DOCS`.
- Frontend API URL building now trims malformed whitespace and normalizes the final backend URL before each request.
- Backend startup requires `DATABASE_URL`.
- Backend startup now fails fast in production if weak/default secrets, stub mail, or local file storage are still configured.
- Public health endpoints:
  - `/health/live`
  - `/health/ready`
- Admin-only diagnostic health endpoints:
  - `/health/database`
  - `/health/storage`
  - `/health/mail`
  - `/health/configuration`
- Automatic demo account/data seeding is disabled by default.
- Playwright uses bundled Chromium by default. Set `PLAYWRIGHT_BROWSER_CHANNEL` only if you intentionally want a system browser such as Edge.
- Role-based login identifiers:
  - Student: student number or email
  - Teacher: employee ID or email
  - Admin: email
- Role access expectations are documented in [docs/ROLE_ACCESS_RULES.md](/docs/ROLE_ACCESS_RULES.md).

## Production safety notes

- Never commit or share `backend/.env`.
- Rotate the Mailrelay API key immediately if it was ever exposed.
- Rotate the Sender.net API key immediately if it was ever exposed.
- Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` immediately if they were ever exposed.
- Rotate S3 or object storage access keys immediately if they were ever exposed.
- Production should use:
  - `NODE_ENV=production`
  - `APP_ENV=production`
  - `APP_URL=https://projtrack.codes`
  - `CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes`
  - `VITE_API_BASE_URL=https://api.projtrack.codes`
- Full deployment and cutover steps are documented in [docs/PRODUCTION_RELEASE_RUNBOOK.md](/docs/PRODUCTION_RELEASE_RUNBOOK.md), [docs/production-readiness-checklist.md](/docs/production-readiness-checklist.md), [docs/DEPLOYMENT_CHECKLIST.md](/docs/DEPLOYMENT_CHECKLIST.md), and [docs/ROLE_ACCESS_RULES.md](/docs/ROLE_ACCESS_RULES.md).

## Backend local startup troubleshooting

The backend was previously easy to start with the wrong environment: copied production-like values could leave it pointing at `localhost:5432` without a running database, or could enable the mail worker inside the HTTP process. That usually showed up as repeated Prisma errors such as `Can't reach database server at localhost:5432` or a Windows process exit like `3221225477`.

Use this local sequence instead:

1. Start Docker Desktop.
2. Run `npm install` and `npm --prefix backend install` if dependencies are missing.
3. Run `npm run prepare:local` to start PostgreSQL/MinIO, generate Prisma, and migrate.
4. Run `npm run backend:local` for the backend only, or `npm start` for backend + frontend.
5. Run `npm run backend:doctor` when startup still fails.

The local launch scripts now inject safe development defaults: local PostgreSQL, stub mail, local file storage, disabled mail worker, and non-production JWT secrets. This avoids accidentally using production-style env values during development. Production deploys must still use real secrets and the production checklist.
