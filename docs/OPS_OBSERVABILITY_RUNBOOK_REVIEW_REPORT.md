# Ops Observability / Runbook Review Report

**Date:** 2026-06-04
**Latest main SHA:** `ceae0b90193438cca4593a462e7a18576e8cfd25`

## 1. Executive Summary

This report documents the investigation of operational observability, health checking, monitoring runbook accuracy, backup/restore readiness, deployment smoke testing, Docker runtime safety, and CI/CD ops gating. The project demonstrates **exceptionally thorough documentation** with 30+ ops-related files, production-grade health check architecture, and end-to-end request ID propagation. Primary gaps are in runtime infrastructure configuration (Docker logging, ClamAV persistence, resource limits), documentation duplication (backup runbooks), and unwired tools (post-deploy smoke script, backup drill script).

**Final verdict:** B — OPS OBSERVABILITY READY WITH WATCHLIST

**Checks run:**
- Git baseline (branch, SHA, status, CI)
- Local build/tests (backend build, 287 unit, 229 security, Prisma validate, typecheck, 32 frontend)
- Health endpoint implementation (9 endpoints, rate-limit bypass, secret redaction)
- Request ID / log correlation (end-to-end, minus audit log gap)
- Structured logging consistency (mixed JSON vs ad-hoc)
- Error disclosure / stack trace containment
- Monitoring runbook accuracy (15 alert policies, status: NOT YET WIRED)
- Backup/restore runbook accuracy (duplicate/conflicting versions)
- Deployment smoke test coverage
- Docker/compose production configuration
- CI/CD workflow gating

## 2. Baseline Verification

| Check | Status |
|-------|--------|
| Git branch | `main` ✅ |
| HEAD SHA | `ceae0b90193438cca4593a462e7a18576e8cfd25` ✅ |
| git status | clean ✅ |
| CI (latest code-touching merge) | all success ✅ |
| CI (latest docs-only commit) | all success ✅ |
| Backend build | pass ✅ |
| Backend unit tests | 287/287 ✅ |
| Backend security tests | 229/229 ✅ |
| Prisma validate | valid ✅ |
| Root typecheck | pass ✅ |
| Frontend tests | 32/32 ✅ |

## 3. Health Checks

### Endpoints

| Route | Auth | Cost | Purpose | Dependencies Checked |
|-------|------|------|---------|---------------------|
| `GET /health` | Public | None (sync) | Root liveness | None |
| `GET /health/live` | Public | None (sync) | Docker HEALTHCHECK | None |
| `GET /health/ready` | Public | Expensive | Full readiness | DB + migration + storage + mail + config + backups |
| `GET /health/api-ready` | Public | Moderate | API readiness | DB + migration + storage + config |
| `GET /health/database` | Admin | Moderate | DB details | DB + migration |
| `GET /health/storage` | Admin | Moderate | Storage details | S3/Local read-write-delete probe |
| `GET /health/mail` | Admin | Expensive | Mail details | Transport + queue + worker heartbeat |
| `GET /health/backups` | Admin | Moderate | Backup details | Backup history + worker |
| `GET /health/configuration` | Admin | Cheap | Config validation | Env var validation |

### Strengths
- Rate-limit bypass for all `/health` paths (`main.ts:177-179`) — prevents cascading failures
- 503 on dependency failure (not 500) — correct for readiness/liveness semantics
- Migration status verified (queries `_prisma_migrations` for pending migrations)
- Secret redaction verified by security test (`health-redaction.spec.ts`)
- Database probe is a raw SQL query (`SELECT current_database()...`) — avoids ORM overhead
- Storage probe is real read-write-delete (both S3 and local), cleans up after itself
- Mail health is comprehensive (~18 queries, transport verification, worker heartbeat)

### Gaps
- **No ClamAV health endpoint** — ClamAV health is only checked via Docker `depends_on: condition: service_healthy` at startup. The health API does not surface ClamAV status. If ClamAV becomes unhealthy after startup, there is no signal.
- **Mail health is expensive** — ~18 queries + transport verification. Correctly skipped by `api-ready`, but could time out under heavy load.

