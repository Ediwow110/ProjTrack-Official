# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

Last refreshed: 2026-05-06 04:35 UTC+08:00 on local Windows host (Docker Desktop 29.4.1, Node 22.22.2, npm 10.9.7), branch `production-hardening-repo-audit` at commit `1b18739`.

| # | Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build and typecheck | Pass | Frontend typecheck and Vite production build both finished cleanly on this branch (built in 7.63s, 0 type errors). | `npm run typecheck`; `npm run build` | Confirm GitHub CI after push. | |
| 2 | Backend tests | Pass | `npm --prefix backend test` (production-hardening-checks) and `npm --prefix backend run test:unit` (Jest, 15 suites / 264 tests) both passed. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Confirm GitHub CI after push. | |
| 3 | Prisma/database | Pass (local) | `prisma validate` reports schema valid; `prisma generate` succeeds; `prisma migrate deploy` applied 19 migrations including the 3 newest (`add_department_table`, `add_course_layer`, `backup_settings_json`). Local PostgreSQL 16 reachable at `127.0.0.1:5432` via `projtrack-postgres` container. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npx prisma migrate deploy` | Repeat in staging before launch. | |
| 4 | E2E smoke | **Blocked (skipped)** | `npm run e2e:smoke` exits 0 but **all 13 tests skip** because `SMOKE_{STUDENT,TEACHER,ADMIN}_IDENTIFIER`/`_PASSWORD` env vars are not set and the repo only ships `ensure-smoke-admin.js` (no student/teacher seed). Skipped is **not** a pass. | `npm run e2e:smoke` | Provision local/staging student & teacher test accounts (or add a seed script), set the six `SMOKE_*` env vars, rerun. | |
| 5 | Responsive QA | Partial | `npm run e2e:responsive` passed 24/24 tests across 8 viewports (360x800, 390x844, 430x932, 768x1024, 1024x768, 1366x768, 1440x900, 1920x1080) for `/student/login`, `/teacher/login`, `/admin/login`. Authenticated admin/teacher/student dashboards remain unproven (gated by the same missing seed accounts as Smoke). | `npm run e2e:responsive`; manual role dashboard QA | Run authenticated admin/teacher/student QA with seeded or staging accounts and add an authenticated-routes responsive spec. | |
| 6 | Auth/RBAC security | Partial | Jest covers auth/session/JWT/guard/password (`session-cookie`, `token.service`, `jwt-auth.guard`, `auth-session.service`, `password.service`, `mail-environment.guard`, `runtime-safety` all green); staging real-account RBAC walk has not been executed in this session. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts; record cross-tenant denial proof. | |
| 7 | Upload security | Partial | `files.service.spec.ts` and `storage.config.spec.ts` cover upload validation, MIME, malware-scan modes, and S3/local switching. No live malware-scanner path or oversized-upload run has been recorded against staging. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases against staging. | |
| 8 | CI/CD | Partial | Three workflows present (`ci.yml`, `production-checks.yml`, `production-candidate.yml`) covering frontend typecheck/build/audit, backend prisma+tests+boot+audit, Playwright smoke. Frontend job in `ci.yml` now also runs `e2e:responsive`. **Risk:** smoke jobs in CI silently no-op when `SMOKE_*` repo secrets are absent (same skip behavior as local). GitHub Actions run status not verified from this environment (no `gh` CLI). | GitHub Actions for PR #8 | Verify the run on GitHub after push. Set repository secrets `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, plus student/teacher equivalents, OR mark smoke jobs `continue-on-error: false` only after seeds exist. | |
| 9 | Monitoring | Blocked | Template exists (`docs/MONITORING_EVIDENCE.md`); no alert-test evidence recorded. | Manual alert test | Configure liveness/readiness/queue/backup alerts in your provider, fire each, and paste the alert payload + ack timestamps. | |
| 10 | Backup/restore | Blocked | Template exists (`docs/BACKUP_RESTORE_EVIDENCE.md`); no completed drill recorded. `drill:backup-restore` script is present but unrun in this environment. | `npm --prefix backend run drill:backup-restore` against a safe disposable target | Run drill end-to-end, record source DB size, dump time, restore time, integrity verification, RPO/RTO. | |
| 11 | Incident response | Partial | `docs/INCIDENT_RESPONSE.md` runbook exists; no rehearsal evidence attached. | Tabletop or timed incident drill | Record drill result, owner signoff, time-to-detect, time-to-mitigate. | |
| 12 | Launch signoff | Blocked | Template exists (`docs/PRODUCTION_LAUNCH_SIGNOFF.md`); no dated approvals. | Manual launch signoff | Complete after #4, #9, #10, #11 are real. | |
| 13 | UX/accessibility | Partial | Auth pages: motion removed, no body-level horizontal overflow at any of the 8 target viewports (24/24 automated). Authenticated dashboards (admin/teacher/student) not exercised this session. | `npm run e2e:responsive`; manual keyboard/screen-size QA | Test role dashboards and forms on target viewports; run an axe pass on at least the dashboard, list, modal, and form patterns. | |
| 14 | Documentation | Partial | README, scorecard, smoke runbook, evidence templates, deployment + DigitalOcean + Vercel + backup + monitoring + incident runbooks, role-access doc, release checklist all present. Scorecard updated this run; smoke + backup + monitoring evidence still empty by design (real evidence required). | Documentation review | Fill smoke/backup/monitoring evidence templates only with real results, never placeholders. | |
| 15 | Product/release readiness | Partial | CHANGELOG.md, ROADMAP.md, RELEASE_CHECKLIST.md, FINAL_READINESS_CHECKLIST.md present. PR #8 still Draft per branch state. | Manual product walkthrough | Walk a single full student → teacher → admin happy-path on staging with screen recordings. | |

