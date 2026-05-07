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

- Staging frontend URL: _not yet provisioned_
- Staging backend URL: _not yet provisioned_
- Commit SHA: `production-hardening-repo-audit` — see latest branch tip
- Database migration version: 19 migrations applied locally
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

## Evidence Archive

### 2026-05-06 (admin-only secret refactor validation) — local Windows host with generated credentials

- Branch: `production-hardening-repo-audit` @ `ac1fe4c`
- `npm run check:smoke-env` without env: **Fail by design** — lists only `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD`.
- `npm run check:smoke-env` with admin-only env: **Pass**.
- `npm run seed:smoke`: **Pass** — teacher and student accounts created or reused automatically; credentials written to `.tmp/smoke-credentials.json`; passwords not printed in logs.
- `npm run e2e:smoke`: **Pass** — `auth-smoke.spec.ts` 5/5, `portal-navigation.spec.ts` 4/4, `workflow-smoke.spec.ts` 4/4.
- `npm run e2e:responsive`: **Pass**, 24/24.
- `npm run e2e:responsive:auth`: **Pass**, 9/9.

### 2026-05-06 — ci.yml fix pass

- ci.yml backend job `SMOKE_ADMIN_EMAIL` renamed to `SMOKE_ADMIN_IDENTIFIER` — committed to branch.
- GitHub CI run #222 on `ac1fe4c`: frontend job = green, backend job = green, e2e job = failure (missing repo secrets only).
- GitHub Production Checks run #7 on `ac1fe4c`: frontend = green, backend = green, smoke = failure (missing repo secrets only).
- Production Candidate Verification #189: success.

## Current CI Failure Root Cause

The only reason CI fails is **missing GitHub Actions repository secrets**:

- `SMOKE_ADMIN_IDENTIFIER` — required but not set as a GitHub repo secret
- `SMOKE_ADMIN_PASSWORD` — required but not set as a GitHub repo secret

**Fix:** Go to `Settings → Secrets and variables → Actions → New repository secret`. Add both secrets with test/staging-only credentials. Then re-run the failed workflows.

## Owner / final decision

- Owner for secret configuration: repository owner (Edmar-007)
- Verdict today: **Conditional staging-ready, NOT production-ready**
- PR #8 must remain Draft until CI is green and operational evidence (backup drill, monitoring, signoff) is complete.