## 4. Request ID / Logging

### Request ID Propagation

| Concern | Status | Details |
|---------|--------|---------|
| Accepted from header | ✅ | `main.ts:219` — reads `x-request-id` from incoming request |
| Generated if missing | ✅ | `randomUUID()` (backend), `crypto.randomUUID()` (frontend) |
| Returned in response | ✅ | `X-Request-Id` header set on success (`main.ts:227`) and errors (`http-exception.filter.ts:33`) |
| Frontend sends it | ✅ | Every request includes `X-Request-Id` header |
| Frontend appends to errors | ✅ | Error messages show `[request req-abc123]` — except login/invalid |
| Included in server logs | ✅ | `request.complete` and `request.error` events include `requestId` |
| CORS exposed | ✅ | `exposedHeaders: ['Content-Disposition', 'X-Request-Id']` |

### Gap: Audit Log Correlation

The `AuditLog` Prisma model and `AuditRecordCreateInput` have **no `requestId` field**. Audit entries capture `actorUserId`, `actorRole`, `ipAddress`, and `sessionId`, but there is no way to correlate an audit event with the specific HTTP request that triggered it. The `requestId` from `AsyncLocalStorage` is available during request processing but is never passed to `auditLog.record()`.

**Impact:** During incident investigation, you cannot trace "this HTTP request" → "this audit log entry". You must rely on timestamp + actor approximations.

### Structured Logging

| Concern | Status |
|---------|--------|
| Critical paths use structured JSON with `event` field | ✅ (exception filter, request lifecycle, mail worker events, monitoring) |
| Service-level logging | ❌ **Inconsistent** — most service-level code uses ad-hoc template literals with `key=value` embedded in unstructured text |
| Centralized logging library | ❌ **NestJS default Logger only** — no pino/winston, no transports, no log levels |
| Global PII/secret redaction | ❌ **Partial** — DB URL, mail tokens, health secrets are redacted. IP addresses logged as-is. No global redaction middleware. |

### Stack Trace / Error Disclosure

- Stack traces are **never returned to API clients** — correctly passed only as second argument to `Logger.error()`
- Error response shape: `{statusCode, error, message, requestId, timestamp, path}` — no `stack` field
- No backend environment-based distinction in error detail (same filter for dev/prod)
- Frontend has a production/development distinction for connectivity errors only (`backendUnavailableError`)
- `MonitoringService` accepts client error reports (including optional client stack) — stored in-memory buffer, logged server-side, readable by admins only

## 5. Monitoring Runbook

### Documents Inspected

| Document | Status | Notes |
|----------|--------|-------|
| `MONITORING_RUNBOOK.md` (root) | ✅ Accurate | 15 alert policies with thresholds. Status: NOT YET WIRED |
| `MONITORING_EVIDENCE.md` (docs/) | ❌ Stale | All fields marked "not yet" — contradicts release evidence |
| `INCIDENT_RESPONSE.md` | ✅ Accurate | SEV1-SEV4 matrix, first-hour checklist, 7 containment scenarios |
| `SECRET_LEAK_RESPONSE.md` | ✅ Accurate | Dedicated credential exposure runbook |
| `PRODUCTION_CHECK_FAILURE_RUNBOOK.md` | ✅ Accurate | CI failure triage guide |

### Alert Thresholds

15 documented alert policies in `MONITORING_RUNBOOK.md` including:
- `/health/live` 503: 2 consecutive failures → Page
- `/health/ready` 503: 5 consecutive failures → Page
- Frontend 5xx > 5% over 5 min → Page
- Mail queue > 100 sustained → Warning
- Backup last success > 25h → Page
- Droplet CPU > 85% → Warning, > 90% → Page
- Container restart > 3x/10min → Page

### Gaps
- **Monitoring NOT wired** — explicitly documented as prerequisite only. No real monitoring provider configured.
- **No incident drills conducted** — 8 required scenarios documented in `OPERATIONAL_READINESS.md`; none have evidence.
- **No named on-call rotation** — documented as TBD.
- **No SLA/SLO/RTO/RPO** — informal "2h DB restore / 4h storage restore" in stale doc only.
- **No capacity/auto-scaling plan** — single Droplet topology assumed.

