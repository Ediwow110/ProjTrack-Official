# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

Last refreshed: 2026-05-06 on `production-hardening-repo-audit` after fixing CI `SMOKE_ADMIN_EMAIL` → `SMOKE_ADMIN_IDENTIFIER` rename in the backend job.

| # | Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build and typecheck | Pass | Frontend typecheck and Vite production build both finished cleanly. Backend build passes. | `npm run typecheck`; `npm run build`; `npm --prefix backend run build` | Add `SMOKE_ADMIN_IDENTIFIER` + `SMOKE_ADMIN_PASSWORD` as GitHub repo secrets, then rerun CI to confirm green. | |
| 2 | Backend tests | Pass | `npm --prefix backend test` (production-hardening-checks) passed. `npm --prefix backend run test:unit` passed with 16 suites / 265 tests including `admin-ops.repository.spec.ts` for the idempotency fix. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Rerun in GitHub Actions after secrets are added. | |
| 3 | Prisma/database | Pass (local) | `prisma:validate`, `prisma:generate`, and backend build all passed against local Docker PostgreSQL. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npm --prefix backend run build` | Re-run in GitHub Actions after pushing. | |
| 4 | E2E smoke | Partial | Local full smoke passed 13/13 on the admin-only secret model with generated teacher/student credentials: `auth-smoke.spec.ts` 5/5, `portal-navigation.spec.ts` 4/4, `workflow-smoke.spec.ts` 4/4. `e2e:responsive:auth` passed 9/9. GitHub CI smoke gate fails because `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD` repo secrets are not set. | `npm run check:smoke-env`; `npm run seed:smoke`; `npm run e2e:smoke`; `npm run e2e:responsive:auth` | **Owner action required**: add `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD` as GitHub Actions repository secrets (Settings → Secrets and variables → Actions), then re-run CI and Production Checks. | |
| 5 | Responsive QA | Pass (local) | `npm run e2e:responsive` passed 24/24 across 8 public-auth viewports. `npm run e2e:responsive:auth` passed 9/9 across student, teacher, and admin dashboards at `390x844`, `768x1024`, and `1440x900`. | `npm run e2e:responsive`; `npm run e2e:responsive:auth` | Re-run in GitHub Actions after repo secrets are added. | |
| 6 | Auth/RBAC security | Partial | Jest covers auth/session/JWT/guard/password: `session-cookie`, `token.service`, `jwt-auth.guard`, `auth-session.service`, `password.service`, `mail-environment.guard`, `runtime-safety` all green. E2E smoke exercises admin, teacher, and student login and portal navigation. Live staging cross-tenant denial proof not yet recorded. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts on a provisioned staging environment; record cross-tenant denial proof. | |
| 7 | Upload security | Partial | `files.service.spec.ts` and `storage.config.spec.ts` cover upload validation, MIME, malware-scan modes, and S3/local switching. No live malware-scanner path or oversized-upload run recorded against staging. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases against staging. | |
| 8 | CI/CD | Partial (fix pushed) | `ci.yml` backend job fixed: `SMOKE_ADMIN_EMAIL` renamed to `SMOKE_ADMIN_IDENTIFIER` to match the e2e job and `check-smoke-env.mjs`. Fix pushed to branch. Latest run: CI #222 = failure, Production Checks #7 = failure — both fail only on missing repo secrets. Production Candidate Verification #189 = success. Frontend and backend jobs are green; only the e2e/smoke gate fails due to missing repo secrets. | GitHub Actions on commit after ci.yml fix | **Owner action required**: add `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD` as GitHub Actions repository secrets, then re-run CI and Production Checks. | |
| 9 | Monitoring | Blocked | `docs/MONITORING_EVIDENCE.md` updated with detailed blocker description and next actions. No DigitalOcean environment is provisioned. Health endpoints are implemented but cannot be verified without a running server. | Manual alert test after DO provisioning | Provision DigitalOcean Droplet, deploy backend, configure Uptime checks and alert policies per `MONITORING_RUNBOOK.md`, test-fire each alert, record evidence. | |
| 10 | Backup/restore | Blocked | `docs/BACKUP_RESTORE_EVIDENCE.md` updated with detailed blocker description and exact next commands. `backend/scripts/backup-restore-drill.mjs` is ready to run. No staging/local database is available to run the drill in this environment. | `node backend/scripts/backup-restore-drill.mjs` against a safe disposable target | Provision staging or local PostgreSQL, run a manual backup, create a disposable restore target, run drill, record evidence. | |
| 11 | Incident response | Partial | `docs/INCIDENT_RESPONSE.md` runbook exists. No rehearsal evidence attached. | Tabletop or timed incident drill | Record drill result, owner signoff, time-to-detect, time-to-mitigate. | |
| 12 | Launch signoff | Blocked | `docs/PRODUCTION_LAUNCH_SIGNOFF.md` updated with current honest status and conditions. No dated approvals. Cannot sign off until CI is green, staging smoke is run, backup drill is complete, and monitoring is wired. | Manual launch signoff | Complete after #4 (CI green), #9, #10, #11 are real. | |
| 13 | UX/accessibility | Partial | Auth pages: no horizontal overflow at 8 target viewports (24/24 automated). Authenticated dashboards (admin/teacher/student) at 3 target viewports (9/9 automated). Admin Sections nested-button defect fixed; admin Sections drilldown not yet manually verified post-fix. No axe pass recorded. | `npm run e2e:responsive`; `npm run e2e:responsive:auth`; manual keyboard/screen-size QA | Test role dashboards and forms at target viewports manually; run an axe pass on dashboard, list, modal, and form patterns. | |
| 14 | Documentation | Partial | README, scorecard, smoke runbook, evidence templates, deployment + DigitalOcean + Vercel + backup + monitoring + incident runbooks, role-access doc, release checklist all present. Scorecard, backup evidence, monitoring evidence, and launch signoff all updated this pass with real blockers and next actions. Smoke + backup + monitoring evidence still empty by design — real evidence required. | Documentation review | Fill smoke/backup/monitoring evidence templates only with real results. | |
| 15 | Product/release readiness | Partial | CHANGELOG.md, ROADMAP.md, RELEASE_CHECKLIST.md, FINAL_READINESS_CHECKLIST.md present. PR #8 still Draft. CI is not yet green. Local smoke is green but staging smoke has not been run. | Manual product walkthrough on staging | Walk a full student → teacher → admin happy-path on staging with screen recordings. | |

## CI Failure Root Cause (as of 2026-05-06)

The only reason CI and Production Checks are failing is **missing GitHub Actions repository secrets**.

- `SMOKE_ADMIN_IDENTIFIER` — not set as a GitHub repo secret
- `SMOKE_ADMIN_PASSWORD` — not set as a GitHub repo secret

The `check:smoke-env` preflight exits nonzero when either is missing, which causes the entire e2e/smoke job to fail. Frontend and backend jobs are green.

**Fix required (human action):**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `SMOKE_ADMIN_IDENTIFIER` with your test/staging admin email
4. Add `SMOKE_ADMIN_PASSWORD` with your test/staging admin password
5. Re-run the failed CI and Production Checks workflows from the Actions tab

Use test-only or staging-only credentials. Never use production credentials.

Also fixed in this pass: `ci.yml` backend job used `SMOKE_ADMIN_EMAIL` (old name) instead of `SMOKE_ADMIN_IDENTIFIER`. That rename is now committed.

## Latest Local Evidence (2026-05-06)

- Branch: `production-hardening-repo-audit`, commit `ac1fe4c` + ci.yml fix
- `npm run typecheck`: **Pass**
- `npm run build`: **Pass**
- `npm run security:secrets`: **Pass**
- `npm run check:release-hygiene`: **Pass**
- `npm run check:smoke-env` without env: **Fail by design**, lists only `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD`
- `npm run check:smoke-env` with admin-only env: **Pass**
- `npm run seed:smoke` with admin-only env and local Docker PostgreSQL: **Pass**. Teacher/student credentials generated and written to `.tmp/smoke-credentials.json`
- `npm run e2e:smoke`: **Pass** — auth-smoke 5/5, portal-navigation 4/4, workflow-smoke 4/4
- `npm run e2e:responsive`: **Pass**, 24/24 tests
- `npm run e2e:responsive:auth`: **Pass**, 9/9 tests
- `npm audit --audit-level=high` (frontend): **Pass**, 0 vulnerabilities
- `npm --prefix backend run prisma:validate`: **Pass**
- `npm --prefix backend run prisma:generate`: **Pass**
- `npm --prefix backend run build`: **Pass**
- `npm --prefix backend run check:boot:production` / `check:boot:worker`: **Pass**
- `npm --prefix backend test`: **Pass**
- `npm --prefix backend run test:unit`: **Pass**, 16 suites, 265 tests
- `npm --prefix backend audit --audit-level=high`: **Pass**, 0 vulnerabilities
- GitHub CI status on `ac1fe4c` + ci.yml fix commit:
  - PR `#8`: `draft: true`, `state: open`
  - CI: failure (e2e job — missing repo secrets)
  - Production Checks: failure (smoke job — missing repo secrets)
  - Production Candidate Verification: success
  - Frontend job: **green**
  - Backend job: **green**

