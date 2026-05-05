# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

Last refreshed: 2026-05-06 on local Windows host, branch `production-hardening-repo-audit`, after the admin-only smoke-secret refactor on top of `844f4cd`.

| # | Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build and typecheck | Pass | Frontend typecheck and Vite production build both finished cleanly on this branch after the Sections UI fix. | `npm run typecheck`; `npm run build` | Push the current fixes and recheck GitHub CI. | |
| 2 | Backend tests | Pass | `npm --prefix backend test` (production-hardening-checks) passed; `npm --prefix backend run test:unit` passed with 16 suites / 265 tests after adding a new repository idempotency spec for the legacy academic-year-level sync path. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Push the current fixes and recheck GitHub CI. | |
| 3 | Prisma/database | Pass (local) | `npm --prefix backend run prisma:validate`, `prisma:generate`, and backend build all passed against the local Docker PostgreSQL instance during the admin-only smoke-secret validation pass. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npm --prefix backend run build` | Re-run the same checks in GitHub Actions after pushing. | |
| 4 | E2E smoke | Partial | Historical real smoke on pushed commit `9e46249` proved auth-smoke 5/5 PASS, portal-navigation 3/4 PASS, workflow-smoke not reached. The smoke design is now corrected so `check:smoke-env` requires admin credentials only and `seed:smoke` generates teacher/student credentials into `.tmp/smoke-credentials.json`. A post-fix authenticated rerun is still required on the new design. | `npm run check:smoke-env`; `npm run seed:smoke`; `npm run e2e:smoke` | Run post-fix smoke with admin env plus generated teacher/student fixtures, then verify `auth-smoke`, `portal-navigation`, and `workflow-smoke` all execute. | |
| 5 | Responsive QA | Pass (local) | `npm run e2e:responsive` passed 24/24 across 8 public-auth viewports. `npm run e2e:responsive:auth` passed 9/9 across student, teacher, and admin dashboards at `390x844`, `768x1024`, and `1440x900` using generated teacher/student smoke credentials. | `npm run e2e:responsive`; `npm run e2e:responsive:auth` | Re-run in GitHub Actions after pushing. | |
| 6 | Auth/RBAC security | Partial | Jest covers auth/session/JWT/guard/password (`session-cookie`, `token.service`, `jwt-auth.guard`, `auth-session.service`, `password.service`, `mail-environment.guard`, `runtime-safety` all green); staging real-account RBAC walk has not been executed in this session. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts; record cross-tenant denial proof. | |
| 7 | Upload security | Partial | `files.service.spec.ts` and `storage.config.spec.ts` cover upload validation, MIME, malware-scan modes, and S3/local switching. No live malware-scanner path or oversized-upload run has been recorded against staging. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases against staging. | |
| 8 | CI/CD | Partial (verified, not green) | GitHub was previously checked via public REST API for pushed commit `9e46249`: PR `#8` is still Draft; `Production Candidate Verification #186` succeeded; `Production Checks #4` failed; `CI #215` failed. The smoke wiring is now corrected so GitHub Actions should require admin credentials only and generate teacher/student smoke credentials during `seed:smoke`, but the updated workflows still need a green rerun. | GitHub Actions and commit status API for PR `#8` / branch tip after push | Push the admin-only smoke-secret refactor, rerun `CI` and `Production Checks`, and require green real smoke before considering merge. | |
| 9 | Monitoring | Blocked | Template exists (`docs/MONITORING_EVIDENCE.md`); no alert-test evidence recorded. | Manual alert test | Configure liveness/readiness/queue/backup alerts in your provider, fire each, and paste the alert payload + ack timestamps. | |
| 10 | Backup/restore | Blocked | Template exists (`docs/BACKUP_RESTORE_EVIDENCE.md`); no completed drill recorded. `drill:backup-restore` script is present but unrun in this environment. | `npm --prefix backend run drill:backup-restore` against a safe disposable target | Run drill end-to-end, record source DB size, dump time, restore time, integrity verification, RPO/RTO. | |
| 11 | Incident response | Partial | `docs/INCIDENT_RESPONSE.md` runbook exists; no rehearsal evidence attached. | Tabletop or timed incident drill | Record drill result, owner signoff, time-to-detect, time-to-mitigate. | |
| 12 | Launch signoff | Blocked | Template exists (`docs/PRODUCTION_LAUNCH_SIGNOFF.md`); no dated approvals. | Manual launch signoff | Complete after #4, #9, #10, #11 are real. | |
| 13 | UX/accessibility | Partial | Auth pages: motion removed, no body-level horizontal overflow at any of the 8 target viewports (24/24 automated). Authenticated dashboards (admin/teacher/student) not exercised this session. | `npm run e2e:responsive`; manual keyboard/screen-size QA | Test role dashboards and forms on target viewports; run an axe pass on at least the dashboard, list, modal, and form patterns. | |
| 14 | Documentation | Partial | README, scorecard, smoke runbook, evidence templates, deployment + DigitalOcean + Vercel + backup + monitoring + incident runbooks, role-access doc, release checklist all present. Scorecard updated this run; smoke + backup + monitoring evidence still empty by design (real evidence required). | Documentation review | Fill smoke/backup/monitoring evidence templates only with real results, never placeholders. | |
| 15 | Product/release readiness | Partial | CHANGELOG.md, ROADMAP.md, RELEASE_CHECKLIST.md, FINAL_READINESS_CHECKLIST.md present. PR #8 still Draft per branch state. | Manual product walkthrough | Walk a single full student → teacher → admin happy-path on staging with screen recordings. | |

