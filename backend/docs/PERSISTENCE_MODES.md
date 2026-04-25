# Persistence Mode Notes

## Backend runtime

- Backend source code runs against PostgreSQL through Prisma.
- `DATABASE_URL` is required at startup.
- Readiness checks treat missing Prisma migration history as a release blocker.

## What is still mock-like

- The frontend can still be configured to avoid backend calls through `VITE_USE_BACKEND`, which is useful for isolated UI work.
- Local file uploads remain filesystem-backed until object storage is implemented.
- Mail defaults to stub mode until SMTP is configured.

## What should not be assumed

- A reachable database alone is not enough; `/health/database` must also confirm the Prisma migrations table is present.
- Local-disk files and stub mail are operational conveniences, not production-ready subsystems.
