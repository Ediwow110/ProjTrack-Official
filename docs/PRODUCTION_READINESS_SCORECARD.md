# Production Readiness Scorecard

This scorecard records proof, not intent. Do not mark a category `Pass` unless the evidence is attached or reproducible from the listed command.

| Category | Status | Evidence | Command or manual test | Remaining action | Owner/signoff |
| --- | --- | --- | --- | --- | --- |
| Build and typecheck | Pass | Frontend typecheck/build passed locally on `production-hardening-repo-audit`. | `npm run typecheck`; `npm run build` | Confirm GitHub CI after push. | |
| Backend tests | Pass | Backend hardening checks and Jest unit tests passed locally. | `npm --prefix backend test`; `npm --prefix backend run test:unit` | Confirm GitHub CI after push. | |
| Prisma/database | Partial | Prisma schema validates and client generates; live local PostgreSQL was not reachable because Docker daemon was unavailable. | `npm --prefix backend run prisma:validate`; `npm --prefix backend run prisma:generate`; `npm run check:smoke-deps` | Start Docker Desktop, run `npm run prepare:local`, rerun E2E smoke. | |
| E2E smoke | Blocked | Browser smoke failed before tests because backend could not reach PostgreSQL at `localhost:5432`. | `npm run e2e:smoke` | Bring up local/staging PostgreSQL and rerun. | |
| Responsive QA | Partial | Auth pages passed automated checks at all required sizes; authenticated dashboards remain unverified. | `npm run e2e:responsive`; manual role dashboard QA | Run authenticated admin/teacher/student QA with seeded or staging accounts. | |
| Auth/RBAC security | Partial | Backend test suite includes auth/RBAC coverage, but staging real-account evidence is still missing. | `npm --prefix backend run test:unit`; staging real-account smoke | Run staging smoke with admin, teacher, and student accounts. | |
| Upload security | Partial | Unit coverage exists for upload safety; real object-storage and malware-scanner path still needs staging proof. | `npm --prefix backend run test:unit`; storage/malware staging smoke | Run upload smoke with valid, oversized, invalid MIME, and scanner-failure cases. | |
| CI/CD | Partial | Workflows and local checks exist; latest GitHub CI result is not verified in this environment. | GitHub Actions for PR #8 | Wait for GitHub checks after push and attach run link. | |
| Monitoring | Blocked | Monitoring evidence template exists but no alert test evidence is recorded. | Manual alert test | Configure checks and attach alert proof. | |
| Backup/restore | Blocked | Backup/restore evidence template exists but no completed restore drill is recorded. | `npm --prefix backend run drill:backup-restore` against safe staging/disposable target | Complete restore drill and record RPO/RTO. | |
| Incident response | Partial | Incident response runbook exists; no rehearsal evidence is attached. | Tabletop or timed incident drill | Record incident drill result and owner signoff. | |
| Launch signoff | Blocked | Signoff template exists but no dated approvals are recorded. | Manual launch signoff | Complete after CI, smoke, backup, monitoring, and QA pass. | |
| UX/accessibility | Partial | Auth motion removed and shared responsive primitives improved; authenticated role pages still need manual accessibility/responsive QA. | `npm run e2e:responsive`; manual keyboard/screen-size QA | Test role dashboards and forms on target viewports. | |
| Documentation | Partial | README, smoke docs, evidence templates, checklist, roadmap, and changelog exist. | Documentation review | Keep scorecard updated with real links/results before release. | |

## Latest Local Evidence

- Branch: `production-hardening-repo-audit`
- Responsive merge commit included: `9cca85bdccb73874094ae67ddc3cbd5474eb5d8d`
- `npm run e2e:responsive`: Pass, 24 tests.
- `npm run e2e:smoke`: Blocked, PostgreSQL unreachable at `localhost:5432`.
- `npm run prepare:local`: Blocked, Docker daemon unavailable at `dockerDesktopLinuxEngine`.

## Current Verdict

Conditional staging-ready only. ProjTrack is not production-ready until database-backed smoke, authenticated responsive QA, GitHub CI, staging smoke evidence, backup restore evidence, monitoring evidence, and launch signoff are complete.