## Latest Local Evidence (2026-05-06)

- Branch: `production-hardening-repo-audit`, now with the admin-only smoke-secret refactor plus the follow-up smoke fixes staged for push.
- `npm run typecheck`: **Pass**.
- `npm run build`: **Pass**.
- `npm run security:secrets`: **Pass**.
- `npm run check:release-hygiene`: **Pass**.
- `npm run check:smoke-env` without env: **Fail by design**, correctly lists only `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD`.
- `npm run check:smoke-env` with admin-only env: **Pass**.
- `npm run seed:smoke` with admin-only env and local Docker PostgreSQL: **Pass**. Teacher/student credentials were generated and written to `.tmp/smoke-credentials.json`.
- `npm run e2e:smoke`: **Pass**, all three specs executed:
  - `auth-smoke.spec.ts`: 5/5 pass
  - `portal-navigation.spec.ts`: 4/4 pass
  - `workflow-smoke.spec.ts`: 4/4 pass
- `npm run e2e:responsive`: **Pass**, 24/24 tests.
- `npm run e2e:responsive:auth`: **Pass**, 9/9 tests.
- `npm audit --audit-level=high` (frontend): **Pass**, 0 vulnerabilities.
- `npm --prefix backend run prisma:validate`: **Pass**.
- `npm --prefix backend run prisma:generate`: **Pass**.
- `npm --prefix backend run build`: **Pass**.
- `npm --prefix backend run check:boot:production` / `check:boot:worker`: **Pass**.
- `npm --prefix backend test` (production-hardening-checks): **Pass**.
- `npm --prefix backend run test:unit`: **Pass**, 16 suites, 265 tests.
- `npm --prefix backend audit --audit-level=high`: **Pass**, 0 vulnerabilities.
- GitHub PR / CI status for pushed commit `9e46249`:
  - PR `#8`: `draft: true`, `state: open`, `mergeable_state: unstable`.
  - Commit status API: `success` for `Vercel` deployment only.
  - Workflow runs: `Production Candidate Verification #186` = success; `Production Checks #4` = failure; `CI #215` = failure.
  - Repository secret design per product rule: admin smoke secrets are required; teacher/student credentials are generated during `npm run seed:smoke`.

## GitHub Actions smoke secret setup

Required GitHub repository secrets for real browser smoke:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`

Add them in `GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret`.

- Use test-only or staging-only credentials.
- Do not use production credentials.
- Do not commit or print these values.
- Teacher/student credentials are generated during `npm run seed:smoke`.
- Optional `SMOKE_TEACHER_*` and `SMOKE_STUDENT_*` overrides are for local debugging only.

Full setup guide: [docs/GITHUB_ACTIONS_SMOKE_SECRETS.md](/docs/GITHUB_ACTIONS_SMOKE_SECRETS.md)

## Defects surfaced by real smoke

These were real pre-existing defects surfaced by the earlier `9e46249` smoke run. They are now fixed locally and the generated-credential smoke rerun passed, but GitHub CI still needs to confirm the same result on the pushed branch tip.

1. **Backend: `AdminOpsRepository.syncLegacyAcademicYearLevels` unique-constraint violation.** Root cause was a non-atomic `findFirst(...mode: 'insensitive')` plus `create()` flow against `AcademicYearLevel @@unique([academicYearId, name])`. Local fix: `ensureAcademicYearLevel()` now uses composite-key `upsert` in `backend/src/repositories/admin-ops.repository.ts`; new `backend/src/repositories/admin-ops.repository.spec.ts` covers repeated calls.
2. **Frontend: nested `<button>` inside `<button>` in admin Sections drilldown.** Root cause was a clickable card button containing a nested delete button for year-level and section cards. Local fix: `src/app/pages/admin/Sections.tsx` now uses non-interactive containers with sibling action buttons, preserving valid semantics and visible keyboard focus.

## Current Verdict

**Conditional staging-ready.** Stronger than the previous pass, but still not production-ready:

- Skip-green smoke is now structurally impossible (`scripts/check-smoke-env.mjs` is chained into `e2e:smoke`).
- Real smoke now passes locally on the new admin-only secret model, with generated teacher/student fixture credentials.
- Public auth responsive QA and authenticated responsive QA both reran green locally.
- GitHub CI status has now been checked directly instead of assumed.

ProjTrack is still **not production-ready** because:

1. GitHub Actions has not yet been rerun on the updated branch tip, so `CI` and `Production Checks` are still not verified green on the admin-only secret model.
2. The most recently checked GitHub runs for pushed commit `9e46249` were failing (`Production Checks #4`, `CI #215`).
3. Backup-restore drill is unrun.
4. Monitoring alert evidence is unrecorded.
5. Launch signoff is empty.
6. Live RBAC and upload proof are still missing.

Do not promote to production until items 1–6 have real artifacts and GitHub `CI` plus `Production Checks` are green on the updated branch.