## Latest Local Evidence (2026-05-06)

- Branch: `production-hardening-repo-audit`, HEAD: `1b18739` (matches `origin/production-hardening-repo-audit` before this scorecard update).
- Local infra: Docker Desktop running; containers `projtrack-postgres` (5432) and `projtrack-minio` (9000-9001) up.
- `npm run typecheck`: **Pass**.
- `npm run build`: **Pass** (7.63s, all chunks emitted).
- `npm run security:secrets`: **Pass** ("Secret scan passed.").
- `npm run check:release-hygiene`: **Pass** ("Release hygiene check passed.").
- `npm run check:smoke-deps`: **Pass** (Docker CLI, Compose, daemon, compose file, PG @ 127.0.0.1:5432 all reachable).
- `npm run e2e:responsive`: **Pass**, 24/24 tests in 27.4s.
- `npm run e2e:smoke`: **Blocked (skipped)** — 13/13 tests skipped, no real assertions ran. Cause: missing `SMOKE_STUDENT_*`, `SMOKE_TEACHER_*`, `SMOKE_ADMIN_*` env vars; no student/teacher seed script in repo.
- `npm audit --audit-level=high` (frontend): **Pass**, 0 vulnerabilities.
- `npm --prefix backend run prisma:validate`: **Pass**.
- `npm --prefix backend run prisma:generate`: **Pass**.
- `npx prisma migrate deploy`: **Pass**, 19 migrations applied, 3 new since previous run.
- `npm --prefix backend run build`: **Pass** (288 dist files emitted).
- `npm --prefix backend run check:boot:production`: **Pass** ("Production boot check passed.").
- `npm --prefix backend run check:boot:worker`: **Pass** ("Worker boot check passed.").
- `npm --prefix backend test`: **Pass** ("Production hardening checks passed.").
- `npm --prefix backend run test:unit`: **Pass**, 15 suites, 264 tests, 25.0s.
- `npm --prefix backend audit --audit-level=high`: **Pass**, 0 vulnerabilities.

## Current Verdict

**Conditional staging-ready.** Build, type, lint-equivalent hygiene, secret scan, audits, backend unit + hardening tests, boot checks, prisma, and auth-only responsive tests are all green and reproducible. ProjTrack is **not** production-ready because:

1. E2E smoke produces no real evidence (all tests skip without seeded student/teacher credentials).
2. Authenticated admin/teacher/student responsive QA has no evidence.
3. Backup-restore drill is unrun.
4. Monitoring alert evidence is unrecorded.
5. Launch signoff is empty.
6. GitHub CI status for the latest push is not verified from this environment.

Do not promote to production until items 1–5 have real artifacts and item 6 shows a green run on GitHub.
