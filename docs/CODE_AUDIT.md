# Code Audit

Branch: `2nd-main`  
Plan source: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-14

## Purpose

This file connects the hardening plan to real repository files. It is not a replacement for tests. It is the audit trail used to decide where tests, refactors, security controls, and performance fixes must land.

## Bootstrap

### Files to inspect

- `backend/src/main.ts`
- `backend/src/bootstrap/**`
- `backend/src/security/**`
- `backend/src/observability/**`

### Current audit status

Initial repository inspection found that bootstrap refactoring is a planned task, not verified complete. Do not split bootstrap code until tests around current security/runtime behavior exist.

### Required evidence

- Thin `main.ts`
- Focused bootstrap module
- Tests proving production runtime behavior remains intact
- Verification command recorded in `docs/2ND_MAIN_IMPROVEMENTS.md`

## CI/CD

### Files inspected

- `.github/workflows/ci.yml`
- `.github/workflows/production-checks.yml`
- `.github/workflows/production-candidate.yml`
- `package.json`
- `backend/package.json`
- `README.md`

### Findings

- Frontend scripts exist for `typecheck`, `build`, `security:secrets`, and `security:audit`.
- Backend scripts exist for `prisma:validate`, `prisma:generate`, `build`, `test`, and `test:unit`.
- `ci.yml` is already split into frontend, backend, and E2E jobs.
- Production workflows are verification gates, not direct production deploy workflows.
- README had placeholder local setup content and needed truth-audit correction.

### Required follow-up

- Add workflow summaries and failure visibility.
- Record current GitHub Actions run status in `docs/CI_STATUS.md`.
- Confirm branch-specific production-check badge behavior.

## Security

### Files to inspect

- `backend/src/**/*.controller.ts`
- `backend/src/**/*.service.ts`
- `backend/src/**/*.guard.ts`
- `backend/src/**/*.strategy.ts`
- `backend/src/security/**`
- `backend/src/files/**`
- `backend/src/storage/**`
- `backend/prisma/schema.prisma`

### Current audit status

Not complete. Security must be threat-driven before being called done.

### Required documents

- `docs/THREAT_MODEL.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SECURITY_CONTROL_MAPPING.md`
- `docs/SECURITY_TEST_PLAN.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/SECRETS_MANAGEMENT_CHECKLIST.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/SECRET_LEAK_RESPONSE.md`
- `docs/SUPPLY_CHAIN_SECURITY.md`
- `docs/VULNERABILITY_MANAGEMENT.md`

## Authorization

### Files to inspect

- Every backend controller route
- Guards and decorators
- Service-level ownership checks
- File signing/download code
- Admin-only endpoints

### Current audit status

Not complete. The missing artifact is `docs/AUTHORIZATION_MATRIX.md`.

### Required route classifications

- Public
- Authenticated
- Owner-only
- Role-restricted
- Admin-only
- System-only

### Required abuse checks

- Anonymous user receives 401 where required.
- Wrong role receives 403.
- Wrong owner receives 403 or safe 404.
- Correct owner succeeds.
- Admin succeeds only where intended.

## Testing

### Files to inspect

- `backend/test/**`
- `backend/jest*.config.*`
- `tests/e2e/**`
- `playwright*.config.*`
- `package.json`
- `backend/package.json`

### Current audit status

Not complete. Scripts exist, but critical-path coverage must be proven with evidence.

### Required proof

- Auth abuse tests
- Session abuse tests
- Authorization abuse tests
- Unit tests for auth, project, task, role/permission, ownership, and runtime config
- Integration tests for login/project/task/unauthorized/role-restricted paths
- E2E tests that assert outcomes, not only page visits

## Storage

### Files to inspect

- `backend/src/files/**`
- `backend/src/storage/**`
- Object storage provider configuration
- Upload/download/signing routes

### Current audit status

Not complete. The plan requires S3-compatible object storage hardening, not just MinIO-specific notes.

### Required proof

- Private bucket only
- Signed URLs only
- Short TTL
- Ownership check before signing/downloading
- MIME allowlist
- Size limits
- Dangerous extension rejection
- Malware scanning behavior defined
- Local storage rejected in production

## Database

### Files to inspect

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**`
- Service query patterns

### Current audit status

Not complete.

### Required proof

- Migration safety checklist exists
- Rollback strategy exists
- Indexes match common query patterns
- Destructive migration risk is documented before production

## Performance

### Files to inspect

- `backend/src/**/*.service.ts`
- `backend/src/**/*.controller.ts`
- `backend/prisma/schema.prisma`

### Current audit status

Not complete.

### High-risk patterns to eliminate

- `findMany()` without pagination or ownership filters
- Large unbounded `include` graphs
- `await` database calls inside loops
- Unlimited admin lists or exports
- External calls without timeouts
- Expensive routes without rate limits

### Required verification commands

```bash
grep -R "findMany({\|findMany()" backend/src
grep -R "for .*await\|forEach(async\|map(async" backend/src
npm --prefix backend run prisma:validate
```

## Operations

### Files to inspect

- Health controllers/modules
- Request logging middleware
- Error filters
- Runtime config checks
- Backup/worker scripts

### Current audit status

Not complete.

### Required proof

- `/health/live` checks process liveness only
- `/health/ready` checks dependencies and returns 503 on dependency failure
- Sensitive health/config details protected
- Request IDs included in logs and error responses
- Rollback strategy documented
- Monitoring/alert destinations documented

## Documentation

### Files inspected or required

- `README.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- `docs/FINAL_MERGE_GATE.md`
- `docs/CI_STATUS.md`
- All security/testing/ops/performance/load evidence docs

### Current audit status

In progress. README truth audit started. Final docs are not complete until every gate has evidence.

## Open blockers

1. No threat model yet.
2. No authorization matrix yet.
3. No final merge gate evidence yet.
4. No security acceptance gate yet.
5. No load test plan or load scripts yet.
6. No complete performance query audit yet.
7. CI failure visibility is not yet implemented.
