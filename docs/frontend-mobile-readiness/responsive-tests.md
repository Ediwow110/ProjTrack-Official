# Responsive E2E Test Harness

Phase: Frontend mobile-readiness Phase 1.

## What this runs

`npm run e2e:responsive` targets the authenticated responsive suite via `playwright.responsive.config.ts`: `authenticated-responsive.spec.ts`, `responsive-critical-pages.spec.ts`, `portal-drawer-responsive.spec.ts`, `touch-targets.spec.ts`, `mobile-forms.spec.ts`, and `accessibility-critical.spec.ts`.

The harness must discover authenticated dashboard checks for all three roles:

- student
- teacher
- admin

Current viewport coverage:

- 360 x 800
- 390 x 844
- 414 x 896
- 768 x 1024
- 1440 x 900

The wrapper script `scripts/run-responsive-e2e.mjs` fails before execution if discovery returns zero tests, if the authenticated responsive spec is not selected, or if any role dashboard check is missing. Additional specs cover critical routes, drawer behavior, touch targets, mobile forms, and axe accessibility checks.

## Local run

Prerequisites:

1. Install root and backend dependencies.
2. Start or provide PostgreSQL for the backend.
3. Apply backend migrations.
4. Set smoke admin credentials:
   - `SMOKE_ADMIN_IDENTIFIER`
   - `SMOKE_ADMIN_PASSWORD`
5. Seed deterministic smoke fixtures:
   - `npm run seed:smoke`

Run the responsive suite with one command:

```bash
npm run e2e:responsive
```

To verify discovery without starting the app servers:

```bash
npm run e2e:responsive -- --list
```

The discovery output prints:

- responsive spec count
- discovered test count
- browser project count
- tested viewports
- required role dashboard checks

## CI wiring

- The frontend CI job runs `npm run e2e:responsive -- --list` to prove the harness points at the authenticated responsive suite and cannot silently discover zero tests.
- The E2E CI job runs `npm run e2e:responsive` after smoke env preflight and smoke fixture seeding, so authenticated student, teacher, and admin dashboard checks execute against the real local backend.

## Failure policy

A responsive failure blocks promotion. Do not treat login-only responsive tests or desktop screenshots as proof that authenticated mobile dashboards work.
