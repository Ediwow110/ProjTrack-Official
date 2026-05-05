# Staging Smoke Test

Run this after deploying to staging and before approving production.

## GitHub Actions smoke secrets

GitHub Actions browser smoke requires only these repository secrets:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`

Add them in `GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret`.

- Use test-only or staging-only credentials.
- Do not use production user credentials.
- Do not commit these values.
- Teacher/student smoke credentials are generated during `npm run seed:smoke`.
- Generated teacher/student passwords are not printed and are written only to `.tmp/smoke-credentials.json`.
- Optional local overrides exist for `SMOKE_TEACHER_*` and `SMOKE_STUDENT_*`, but GitHub Actions does not require them.

After adding or fixing the admin secrets, rerun the failed `CI` and `Production Checks` workflows from the Actions UI.

See [docs/GITHUB_ACTIONS_SMOKE_SECRETS.md](/docs/GITHUB_ACTIONS_SMOKE_SECRETS.md) for the full checklist.

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

### Required commands with generated teacher/student fixtures

```pwsh
# 1. Bring up local deps (or point to staging)
npm run prepare:local
npm run check:smoke-deps

# 2. Set admin smoke credentials
$env:SMOKE_ADMIN_IDENTIFIER = "admin.smoke@example.test"
$env:SMOKE_ADMIN_PASSWORD   = "..."  # local-only, never reuse in prod

# 3. Seed fixtures (teacher/student creds generated here)
npm run seed:smoke

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

### 2026-05-06 (resume pass) - local Windows host after fixing the two smoke-found defects

This pass fixed the two real defects surfaced by the earlier real smoke run, but could not honestly rerun authenticated smoke in that shell because the required admin smoke credentials were not set.

- Branch / commit under test: local worktree on `production-hardening-repo-audit`, based on pushed commit `9e46249`.
- Backend defect fix:
  - File: `backend/src/repositories/admin-ops.repository.ts`
  - Root cause: `syncLegacyAcademicYearLevels()` used a `findFirst(...mode: 'insensitive')` plus `create()` sequence against `AcademicYearLevel @@unique([academicYearId, name])`, which is not atomic and can race into a duplicate create on `GET /admin/sections`.
  - Fix: `ensureAcademicYearLevel()` now uses Prisma `upsert` on the real composite key `academicYearId_name`, making repeated sync attempts idempotent for the normalized label.
  - Added proof: `backend/src/repositories/admin-ops.repository.spec.ts` verifies repeated calls reuse the same record instead of creating duplicates.
- Frontend defect fix:
  - File: `src/app/pages/admin/Sections.tsx`
  - Root cause: the year-level and section cards were clickable outer `<button>` elements containing nested delete `<button>` elements, which triggers React `validateDOMNesting` and fails the portal smoke health assertion.
  - Fix: both card types are now non-interactive containers with sibling controls: a delete button and a separate "Open year level" / "Open master list" button. Semantics remain valid, keyboard focus remains visible, and the Playwright-facing button labels are preserved.
- Local validation on this pass:
  - `npm run typecheck`: Pass.
  - `npm run build`: Pass.
  - `npm run e2e:responsive`: Pass, 24/24.
  - `npm run e2e:responsive:auth`: Blocked by missing admin smoke env vars in that shell.
  - `npm run check:smoke-env`: Fail by design in that shell, correctly listing the missing admin `SMOKE_*` vars.
  - `npm run e2e:smoke`: Not run because `check:smoke-env` fails first without credentials.
  - `npm --prefix backend run build`: Pass.
  - `npm --prefix backend test`: Pass.
  - `npm --prefix backend run test:unit`: Pass, 16 suites / 265 tests.
  - `npm --prefix backend run check:boot:production`: Pass.
  - `npm --prefix backend run check:boot:worker`: Pass.
- GitHub truth for pushed commit `9e46249` checked via public REST API:
  - PR `#8`: still `draft: true`, `state: open`.
  - Commit status API: `success`, but only for the `Vercel` deployment context.
  - Workflow runs for `9e46249`: `Production Candidate Verification #186` = success, `Production Checks #4` = failure, `CI #215` = failure.

### Current blocker summary

- The two smoke-discovered defects are patched locally.
- The older blocked shell is now superseded by the admin-only secret validation run below.
- workflow-smoke is now verified locally on the generated-credential path.
- PR #8 must remain Draft until a post-fix `npm run e2e:smoke` run executes all smoke specs and GitHub CI is green.
- GitHub Actions should now require only the two admin smoke secrets, plus a green `seed:smoke` run that generates teacher/student credentials successfully.

### 2026-05-06 (admin-only secret refactor validation) - local Windows host with generated teacher/student smoke credentials

This pass validated the new smoke credential design end to end on a local Docker PostgreSQL stack.

- `npm run check:smoke-env` without env: **Fail by design**, listing only `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD`.
- `npm run check:smoke-env` with admin-only env: **Pass**.
- `npm run seed:smoke` with admin-only env: **Pass**.
  - Teacher and student accounts were created or reused automatically.
  - Generated credentials were written to `.tmp/smoke-credentials.json`.
  - Password values were not printed in logs.
- `npm run e2e:smoke`: **Pass**.
  - `auth-smoke.spec.ts`: 5/5 pass
  - `portal-navigation.spec.ts`: 4/4 pass
  - `workflow-smoke.spec.ts`: 4/4 pass
- `npm run e2e:responsive:auth`: **Pass**, 9/9.

Remaining truth:

- PR `#8` still stays Draft.
- GitHub Actions on the updated branch tip has not yet been rerun and verified green.
- Backup restore, monitoring, launch signoff, and live RBAC/upload proof are still missing.
