# 2nd-Main Branch Improvement Tracker

Branch target: `2nd-main`  
Plan version: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-14

## Non-negotiable execution rule

All hardening work happens on `2nd-main`. Do not merge to `main` until `docs/FINAL_MERGE_GATE.md` is complete and every blocking gate is verified.

## Evidence rule

A task is not done because a file exists. A task is done only when code or documentation exists on `2nd-main`, the related test or verification command passes, and the evidence is recorded here or in the linked evidence document.

## Status values

- Not Started
- In Progress
- Blocked
- Done
- Verified

## Gate summary

| Gate | Blocks merge? | Evidence document | Current status |
|---|---:|---|---|
| CI-GATE | Yes | `docs/CI_STATUS.md` | In Progress |
| SEC-GATE | Yes | `docs/SECURITY_REVIEW.md`, `docs/SECURITY_ACCEPTANCE_GATE.md` | Not Started |
| AUTHZ-GATE | Yes | `docs/AUTHORIZATION_MATRIX.md` | Not Started |
| TEST-GATE | Yes | `docs/TESTING_STRATEGY.md` | Not Started |
| OPS-GATE | Yes | `docs/OPERATIONAL_READINESS.md` | Not Started |
| PERF-GATE | Yes | `docs/CODE_AUDIT.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | In Progress |
| LOAD-GATE | Before production | `docs/LOAD_TEST_PLAN.md` | Not Started |
| DOC-GATE | Yes | This tracker and final docs | In Progress |

## Task tracker

### CTRL-01 Create master tracker
Status: Done  
Priority: Critical  
Files to inspect: `docs/2ND_MAIN_IMPROVEMENTS.md`  
Files changed: `docs/2ND_MAIN_IMPROVEMENTS.md`  
Tests to add: None  
Verification command: `test -f docs/2ND_MAIN_IMPROVEMENTS.md`  
Evidence document: `docs/2ND_MAIN_IMPROVEMENTS.md`  
Merge blocker: Yes  
Notes: Replaced optimistic progress claims with evidence-based task status.

### CTRL-02 Create code audit
Status: Done  
Priority: Critical  
Files to inspect: `README.md`, `package.json`, `backend/package.json`, `.github/workflows/*.yml`, `backend/src/**`, `backend/prisma/schema.prisma`  
Files changed: `docs/CODE_AUDIT.md`  
Tests to add: None  
Verification command: `test -f docs/CODE_AUDIT.md`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes  
Notes: Initial audit file created. Deeper route/service/storage/performance mapping remains open.

### CTRL-03 Create final gate checklist
Status: Done  
Priority: Critical  
Files to inspect: Master plan, CI workflows, evidence docs  
Files changed: `docs/FINAL_MERGE_GATE.md`  
Tests to add: None  
Verification command: `test -f docs/FINAL_MERGE_GATE.md`  
Evidence document: `docs/FINAL_MERGE_GATE.md`  
Merge blocker: Yes  
Notes: Final gate checklist now exists and defaults to unchecked blockers.

### CI-01 Verify README workflow badges
Status: Done  
Priority: Critical  
Files to inspect: `README.md`, `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`  
Files changed: `README.md`, `docs/CI_STATUS.md`  
Tests to add: None  
Verification command: `grep -q 'branch=2nd-main' README.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: README badges point at `2nd-main`; README now avoids production-ready claims.

### CI-02 Harden ci.yml
Status: In Progress  
Priority: Critical  
Files to inspect: `.github/workflows/ci.yml`, `package.json`, `backend/package.json`  
Files to change: `.github/workflows/ci.yml` if verification shows gaps  
Tests to add: None  
Verification command: `npm ci && npm run typecheck && npm run build && npm run security:secrets && npm --prefix backend ci && npm --prefix backend run prisma:validate && npm --prefix backend run prisma:generate && npm --prefix backend run build && npm --prefix backend run test`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: Existing CI already has frontend, backend, and E2E jobs. Needs live run evidence and summary/failure visibility.

### CI-03 Review production workflows
Status: In Progress  
Priority: Critical  
Files to inspect: `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`  
Files to change: `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml` if review finds unsafe triggers or missing gates  
Tests to add: None  
Verification command: `grep -R "workflow_dispatch\|pull_request\|push" .github/workflows/production-checks.yml .github/workflows/production-candidate.yml`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: Initial review recorded. Production checks are gate-style workflows, not deployment workflows, but live status still required.

### CI-04 Add CI failure visibility
Status: Not Started  
Priority: High  
Files to inspect: `.github/workflows/*.yml`  
Files to change: `.github/workflows/*.yml`  
Tests to add: None  
Verification command: `grep -R "GITHUB_STEP_SUMMARY\|actions/github-script\|slack\|discord\|mail" .github/workflows`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Before production  
Notes: Must add workflow summaries and production-check failure notification.

### CI-05 Create CI status document
Status: Done  
Priority: Critical  
Files to inspect: `.github/workflows/*.yml`, `package.json`, `backend/package.json`  
Files changed: `docs/CI_STATUS.md`  
Tests to add: None  
Verification command: `test -f docs/CI_STATUS.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: Initial status doc created.

### SEC-01 Create threat model
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**`, `backend/prisma/schema.prisma`, auth, file upload, storage, mail, CI secrets  
Files to change: `docs/THREAT_MODEL.md`  
Tests to add: Security regression tests based on abuse cases  
Verification command: `test -f docs/THREAT_MODEL.md`  
Evidence document: `docs/THREAT_MODEL.md`  
Merge blocker: Yes  
Notes: Do not claim cybersecurity-level assurance until this exists.

### SEC-02 Create authorization matrix
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**/*.controller.ts`, `backend/src/**/*.guard.ts`, `backend/src/**/*.service.ts`  
Files to change: `docs/AUTHORIZATION_MATRIX.md`  
Tests to add: 401/403/safe-404 route abuse tests  
Verification command: `test -f docs/AUTHORIZATION_MATRIX.md`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: This is the highest-risk missing artifact.

### TEST-01 Backend unit tests
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**/*.service.ts`, `backend/test/**`, `backend/package.json`  
Files to change: `backend/test/**`  
Tests to add: Auth service, project service, task service, role/permission logic, ownership checks, runtime config validation  
Verification command: `npm --prefix backend run test:unit`  
Evidence document: `docs/TESTING_STRATEGY.md`  
Merge blocker: Yes  
Notes: Existing script exists; coverage of critical paths still must be proven.

