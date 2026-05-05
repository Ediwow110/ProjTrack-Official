# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

Last refreshed: 2026-05-06 06:10 UTC+08:00 on local Windows host (Node 22.22.2, npm 10.9.7), branch `production-hardening-repo-audit` based on pushed commit `9e46249` with local fixes for the two smoke-discovered defects.

| # | Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build and typecheck | Pass | Frontend typecheck and Vite production build both finished cleanly on this branch after the Sections UI fix. | `npm run typecheck`; `npm run build` | Push the current fixes and recheck GitHub CI. | |
| 2 | Backend tests | Pass | `npm --prefix backend test` (production-hardening-checks) passed; `npm --prefix backend run test:unit` passed with 16 suites / 265 tests after adding a new repository idempotency spec for the legacy academic-year-level sync path. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Push the current fixes and recheck GitHub CI. | |
| 3 | Prisma/database | Partial (local) | `npm --prefix backend run prisma:generate` succeeds. `npm --prefix backend run prisma:validate` is blocked in this shell because `DATABASE_URL` is unset, so schema validation cannot be repeated honestly here. The backend build is green after a tiny type-only fix in `admin.service.ts`. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npm --prefix backend run build` | Re-run `prisma:validate`, fixture seeding, and smoke in an environment with the correct database and smoke credentials. | |
| 4 | E2E smoke | Partial (historical real evidence, post-fix rerun blocked locally) | Historical real smoke on pushed commit `9e46249` proved auth-smoke 5/5 PASS, portal-navigation 3/4 PASS, workflow-smoke not reached. The two surfaced defects are now patched locally, but a post-fix smoke rerun has not happened in this shell because `check:smoke-env` fails first when all six required `SMOKE_*` vars are absent. | `npm run check:smoke-env`; `npm run seed:smoke`; `npm run e2e:smoke` | Re-run full smoke with real credentials and seeded fixtures; verify `auth-smoke`, `portal-navigation`, and `workflow-smoke` all execute. | |
| 5 | Responsive QA | Partial | `npm run e2e:responsive` passed 24/24 across 8 viewports for the three login pages after the frontend fix. Historical evidence on `9e46249` shows `npm run e2e:responsive:auth` passed 9/9, but that authenticated rerun is blocked in the current shell by missing `SMOKE_*` vars. | `npm run e2e:responsive`; `npm run e2e:responsive:auth` | Re-run authenticated responsive QA with smoke credentials after pushing the Sections fix. | |
| 6 | Auth/RBAC security | Partial | Jest covers auth/session/JWT/guard/password (`session-cookie`, `token.service`, `jwt-auth.guard`, `auth-session.service`, `password.service`, `mail-environment.guard`, `runtime-safety` all green); staging real-account RBAC walk has not been executed in this session. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts; record cross-tenant denial proof. | |
| 7 | Upload security | Partial | `files.service.spec.ts` and `storage.config.spec.ts` cover upload validation, MIME, malware-scan modes, and S3/local switching. No live malware-scanner path or oversized-upload run has been recorded against staging. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases against staging. | |
| 8 | CI/CD | Partial (verified, not green) | GitHub was checked via public REST API for pushed commit `9e46249`: PR `#8` is still Draft; `Production Candidate Verification #186` succeeded; `Production Checks #4` failed; `CI #215` failed. The commit-status endpoint reports only a successful `Vercel` deployment context, so merge readiness cannot be inferred from that single green status. | GitHub Actions and commit status API for PR `#8` / commit `9e46249` | Push the two defect fixes, rerun GitHub Actions, and require green `CI` plus green `Production Checks` before considering merge. | |
| 9 | Monitoring | Blocked | Template exists (`docs/MONITORING_EVIDENCE.md`); no alert-test evidence recorded. | Manual alert test | Configure liveness/readiness/queue/backup alerts in your provider, fire each, and paste the alert payload + ack timestamps. | |
| 10 | Backup/restore | Blocked | Template exists (`docs/BACKUP_RESTORE_EVIDENCE.md`); no completed drill recorded. `drill:backup-restore` script is present but unrun in this environment. | `npm --prefix backend run drill:backup-restore` against a safe disposable target | Run drill end-to-end, record source DB size, dump time, restore time, integrity verification, RPO/RTO. | |
| 11 | Incident response | Partial | `docs/INCIDENT_RESPONSE.md` runbook exists; no rehearsal evidence attached. | Tabletop or timed incident drill | Record drill result, owner signoff, time-to-detect, time-to-mitigate. | |
| 12 | Launch signoff | Blocked | Template exists (`docs/PRODUCTION_LAUNCH_SIGNOFF.md`); no dated approvals. | Manual launch signoff | Complete after #4, #9, #10, #11 are real. | |
| 13 | UX/accessibility | Partial | Auth pages: motion removed, no body-level horizontal overflow at any of the 8 target viewports (24/24 automated). Authenticated dashboards (admin/teacher/student) not exercised this session. | `npm run e2e:responsive`; manual keyboard/screen-size QA | Test role dashboards and forms on target viewports; run an axe pass on at least the dashboard, list, modal, and form patterns. | |
| 14 | Documentation | Partial | README, scorecard, smoke runbook, evidence templates, deployment + DigitalOcean + Vercel + backup + monitoring + incident runbooks, role-access doc, release checklist all present. Scorecard updated this run; smoke + backup + monitoring evidence still empty by design (real evidence required). | Documentation review | Fill smoke/backup/monitoring evidence templates only with real results, never placeholders. | |
| 15 | Product/release readiness | Partial | CHANGELOG.md, ROADMAP.md, RELEASE_CHECKLIST.md, FINAL_READINESS_CHECKLIST.md present. PR #8 still Draft per branch state. | Manual product walkthrough | Walk a single full student → teacher → admin happy-path on staging with screen recordings. | |