## GitHub Actions smoke secret setup

Required GitHub repository secrets for real browser smoke:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`

Add them in `GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret`.

- Use test-only or staging-only credentials
- Do not use production credentials
- Do not commit or print these values
- Teacher/student credentials are generated during `npm run seed:smoke`
- Optional `SMOKE_TEACHER_*` and `SMOKE_STUDENT_*` overrides are for local debugging only

Full setup guide: [docs/GITHUB_ACTIONS_SMOKE_SECRETS.md](/docs/GITHUB_ACTIONS_SMOKE_SECRETS.md)

## Defects surfaced and fixed by real smoke

1. **Backend: `AdminOpsRepository.syncLegacyAcademicYearLevels` unique-constraint violation.** Fixed in `backend/src/repositories/admin-ops.repository.ts` using composite-key `upsert`. Covered by `backend/src/repositories/admin-ops.repository.spec.ts`.
2. **Frontend: nested `<button>` inside `<button>` in admin Sections drilldown.** Fixed in `src/app/pages/admin/Sections.tsx` using non-interactive containers with sibling action buttons.

## Current Verdict

**Conditional staging-ready.** Not production-ready.

- Local smoke is fully green: 13/13 on admin-only secret model with generated teacher/student fixtures
- GitHub CI fails only because of missing repo secrets (human action required)
- Backup restore drill is not run
- Monitoring is not wired
- Launch signoff is not complete
- Live RBAC and upload proof are still missing

Do not promote to production-ready until all items above have real artifacts and GitHub CI plus Production Checks are green.