## 6. Backup / Restore Runbook

### Documents Inspected

| Document | Status | Notes |
|----------|--------|-------|
| `BACKUP_RUNBOOK.md` (root, 104 lines) | ✅ Current | In-app backup system (worker, POST /admin/backups/run, SHA-256 artifacts, retention) |
| `docs/BACKUP_RUNBOOK.md` (157 lines) | ❌ **Duplicate/Conflicting** | Describes pg_dump + cron architecture that does not match current in-app system |
| `BACKUP_RESTORE_EVIDENCE.md` | ❌ Stale | All fields "not yet run" — contradicts release evidence |
| `release-evidence/2026-05-03/05-backup-drill.md` | ✅ Evidence | Real backup/restore drill PASSED against staging DB |

### Gap: Documentation Duplication

The root `BACKUP_RUNBOOK.md` (in-app backup worker with SHA-256 artifact verification, retention policy, `BackupRun` model, worker heartbeat) and `docs/BACKUP_RUNBOOK.md` (pg_dump + S3 cron job) describe **different architectures**. The `docs/` version is stale and contradictory. This is a documentation debt risk — if an operator follows the wrong version during an incident, they may attempt a pg_dump restore that does not match the actual backup format.

### Backup Worker Implementation

- In-app backup system with dedicated `backup-worker` container
- Artifact SHA-256 verification
- Retention policy (configurable)
- Backup schedule (`BACKUP_SCHEDULE_ENABLED`)
- Manual trigger via `POST /admin/backups/run`
- Health endpoint (`GET /health/backups`) surfaces last success, failure count, storage usage
- Worker heartbeat monitoring

## 7. Deployment Smoke Tests

### Documents and Scripts

| Resource | Coverage |
|----------|----------|
| `ci.yml` (e2e job) | 3 Playwright spec files, 3-attempt retry, responsive QA |
| `production-checks.yml` (smoke job) | Same 3 spec files + smoke env preflight guard |
| `scripts/post-deploy-smoke.mjs` | Checks login pages (admin/student/teacher), console errors, API destination, mobile layout |
| `scripts/verify-deploy.sh` | Checks repo HEAD, Docker state, container health, image revision, HTTP endpoints |
| `scripts/doctor-local.mjs` | Checks frontend/backend reachability, DB/storage/mail/ready health |
| `scripts/backend-doctor.mjs` | Checks Prisma, Docker, PostgreSQL, backend health, repair sequence |
| `DEPLOYMENT.md` | Post-deployment validation steps |
| `PRODUCTION_LAUNCH_RUNBOOK.md` | 15 post-deploy smoke checks |
| `PRODUCTION_CUTOVER_RUNBOOK.md` | Health endpoint verification + production smoke + first-hour monitoring |
| `PRODUCTION_QA_CHECKLIST.md` | Auth, admin, student, teacher, mail, storage, production QA |

### Gaps
- **`post-deploy-smoke.mjs` not wired into any workflow** — designed for manual execution only
- **`verify-deploy.sh` not wired into any workflow** — manual execution only
- **Backup/restore drill script not wired into CI** — manual-only
- **Smoke secrets not configured** — CI smoke jobs blocked by missing `SMOKE_ADMIN_IDENTIFIER`/`SMOKE_ADMIN_PASSWORD` repo secrets

## 8. Docker / Runtime Operations

### Dockerfile (`Dockerfile.backend`) — Strengths

| Feature | Status |
|---------|--------|
| Multi-stage build | ✅ 3 stages (builder, prod-deps, runner) |
| Base image | ✅ `node:20-alpine` |
| Non-root user | ✅ `projtrack` (UID 10001) |
| tini init | ✅ Entrypoint via `/sbin/tini --` |
| HEALTHCHECK | ✅ `GET /health/live` every 30s |
| OCI labels | ✅ `revision` and `source` |
| Port exposure | ✅ `3001` |
| Same image for worker | ✅ Documented, same image with `CMD ["node", "dist/worker.js"]` |

