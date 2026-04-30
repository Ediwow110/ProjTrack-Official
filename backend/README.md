# PROJTRACK Backend

The backend runtime is Prisma/PostgreSQL-first and requires a reachable `DATABASE_URL` at startup.

## Current runtime state

- Auth, profiles, subjects, submissions, notifications, reports, and most admin flows are served from Prisma-backed repositories.
- Login is verified for seeded admin, teacher, and student accounts.
- Public health endpoints now expose only liveness/readiness:
  - `/health/live`
  - `/health/ready`
- Detailed admin-only diagnostics remain available behind auth:
  - `/health/database`
  - `/health/storage`
  - `/health/mail`
  - `/health/configuration`
- Input validation is enabled globally through Nest `ValidationPipe`.
- Password setup/reset/change flows enforce a stronger password policy.
- Structured request logging and `X-Request-Id` correlation are enabled.
- Production boot now fails fast when insecure defaults are still configured.

## Local setup

1. Copy `backend/.env.example` to `backend/.env`
2. Install dependencies with `npm ci`
3. Generate Prisma client with `npm run prisma:generate`
4. Run the server with `npm run dev`

Useful commands:

- `npm run build`
- `npm run smoke`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `ALLOW_DEMO_SEED=true npm run seed`

## Current release blockers

- Prisma migration history is now established locally. Deploys should use `npm run prisma:migrate:deploy` before seeding or starting the app.
- File storage now supports local mode for development and S3-compatible object storage for production. Local mode may pass `/health/storage` outside production when writable; production readiness still requires S3-compatible object storage.
- Production mail should use `MAIL_PROVIDER=mailrelay` with:
  - `MAIL_FROM_ADMIN=admin@projtrack.codes`
  - `MAIL_FROM_NOREPLY=support@projtrack.codes`
  - `MAIL_FROM_INVITE=support@projtrack.codes`
  - `MAIL_FROM_NOTIFY=notification@projtrack.codes`
  - `MAIL_FROM_SUPPORT=support@projtrack.codes`
- Rotate and replace any exposed Mailrelay, Sender.net, JWT, database, or object storage secrets before shipping.
- Never upload or share `backend/.env` again.
- Some admin system tools intentionally remain restricted in production because they write local artifacts or perform destructive maintenance actions.
- Browser E2E smoke coverage is now present and wired into CI, but it still needs to stay green in a real CI/staging browser environment.

## Seeded local accounts

- Demo users are only created when `ALLOW_DEMO_SEED=true`.
- `admin@projtrack.local / Admin123!ChangeMe`
- `teacher@projtrack.local / Teacher123!ChangeMe`
- `student@projtrack.local / Student123!ChangeMe`
