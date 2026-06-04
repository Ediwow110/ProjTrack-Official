# OPS2 Low-Severity Triage Report

## 1. Executive Summary

- **Date:** 2026-06-04
- **Latest main SHA:** `8a80cff01de4deb0dd8dd11d58e86c9b704452c5`
- **Final verdict:** B — OPS LOW-SEVERITY TRIAGE COMPLETE WITH WATCHLIST

| Category | Count |
|----------|-------|
| Already resolved (A) | 0 |
| Not a bug (B) | 0 |
| Watchlist only (C) | 2 |
| Docs-only fix recommended (D) | 0 |
| Focused code/config fix recommended (E) | 2 |
| Blocked by environment/provider (F) | 3 |

**Summary:** Of 7 remaining low-severity findings, 2 belong on the permanent
watchlist (structured logging, Docker security scan), 2 could justify a focused
PR but are not urgent (ClamAV endpoint, docs-only CI skip), and 3 are blocked
by environment or GitHub configuration that requires human operator action
(smoke secrets, CI wiring, incident drills). No docs-only batch is warranted.

## 2. Baseline Verification

| Check | Result |
|-------|--------|
| Branch | `main` |
| HEAD | `8a80cff` |
| Git status | clean |
| CI (HEAD `8a80cff`) | CI: success, Production Candidate Verification: success |
| Backend build | PASS |
| Unit tests | 287/287 PASS |
| Security tests | 233/233 PASS |
| Prisma validate | PASS |

## 3. Completed Medium Findings