### Compose (`infra/docker-compose.production.yml`) — Strengths

| Feature | Status |
|---------|--------|
| Restart policies | ✅ `unless-stopped` on all services |
| Hard dependency conditions | ✅ `condition: service_healthy` on all chains |
| Worker healthchecks disabled | ✅ Correct for non-HTTP workers |
| API bound to loopback | ✅ `127.0.0.1:3001` (Caddy terminates TLS) |
| Service segregation | ✅ API, mail-worker, backup-worker, ClamAV as separate services |
| Env separation | ✅ Separate prod/staging/dev env file templates |

### Compose — Gaps

| ID | Issue | Severity | Recommendation |
|----|-------|----------|----------------|
| OPS2-001 | **No logging driver/rotation** in compose | Medium | Add `logging:` stanza with `max-size`/`max-file` to prevent log disk fill |
| OPS2-002 | **ClamAV no persistent volume** for virus DB | Medium | Map a named volume for `/var/lib/clamav` to avoid 120s+ re-download on restart |
| OPS2-003 | **No resource limits** (mem/cpu/pids) | Medium | Add `mem_limit`, `cpus` to all services |
| OPS2-004 | **Secrets via env file on disk** (not Docker secrets) | Low | Acceptable for single-Droplet topology; upgrade to Docker secrets if multi-node |
| OPS2-005 | **Volumes are host bind-mounts** (not named volumes) | Low | Acceptable for single host; migrate to named volumes if migrating to swarm/orch |
| OPS2-006 | **HEALTHCHECK endpoint mismatch** — Dockerfile uses `/health/live`, compose overrides to `/health/api-ready` | Low | Intentionally different endpoints, but silent mismatch could cause confusion |
| OPS2-007 | **Healthcheck retries mismatch** — Dockerfile 3, compose 5 | Low | Compose wins, but inconsistency could confuse debugging |
| OPS2-008 | **No staging compose file** | Low | Caddy configures staging routes (port 3002), but no `docker-compose.staging.yml` |

## 9. CI/CD Ops Gates

### Workflows

| Workflow | Trigger | Key Gates |
|----------|---------|-----------|
| `ci.yml` | push main/PR | Secret scan, typecheck, build, tests, Prisma validate, E2E smoke, responsive QA |
| `production-checks.yml` | PR → main | All CI gates + Docker build + smoke + failure notification |
| `production-candidate.yml` | push main/PR | Secret scan, build, tests, Prisma validate, Docker build |
| `evidence-gates.yml` | manual | Evidence report generation + issue commenting |
| `load-validation.yml` | manual | k6 load test + dataset seeding |
| `school-scale-validation.yml` | manual | Query-plan validation at scale tiers |

### Gaps

| ID | Issue | Severity |
|----|-------|----------|
| OPS2-009 | **No docs-only commit skip** — every PR triggers full pipeline | Low |
| OPS2-010 | **No Docker security scanning** (Trivy/Docker Scout) in any workflow | Low |
| OPS2-011 | **No concurrency/cancel-in-progress** on most workflows | Low |
| OPS2-012 | **GitHub smoke secrets not configured** — smoke env preflight fails in production-checks | Medium |

## 10. Findings Table