## Latest Local Evidence (2026-05-06)

- Branch: `production-hardening-repo-audit`, based on pushed commit `9e46249`. Working tree adds:
  - `backend/src/repositories/admin-ops.repository.ts`
  - `backend/src/repositories/admin-ops.repository.spec.ts`
  - `backend/src/admin/admin.service.ts` (type-only `Set<string>` fix so backend build reflects branch state)
  - `src/app/pages/admin/Sections.tsx`
- `npm run typecheck`: **Pass**.
- `npm run build`: **Pass**.
- `npm run security:secrets`: **Pass**.
- `npm run check:release-hygiene`: **Pass**.
- `npm run check:smoke-env`: **Fail by design** in this shell, correctly listing all six missing `SMOKE_*` vars.
- `npm run e2e:responsive`: **Pass**, 24/24 tests in 26.9s.
- `npm run e2e:responsive:auth`: **Blocked** by missing `SMOKE_*` vars.
- `npm run e2e:smoke`: **Not run in this shell** because `check:smoke-env` fails first without credentials. Historical pushed-commit evidence remains: auth-smoke 5/5 PASS, portal-navigation 3/4 PASS, workflow-smoke not reached.
- `npm audit --audit-level=high` (frontend): **Pass**, 0 vulnerabilities.
- `npm --prefix backend run prisma:validate`: **Blocked** by missing `DATABASE_URL`.
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

## Defects surfaced by real smoke

These were real pre-existing defects surfaced by the earlier `9e46249` smoke run. They are now fixed locally but still need a post-fix authenticated rerun for proof.

1. **Backend: `AdminOpsRepository.syncLegacyAcademicYearLevels` unique-constraint violation.** Root cause was a non-atomic `findFirst(...mode: 'insensitive')` plus `create()` flow against `AcademicYearLevel @@unique([academicYearId, name])`. Local fix: `ensureAcademicYearLevel()` now uses composite-key `upsert` in `backend/src/repositories/admin-ops.repository.ts`; new `backend/src/repositories/admin-ops.repository.spec.ts` covers repeated calls.
2. **Frontend: nested `<button>` inside `<button>` in admin Sections drilldown.** Root cause was a clickable card button containing a nested delete button for year-level and section cards. Local fix: `src/app/pages/admin/Sections.tsx` now uses non-interactive containers with sibling action buttons, preserving valid semantics and visible keyboard focus.

## Current Verdict

**Conditional staging-ready.** Stronger than previous pass, but still not production-ready:

- Skip-green smoke is now structurally impossible (`scripts/check-smoke-env.mjs` is chained into `e2e:smoke`).
- The two smoke-found defects are patched locally with focused code changes and a new backend spec.
- Public auth responsive QA reran green locally (24/24).
- GitHub CI status has now been checked directly instead of assumed.

ProjTrack is still **not production-ready** because:

1. There is no post-fix real `e2e:smoke` rerun yet, so `portal-navigation` and `workflow-smoke` remain unverified after the fixes.
2. `Production Checks #4` and `CI #215` are failing on GitHub for pushed commit `9e46249`.
3. Backup-restore drill is unrun.
4. Monitoring alert evidence is unrecorded.
5. Launch signoff is empty.
6. Live RBAC and upload proof are still missing.

Do not promote to production until items 1–6 have real artifacts and GitHub `CI` plus `Production Checks` are green on the updated branch.
