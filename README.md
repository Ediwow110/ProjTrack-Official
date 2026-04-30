
# PROJTRACK

PROJTRACK uses a React frontend and a NestJS + Prisma backend backed by PostgreSQL.

## Local setup

1. Install frontend dependencies with `npm ci`
2. Install backend dependencies with `npm --prefix backend ci`
3. Copy and review the env files:
   - frontend: `.env.example`
   - backend: `backend/.env.example`
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
- seeds reference data and demo accounts
- starts detached backend and frontend processes with logs in `.local-runtime/`

Local demo sign-in accounts:
- Admin: `admin@projtrack.local` / `Admin123!ChangeMe`
- Teacher: `teacher@projtrack.local` / `Teacher123!ChangeMe`
- Student: `student@projtrack.local` or `STU-2024-00142` / `Student123!ChangeMe`

## Build validation

- Frontend typecheck: `npm run typecheck`
- Frontend production build: `npm run build`
- Backend build: `npm --prefix backend run build`
- Backend smoke suite: `npm --prefix backend run smoke`
- Browser auth smoke suite: `npm run e2e:smoke`

## Runtime notes

- Frontend backend mode is environment-driven via `VITE_USE_BACKEND`.
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
- Demo seed data is opt-in via `ALLOW_DEMO_SEED=true`.
- Playwright uses bundled Chromium by default. Set `PLAYWRIGHT_BROWSER_CHANNEL` only if you intentionally want a system browser such as Edge.
- Role-based login identifiers:
  - Student: student number or email
  - Teacher: employee ID or email
  - Admin: email

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
- Full deployment and cutover steps are documented in [docs/production-readiness-checklist.md](/docs/production-readiness-checklist.md).
  