| ID | Title | Status |
|----|-------|--------|
| OPS2-001 | Docker log rotation | Complete (PR #164) |
| OPS2-002 | ClamAV DB volume | Complete (PR #165) |
| OPS2-003 | Container resource limits | Complete (PR #166) |
| OPS2-004 | Backup runbook consolidation | Complete (PR #167) |
| OPS2-005 | Audit requestId correlation | Complete (PR #168) |
| OPS2-006 | Monitoring wiring runbook | Complete (PR #169) |

## 4. Low-Severity Triage Table

### OPS2-007 — No ClamAV health endpoint

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Add `/health/clamav` endpoint in `health.service.ts` |
| **Current state** | No `/health/clamav` endpoint exists. ClamAV is checked at boot by `runtime-safety.ts` and via Docker `depends_on: condition: service_healthy`, but if ClamAV dies after startup there is no health signal. The `files.service.ts` uses ClamAV for malware scanning but does not expose its availability through the health API. |
| **Still valid?** | Yes |
| **Classification** | E — Focused code/config fix recommended |
| **Assessment** | Adding a `/health/clamav` endpoint is well-scoped: inject ClamAV host/port config into `health.service.ts`, perform a TCP connect check, surface result under admin-protected route. Low risk. No staging provider required for unit testing. |
| **Recommendation** | Defer to a future focused PR. Not urgent — ClamAV failing after startup causes file scans to fail-open (depending on `FILE_MALWARE_SCAN_MODE`) but does not crash the API. |

### OPS2-008 — Inconsistent structured logging

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Standardize service-level logging on structured JSON with `event` field |
| **Current state** | Critical paths (exception filter, request lifecycle, mail worker, monitoring) use structured JSON with `event` fields. Most service-level code uses ad-hoc template literals (e.g., `this.logger.warn('some string')` in `backups.service.ts`). No centralized logging library (NestJS default Logger only). |
| **Still valid?** | Yes |
| **Classification** | C — Watchlist only |
| **Assessment** | This is a large refactoring effort touching every service file. No single file can be fixed in isolation without creating inconsistency. Not suitable for a quick docs or config fix. |
| **Recommendation** | No action. Watchlist as ongoing improvement for the next major hardening round. |

### OPS2-009 — post-deploy-smoke.mjs not wired into CI

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Add to production-checks or -candidate workflow |
| **Current state** | Script exists at `scripts/post-deploy-smoke.mjs`. Now documented in `MONITORING_RUNBOOK.md` (Post-deploy verification section, added by OPS2-006) with purpose, env vars, and when-to-run guidance. |
| **Still valid?** | Partially — documentation gap closed, but CI wiring gap remains |
| **Classification** | F — Blocked by environment |
| **Assessment** | Wiring into CI requires: (1) workflow change, (2) `SMOKE_TARGET_HOST` and `SMOKE_EXPECTED_API_HOST` env vars, (3) smoke accounts on the target environment. Cannot be meaningfully wired until staging/production is deployed. |
| **Recommendation** | Defer until staging deployment. Monitoring runbook now provides manual execution guidance. |

### OPS2-010 — GitHub smoke secrets not configured

| Field | Value |
|-------|-------|
| **Original severity** | Low (Medium in CI/CD gates section of review) |
| **Original recommendation** | Add `SMOKE_ADMIN_IDENTIFIER` / `SMOKE_ADMIN_PASSWORD` repo secrets |
| **Current state** | Workflows reference `${{ secrets.SMOKE_ADMIN_IDENTIFIER }}` and `${{ secrets.SMOKE_ADMIN_PASSWORD }}` with graceful degration — `ci.yml` guards smoke steps with `if: env.SMOKE_ADMIN_IDENTIFIER != ''`. Seats exist, values do not. |
| **Still valid?** | Yes |
| **Classification** | F — Blocked by environment (requires GitHub repo admin UI) |
| **Assessment** | This is a GitHub repository configuration action, not a code change. Requires a human with repo admin access to create the secrets in the GitHub UI. |
| **Recommendation** | Add to production operator launch checklist. Cannot be automated. |

### OPS2-011 — No docs-only commit skip in CI

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Add `paths-ignore: ['docs/**', '*.md']` to all workflows |
| **Current state** | No `paths-ignore` in any of the 7 workflow files (confirmed in `ci.yml`). `production-checks.yml` already has `concurrency` with `cancel-in-progress: true`, which provides partial optimization. |
| **Still valid?** | Yes |
| **Classification** | E — Focused code/config fix recommended |
| **Assessment** | Adding `paths-ignore` to all 7 workflow files would save CI minutes on docs-only commits. Low risk, well-understood change. However, even without it, docs-only commits typically pass CI quickly. |
| **Recommendation** | Could be a focused docs+CI PR. Defer — low priority optimization. |

### OPS2-012 — No Docker image security scan

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Add Trivy scan step to production-checks or -candidate workflow |
| **Current state** | No Docker image security scanning (Trivy, Docker Scout, etc.) in any workflow. Build uses `node:20-alpine` base image with multi-stage build. |
| **Still valid?** | Yes |
| **Classification** | C — Watchlist only |
| **Assessment** | Trivy is a valuable hardening step for production supply-chain security but is not blocking. Adding it would add ~30–60s per CI run and requires no credentials. However, it has no dependency on staging deployment. |
| **Recommendation** | No action. Watchlist as a future hardening item. Can be implemented independently at any time. |

### OPS2-013 — No incident drills conducted

| Field | Value |
|-------|-------|
| **Original severity** | Low |
| **Original recommendation** | Schedule first tabletop exercise |
| **Current state** | `docs/OPERATIONAL_READINESS.md` documents 8 required drill scenarios (production-check failure, secret leak, DB migration failure, file-storage outage, mail outage, 5xx incident, DB saturation, backup restore). None have been conducted or recorded. |
| **Still valid?** | Yes |
| **Classification** | F — Blocked by environment |
| **Assessment** | Incident drills require a running staging environment to be meaningful. Cannot execute drills until staging is deployed and monitoring is partially wired. |
| **Recommendation** | Defer until staging deployment. Add to production launch runbook as pre-launch requirement. |

## 5. Remaining Watchlist

| Item | Status | Notes |
|------|--------|-------|
| Production environment not provisioned | BLOCKED | No Droplet, DNS, or env file |
| Real monitoring provider not configured | BLOCKED | Documented prerequisite |
| Restore drill not executed against production | DEFERRED | Staging drill PASSED (2026-05-03) |
| Smoke secrets not configured | BLOCKED | Requires human in GitHub UI |
| Alert thresholds not validated under load | WATCHLIST | Load validation workflow exists |
| Post-deploy smoke not automated | WATCHLIST | Documented in MONITORING_RUNBOOK.md |
| RTO/RPO not formally documented | WATCHLIST | Informal only |
| Capacity/auto-scaling not documented | WATCHLIST | Single-Droplet topology assumed |
| ClamAV health endpoint not implemented | DEFERRED | Focused code fix available |
| Structured logging not standardized | WATCHLIST | Major refactoring effort |
| Incident drills not conducted | DEFERRED | Blocked on staging environment |
| Docker security scan not configured | WATCHLIST | Nice-to-have hardening |

## 6. Fix Plan

### Docs-only batch
None recommended. The documentation gaps for the low-severity findings were
already addressed by OPS2-006 (MONITORING_RUNBOOK.md now references
`post-deploy-smoke.mjs`, `verify-deploy.sh`, and related runbooks).

### Focused code/config fix
Two items could justify a focused PR each, but neither is urgent:

1. **OPS2-007 (ClamAV health endpoint):** Add `/health/clamav` to
   `health.service.ts` + `health.controller.ts` + security tests.
   ~30–50 lines of code. Well-scoped.
2. **OPS2-011 (docs-only CI skip):** Add `paths-ignore` to all 7 workflow
   files. ~20 lines of YAML. Low risk.

These should be deferred to a future ops hardening round.

### Future issue
- OPS2-013 (incident drills) — create GitHub issue when staging is deployed
- OPS2-010 (smoke secrets) — add to production launch checklist

### No action
- OPS2-008 (structured logging) — permanent watchlist
- OPS2-012 (Docker security scan) — permanent watchlist
- OPS2-009 (post-deploy smoke CI wiring) — deferred, not actionable until
  staging deployment and smoke secrets exist

## 7. Final Verdict

**B — OPS LOW-SEVERITY TRIAGE COMPLETE WITH WATCHLIST**

All 7 low-severity findings have been reviewed against current main. None
warrant an urgent fix. Two are permanent watchlist items (structured logging,
Docker security scan). Two could justify a focused future PR (ClamAV health
endpoint, docs-only CI skip). Three are blocked by environment or GitHub
configuration (smoke CI wiring, smoke secrets, incident drills).

The documentation gaps for the low-severity findings were substantially
addressed by OPS2-006 (MONITORING_RUNBOOK.md enhancements).

No docs-only fix batch is warranted at this time.