| ID | Title | Severity | Confidence | Affected Files | Recommendation |
|----|-------|----------|------------|----------------|----------------|
| OPS2-001 | No Docker logging driver configured | Medium | High | `infra/docker-compose.production.yml` | Add `logging:` stanza with `max-size: 10m`, `max-file: 3` |
| OPS2-002 | No persistent volume for ClamAV virus DB | Medium | High | `infra/docker-compose.production.yml` | Map named volume `/var/lib/clamav` |
| OPS2-003 | No resource limits on containers | Medium | High | `infra/docker-compose.production.yml` | Add `mem_limit: 512m`, `cpus: 1.0` to services |
| OPS2-004 | Duplicate/conflicting backup runbooks | Medium | High | `docs/BACKUP_RUNBOOK.md`, `BACKUP_RUNBOOK.md` | Remove or reconcile `docs/BACKUP_RUNBOOK.md` |
| OPS2-005 | Audit logs lack requestId correlation | Medium | High | `prisma/schema.prisma`, `audit-log.repository.ts` | Add `requestId` field to AuditLog model (needs migration) |
| OPS2-006 | Monitoring not wired (no real provider) | Medium | High | `MONITORING_RUNBOOK.md` | Documented as TBD — acknowledge as pre-provisioning state |
| OPS2-007 | No ClamAV health endpoint | Low | High | `health.service.ts` | Add `/health/clamav` endpoint |
| OPS2-008 | Inconsistent structured logging (ad-hoc service logs) | Low | High | All `backend/src/services/` | Standardize on structured JSON with `event` field |
| OPS2-009 | `post-deploy-smoke.mjs` not wired into CI | Low | High | `scripts/post-deploy-smoke.mjs` | Add to production-checks or -candidate workflow |
| OPS2-010 | GitHub smoke secrets not configured | Low | High | `.github/workflows/production-checks.yml` | Add `SMOKE_ADMIN_IDENTIFIER` / `SMOKE_ADMIN_PASSWORD` repo secrets |
| OPS2-011 | No docs-only commit skip in CI | Low | High | All `.github/workflows/*.yml` | Add `paths-ignore: ['docs/**', '*.md']` |
| OPS2-012 | No Docker image security scan | Low | Medium | `.github/workflows/production-checks.yml` | Add Trivy scan step |
| OPS2-013 | No incident drills conducted | Low | Medium | `OPERATIONAL_READINESS.md` | Schedule first tabletop exercise |

## 11. Watchlist

| Item | Status | Notes |
|------|--------|-------|
| **Production environment not provisioned** | BLOCKED | Scorecard confirms Droplet not created |
| **Real monitoring provider not configured** | ACCEPTED | Documented as pre-provisioning prerequisite |
| **Restore drill not executed against production** | ACCEPTED | Staging drill PASSED (2026-05-03); production drill blocked on env |
| **Smoke secrets not configured** | BLOCKED | Requires human action (repo secret setup) |
| **Alert thresholds not validated under load** | WATCHLIST | Load validation workflow exists but no results recorded |
| **Post-deploy smoke not automated** | WATCHLIST | Script exists, not wired into CI |
| **RTO/RPO not formally documented** | WATCHLIST | Informal only |
| **Capacity/auto-scaling not documented** | WATCHLIST | Single-Droplet topology is initial assumption |

## 12. Recommended Next PR Plan

If fixes are authorized:

1. **PR: docs(ops): reconcile backup runbook** — Remove or update `docs/BACKUP_RUNBOOK.md` to match the current in-app architecture. Low risk, high confidence.
2. **PR: fix(ops): add Docker compose logging and resource limits** — Update `docker-compose.production.yml` with `logging:` stanza, `mem_limit`, `cpus`, and ClamAV volume. Config-only, no code.
3. **PR: fix(ops): wire post-deploy smoke into CI** — Add `post-deploy-smoke.mjs` step to production-candidate workflow. Requires smoke secrets.

Code changes (audit log requestId, ClamAV health endpoint) are deferred to a future ops hardening round if needed.

## 13. Final Verdict

**B — OPS OBSERVABILITY READY WITH WATCHLIST**

The project has excellent ops documentation (30+ files), production-grade health check architecture (9 endpoints, rate-limit bypass, 503 semantics, migration verification, secret redaction), end-to-end request ID propagation, and comprehensive CI/CD gating. The primary gaps are in runtime configuration (Docker logging, resource limits, ClamAV persistence), document hygiene (duplicate backup runbook), and tools not wired into CI (post-deploy smoke, backup drill). None of these gaps block initial production deployment — they are medium-priority hardening items for the first maintenance cycle.

**Report path:** `docs/OPS_OBSERVABILITY_RUNBOOK_REVIEW_REPORT.md`
