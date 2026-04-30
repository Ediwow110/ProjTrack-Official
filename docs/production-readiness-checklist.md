# PROJTRACK Production Readiness Checklist

This checklist is for the final production cutover to `https://projtrack.codes` and `https://api.projtrack.codes`.

## Secrets and environment

- Never commit or share `backend/.env`.
- Rotate these immediately if they were ever exposed:
  - Mailrelay API key
  - Sender.net API key
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - PostgreSQL credentials
  - S3 or object storage credentials
- Production backend environment should use:
  - `NODE_ENV=production`
  - `APP_ENV=production`
  - `APP_URL=https://projtrack.codes`
  - `CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes`
  - `MAIL_PROVIDER=mailrelay`
  - `MAIL_FROM_NAME=PROJTRACK`
  - `MAIL_FROM_ADMIN=admin@projtrack.codes`
  - `MAIL_FROM_NOREPLY=support@projtrack.codes`
  - `MAIL_FROM_INVITE=support@projtrack.codes`
  - `MAIL_FROM_NOTIFY=notification@projtrack.codes`
  - `MAIL_FROM_SUPPORT=support@projtrack.codes`
  - `TESTMAIL_ENABLED=false`
- Production frontend environment should use:
  - `VITE_USE_BACKEND=true`
  - `VITE_API_BASE_URL=https://api.projtrack.codes`

## Deployment topology

- Deploy the frontend separately from the backend.
- Keep the Vercel SPA rewrite in `vercel.json` so direct React routes resolve to `index.html`.
- Deploy the backend to a separate service such as Render, Railway, Fly.io, or a VPS.
- Point the frontend only at `https://api.projtrack.codes`.

## Database and migrations

- Create a database backup before applying migrations or running cleanup tools.
- Run the duplicate scan before production migrations:
  - `npm --prefix backend run duplicates:scan`
- Review findings manually. Do not auto-delete duplicates.
- Apply Prisma migrations only after the scan is clean enough to proceed:
  - `npm --prefix backend run prisma:generate`
  - `npm --prefix backend run prisma:migrate:deploy`

## Storage and files

- Do not use localhost MinIO settings in production.
- Use a private S3-compatible bucket.
- Verify upload size and extension restrictions match your production policy.
- Verify admin, teacher, and student download permissions against real roles.

## Mail delivery

- Auth and reset flows must send from `support@projtrack.codes`.
- Bulk invitations must send from `support@projtrack.codes`.
- Classroom notifications must send from `notification@projtrack.codes`.
- High-priority admin events must send from `admin@projtrack.codes`.
- If provider delivery fails, in-app notifications must continue.

## Health endpoints

- Keep public:
  - `/health/live`
  - `/health/ready`
- Protect admin diagnostics:
  - `/health/database`
  - `/health/storage`
  - `/health/mail`
  - `/health/configuration`

## Seed and destructive actions

- Keep `ALLOW_DEMO_SEED=false` in production.
- Never run destructive cleanup automatically during deployment.
- Only enable seed cleanup when:
  - `ALLOW_SEED_DATA_CLEANUP=true`
  - `ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true` for production
- Take a backup before any cleanup or bulk destructive action.

## Admin bootstrap and recovery

- Ensure at least one active admin exists before go-live.
- Do not allow public admin self-registration.
- If all admins are locked out, recover through a guarded CLI or direct database maintenance path, not a public endpoint.

## Final smoke checks

- Frontend:
  - `npm run typecheck`
  - `npm run build`
- Backend:
  - `npm --prefix backend run prisma:generate`
  - `npm --prefix backend run build`
- Verify:
  - `/student/login`
  - `/teacher/login`
  - `/admin/login`
  - `/health/ready`
  - forgot password queueing
  - admin mail jobs view
  - teacher and student notification badges
