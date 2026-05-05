# Staging Smoke Test

Run this after deploying to staging and before approving production.

## Environment

- Staging frontend URL:
- Staging backend URL:
- Commit SHA:
- Database migration version:
- Tester:
- Date/time:

## Checks

- Local preflight before browser smoke: `npm run check:smoke-deps`.
- Local dependency startup, if needed: start Docker Desktop, then run `npm run prepare:local`.
- Browser smoke command: `npm run e2e:smoke`.
- Auth responsive command: `npm run e2e:responsive`.
- `/health/live` returns `ok: true`.
- `/health/ready` returns `ok: true` or lists only accepted non-blocking warnings.
- Admin can sign in and view system health.
- Admin can verify users, subjects, sections, mail jobs, and backup status.
- Teacher can sign in, view assigned subjects, and open submission review.
- Student can sign in, view due work, existing submissions, group status, and feedback.
- Login role mismatch is rejected.
- Logout revokes the session.
- Oversized upload is rejected.
- Invalid MIME upload is rejected.
- Smoke mail path uses the expected staging provider.
- No private token, reset link, password hash, or secret is visible in browser responses.

## Evidence

### 2026-05-06 — local Windows host (not staging)

This is a local-host preflight, not a staging run. Use it as a template for the next real staging session.

- Branch / commit: `production-hardening-repo-audit` @ `1b18739`.
- Tester: local engineer (automated in Cascade session).
- `npm run check:smoke-deps`: **Pass**. All five rows green:
  ```
  [PASS] Docker CLI
  [PASS] Docker Compose
  [PASS] Local PostgreSQL compose file
  [PASS] Docker daemon
  [PASS] PostgreSQL reachable at 127.0.0.1:5432
  ```
- `npm run e2e:responsive`: **Pass**, 24/24 tests across 8 viewports (360x800, 390x844, 430x932, 768x1024, 1024x768, 1366x768, 1440x900, 1920x1080) for `/student/login`, `/teacher/login`, `/admin/login`.
- `npm run e2e:smoke`: **Blocked (skipped)**. The Playwright runner exited 0 because all 13 tests were skipped. The auth-smoke, portal-navigation, and workflow-smoke specs all gate on `SMOKE_{STUDENT,TEACHER,ADMIN}_IDENTIFIER` and `SMOKE_{STUDENT,TEACHER,ADMIN}_PASSWORD` being set. None were set in this session.
- Backend snapshot for the same commit:
  - `prisma validate`: Pass.
  - `prisma migrate deploy`: 19 migrations applied (3 new today: `add_department_table`, `add_course_layer`, `backup_settings_json`).
  - `npm --prefix backend test`: production-hardening-checks Pass.
  - `npm --prefix backend run test:unit`: Jest 15 suites / 264 tests Pass in 25.0s.
  - `check:boot:production` and `check:boot:worker`: Pass.
  - `npm audit --audit-level=high` (frontend + backend): 0 vulnerabilities.

### Exact infrastructure blocker for full smoke

Repository ships only `backend/scripts/ensure-smoke-admin.js`, which provisions an admin user given `SMOKE_ADMIN_EMAIL` + `SMOKE_ADMIN_PASSWORD`. There is **no equivalent script** to seed:

- A `STUDENT` user (with section/subject enrolment).
- A `TEACHER` user (with subject assignment).

Until those exist, every CI/local smoke run will silently skip every smoke test, producing exit 0 with zero real assertions.

### Required commands once student/teacher accounts exist

```pwsh
# 1. Bring up local deps (or point to staging)
npm run prepare:local
npm run check:smoke-deps

# 2. Provision the admin
$env:SMOKE_ADMIN_EMAIL = "ci-smoke-admin@projtrack.local"
$env:SMOKE_ADMIN_PASSWORD = "..."  # local-only, never reuse in prod
npm --prefix backend run smoke:admin:ensure

# 3. Set all six smoke creds (student + teacher must already exist in DB)
$env:SMOKE_STUDENT_IDENTIFIER = "..."
$env:SMOKE_STUDENT_PASSWORD   = "..."
$env:SMOKE_TEACHER_IDENTIFIER = "..."
$env:SMOKE_TEACHER_PASSWORD   = "..."
$env:SMOKE_ADMIN_IDENTIFIER   = $env:SMOKE_ADMIN_EMAIL

# 4. Run smoke
npm run e2e:responsive
npm run e2e:smoke
```

### Owner / final decision

- Owner for student/teacher seed remediation: TBD.
- Final decision today: **Conditional staging-ready, NOT production-ready.** Do not flip PR #8 to Ready for Review until full smoke produces a non-skipped Pass.

### 2026-05-06 (later) — local Windows host with deterministic fixtures

This is the first run with real fixtures and the new skip-green guard.

- Branch / commit: `production-hardening-repo-audit`, working tree on top of `fb3a909`.
- New scripts: `scripts/check-smoke-env.mjs`, `backend/scripts/ensure-smoke-fixtures.js`, `tests/e2e/authenticated-responsive.spec.ts`.
- Skip-green guard verified: `npm run e2e:smoke` without `SMOKE_*` vars now exits 1 with a clear list of missing names instead of silently passing 13 skips.
- `npm run seed:smoke` (idempotent): provisioned admin, teacher, student, AY, section, subject, subject-section, enrollment.
- `npm run e2e:smoke`:
  - `tests/e2e/auth-smoke.spec.ts`: **5/5 PASS** (16.9s) — home redirect, protected redirect, student/teacher/admin login → dashboard.
  - `tests/e2e/portal-navigation.spec.ts`: **3/4 PASS** (~2 min including retry on the failing test). Public entry points, student sidebar, teacher sidebar all green. Admin sidebar deep-nav into `/admin/sections` failed: see Defects in scorecard.
  - `tests/e2e/workflow-smoke.spec.ts`: not reached because `run-e2e-smoke.mjs` exits on the first non-transient failure.
- `npm run e2e:responsive:auth`: **9/9 PASS** (25.9s) — student/teacher/admin dashboards at 390x844, 768x1024, 1440x900.

### Remaining smoke blockers

- Two pre-existing defects (one backend 500 on `/admin/sections`, one frontend nested-`<button>` warning) cause portal-navigation test 4 to fail. Fix them or scope-isolate them before flipping the smoke gate to "all green".
- workflow-smoke has not been verified yet against the seeded fixtures. After the two defects are addressed, rerun `npm run e2e:smoke` and confirm all 13 tests pass.