### OPS-01 Structured logging and request IDs
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/main.ts`, `backend/src/**/middleware*.ts`, `backend/src/**/filter*.ts`  
Files to change: Backend observability modules and `docs/OPERATIONAL_READINESS.md`  
Tests to add: Request ID propagation/error response tests  
Verification command: `npm --prefix backend run test:unit -- --runInBand`  
Evidence document: `docs/OPERATIONAL_READINESS.md`  
Merge blocker: Yes  
Notes: Must prove IDs appear in logs and safe error responses.

### PERF-01 Audit unbounded queries
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**/*.service.ts`, `backend/src/**/*.controller.ts`  
Files to change: Services/controllers with unbounded list queries  
Tests to add: Pagination limit and ownership tests  
Verification command: `grep -R "findMany({\|findMany()" backend/src`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes  
Notes: No user-load claim is valid until this audit is complete.

### LOAD-01 Create load test plan
Status: Not Started  
Priority: High  
Files to inspect: Critical user flows, auth, dashboard, project/task pages, file upload, admin reports  
Files to change: `docs/LOAD_TEST_PLAN.md`  
Tests to add: `load-tests/*.js` in later tasks  
Verification command: `test -f docs/LOAD_TEST_PLAN.md`  
Evidence document: `docs/LOAD_TEST_PLAN.md`  
Merge blocker: Before production  
Notes: Do not claim 300-500 online users until realistic load tests exist.

### DOC-01 README truth audit
Status: Done  
Priority: Critical  
Files to inspect: `README.md`, evidence docs  
Files changed: `README.md`  
Tests to add: None  
Verification command: `grep -Ei "production-ready|fully secure|fully tested|complete|deployment-ready" README.md || true`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: README now states current branch-hardening status instead of pretending completion.

## Immediate next blockers

1. Build `docs/THREAT_MODEL.md` from real backend routes, assets, trust boundaries, and abuse cases.
2. Build `docs/AUTHORIZATION_MATRIX.md` by enumerating backend controllers and guards.
3. Add CI failure summaries/notifications.
4. Run or inspect current GitHub Actions results for `2nd-main` and record evidence.
5. Audit unbounded Prisma queries before any scale/load claim.
