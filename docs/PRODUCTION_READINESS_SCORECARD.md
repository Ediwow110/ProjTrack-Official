# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

Last refreshed: 2026-05-06 05:15 UTC+08:00 on local Windows host (Docker Desktop 29.4.1, Node 22.22.2, npm 10.9.7), branch `production-hardening-repo-audit` at commit `fb3a909` (working tree adds smoke fixtures + skip-green guard + authenticated responsive spec, not yet pushed).

| # | Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build and typecheck | Pass | Frontend typecheck and Vite production build both finished cleanly on this branch (built in 7.63s, 0 type errors). | `npm run typecheck`; `npm run build` | Confirm GitHub CI after push. | |
| 2 | Backend tests | Pass | `npm --prefix backend test` (production-hardening-checks) and `npm --prefix backend run test:unit` (Jest, 15 suites / 264 tests) both passed. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Confirm GitHub CI after push. | |
| 3 | Prisma/database | Pass (local) | `prisma validate` reports schema valid; `prisma generate` succeeds; `prisma migrate deploy` applied 19 migrations including the 3 newest (`add_department_table`, `add_course_layer`, `backup_settings_json`). Local PostgreSQL 16 reachable at `127.0.0.1:5432` via `projtrack-postgres` container. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npx prisma migrate deploy` | Repeat in staging before launch. | |
| 4 | E2E smoke | Partial (real, not green) | Skip-green is now **impossible**: `npm run e2e:smoke` chains `scripts/check-smoke-env.mjs` which exits 1 if any of the six SMOKE_* vars is missing. With fixtures provisioned via `npm run seed:smoke`, real smoke ran for the first time today: **auth-smoke 5/5 PASS** (home redirect, protected redirect, student/teacher/admin login → dashboard); **portal-navigation 3/4 PASS** (public entry points, student sidebar, teacher sidebar) with 1 fail on admin sidebar deep-nav surfacing two real defects (see Defects below); workflow-smoke not reached because portal-navigation gate failed first. | `npm run check:smoke-env`; `npm run seed:smoke`; `npm run e2e:smoke` | Fix or accept the two smoke-revealed defects, then run workflow-smoke. | |
| 5 | Responsive QA | Pass (auth + dashboards) | `npm run e2e:responsive` passed 24/24 across 8 viewports for the three login pages. New `npm run e2e:responsive:auth` (using `tests/e2e/authenticated-responsive.spec.ts`) passed **9/9** today: student/teacher/admin dashboards at 390x844, 768x1024, 1440x900 — body+document have no horizontal overflow, `<main>` shell present, no error overlays. | `npm run e2e:responsive`; `npm run e2e:responsive:auth` | Add deeper authenticated pages (lists, modals, forms) to the responsive matrix in a future pass. | |
| 6 | Auth/RBAC security | Partial | Jest covers auth/session/JWT/guard/password (`session-cookie`, `token.service`, `jwt-auth.guard`, `auth-session.service`, `password.service`, `mail-environment.guard`, `runtime-safety` all green); staging real-account RBAC walk has not been executed in this session. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts; record cross-tenant denial proof. | |
| 7 | Upload security | Partial | `files.service.spec.ts` and `storage.config.spec.ts` cover upload validation, MIME, malware-scan modes, and S3/local switching. No live malware-scanner path or oversized-upload run has been recorded against staging. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases against staging. | |
| 8 | CI/CD | Partial (no longer falsely green) | Three workflows present (`ci.yml`, `production-checks.yml`, `production-candidate.yml`). Frontend `ci.yml` job runs `e2e:responsive`. Smoke jobs in `ci.yml` and `production-checks.yml` now wire all six `SMOKE_*` secrets, run `check:smoke-env` (loud-fail), `seed:smoke`, `e2e:smoke`, then `e2e:responsive:auth`. With secrets configured, smoke produces real evidence; without them, the job fails immediately rather than silently passing with all tests skipped. GitHub Actions run status not verified from this environment (no `gh` CLI). | GitHub Actions for PR #8 | Add the six `SMOKE_*` repo secrets, then verify the next run on GitHub. | |
| 9 | Monitoring | Blocked | Template exists (`docs/MONITORING_EVIDENCE.md`); no alert-test evidence recorded. | Manual alert test | Configure liveness/readiness/queue/backup alerts in your provider, fire each, and paste the alert payload + ack timestamps. | |
| 10 | Backup/restore | Blocked | Template exists (`docs/BACKUP_RESTORE_EVIDENCE.md`); no completed drill recorded. `drill:backup-restore` script is present but unrun in this environment. | `npm --prefix backend run drill:backup-restore` against a safe disposable target | Run drill end-to-end, record source DB size, dump time, restore time, integrity verification, RPO/RTO. | |
| 11 | Incident response | Partial | `docs/INCIDENT_RESPONSE.md` runbook exists; no rehearsal evidence attached. | Tabletop or timed incident drill | Record drill result, owner signoff, time-to-detect, time-to-mitigate. | |
| 12 | Launch signoff | Blocked | Template exists (`docs/PRODUCTION_LAUNCH_SIGNOFF.md`); no dated approvals. | Manual launch signoff | Complete after #4, #9, #10, #11 are real. | |
| 13 | UX/accessibility | Partial | Auth pages: motion removed, no body-level horizontal overflow at any of the 8 target viewports (24/24 automated). Authenticated dashboards (admin/teacher/student) not exercised this session. | `npm run e2e:responsive`; manual keyboard/screen-size QA | Test role dashboards and forms on target viewports; run an axe pass on at least the dashboard, list, modal, and form patterns. | |
| 14 | Documentation | Partial | README, scorecard, smoke runbook, evidence templates, deployment + DigitalOcean + Vercel + backup + monitoring + incident runbooks, role-access doc, release checklist all present. Scorecard updated this run; smoke + backup + monitoring evidence still empty by design (real evidence required). | Documentation review | Fill smoke/backup/monitoring evidence templates only with real results, never placeholders. | |
| 15 | Product/release readiness | Partial | CHANGELOG.md, ROADMAP.md, RELEASE_CHECKLIST.md, FINAL_READINESS_CHECKLIST.md present. PR #8 still Draft per branch state. | Manual product walkthrough | Walk a single full student → teacher → admin happy-path on staging with screen recordings. | |

## Latest Local Evidence (2026-05-06)

- Branch: `production-hardening-repo-audit`, last pushed commit `fb3a909`. Working tree adds (not yet pushed): `scripts/check-smoke-env.mjs`, `backend/scripts/ensure-smoke-fixtures.js`, `tests/e2e/authenticated-responsive.spec.ts`, smoke spec text fixes for current UI, smoke-related package.json scripts, and `ci.yml` + `production-checks.yml` smoke job hardening.
- Local infra: Docker Desktop running; containers `projtrack-postgres` (5432) and `projtrack-minio` (9000-9001) up.
- `npm run typecheck`: **Pass**.
- `npm run build`: **Pass** (7.63s, all chunks emitted).
- `npm run security:secrets`: **Pass**.
- `npm run check:release-hygiene`: **Pass**.
- `npm run check:smoke-deps`: **Pass** (5/5 rows green).
- `npm run check:smoke-env`: **Pass** with vars set; **Fails loudly** without vars (skip-green guard verified).
- `npm run seed:smoke`: **Pass**, idempotent. Provisions admin/teacher/student users, AY, section, subject, subject-section, enrollment.
- `npm run e2e:responsive`: **Pass**, 24/24 tests in 27.4s.
- `npm run e2e:responsive:auth` (new): **Pass**, 9/9 tests in 25.9s. Authenticated dashboards for student/teacher/admin at 390x844, 768x1024, 1440x900.
- `npm run e2e:smoke`: **Partial real run**. auth-smoke 5/5 PASS. portal-navigation 3/4 PASS. workflow-smoke skipped because portal-navigation gate failed. Two real defects surfaced (documented under Defects below). Total: 8 real PASS, 1 real FAIL, 4 not reached.
- `npm audit --audit-level=high` (frontend): **Pass**, 0 vulnerabilities.
- `npm --prefix backend run prisma:validate` / `prisma:generate` / `migrate deploy`: **Pass**, 19 migrations applied.
- `npm --prefix backend run build`: **Pass** (288 dist files).
- `npm --prefix backend run check:boot:production` / `check:boot:worker`: **Pass**.
- `npm --prefix backend test` (production-hardening-checks): **Pass**.
- `npm --prefix backend run test:unit`: **Pass**, 15 suites, 264 tests, 25.0s.
- `npm --prefix backend audit --audit-level=high`: **Pass**, 0 vulnerabilities.

## Defects surfaced by real smoke (this pass)

These are pre-existing defects that the new fixtures + spec fixes exposed. They were hidden previously by skip-green smoke.

1. **Backend: `AdminOpsRepository.syncLegacyAcademicYearLevels` violates unique constraint.** GET `/admin/sections` returns 500 with `PrismaClientKnownRequestError: Unique constraint failed on the fields: (academicYearId, name)` from `backend/src/repositories/admin-ops.repository.ts` near line 419 (`prisma.academicYearLevel.create`). Root cause is a race or a case-insensitive lookup that doesn't catch a case-sensitive unique. Workaround in `ensure-smoke-fixtures.js`: leave `yearLevel`/`yearLevelName` unset on the smoke student profile so the legacy sync is a no-op. Real fix is out of scope for this branch.
2. **Frontend: nested `<button>` inside `<button>` on admin Sections drilldown.** React `validateDOMNesting` warning observed in `tests\e2e\portal-navigation.spec.ts` admin section deep-nav. Source likely in the admin sections / academic year drilldown components. Causes the test's `assertHealthy` (consoleErrors must be empty) to fail. Real fix is out of scope for this branch.

Both defects are filed via this scorecard for follow-up; neither is introduced by this pass.

## Current Verdict

**Conditional staging-ready.** Stronger than previous pass:

- Skip-green smoke is now structurally impossible (`scripts/check-smoke-env.mjs` is chained into `e2e:smoke`).
- Real smoke evidence exists for the first time: 8 real test pass, 1 real fail, 4 not yet reached.
- Authenticated responsive QA is now Pass for the role landing dashboards.
- CI workflows wire SMOKE_* secrets and seed fixtures, so a CI run with secrets configured produces real evidence; a run without secrets fails immediately rather than masquerading as green.

ProjTrack is still **not production-ready** because:

1. Two backend/frontend defects surfaced by smoke remain unfixed (admin sections 500 + nested `<button>`).
2. workflow-smoke (4 tests) has not been reached yet.
3. Backup-restore drill is unrun.
4. Monitoring alert evidence is unrecorded.
5. Launch signoff is empty.
6. GitHub CI status for the latest push is not verified from this environment.

Do not promote to production until items 1–5 have real artifacts and item 6 shows a real-green run on GitHub.
