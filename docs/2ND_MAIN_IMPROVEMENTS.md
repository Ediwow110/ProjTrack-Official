# 2nd-Main Branch Improvement Tracker

> **Core Principle**: All improvements must be done on the `2nd-main` branch. Do not modify the original `main` branch until the work is reviewed and stable.

**Last Updated**: 2026-05-13
**Current Focus**: Following the Fullest Complete Master Improvement Plan

---

## Progress Overview

| Priority | Focus Area                  | Status      | Progress |
|----------|-----------------------------|-------------|----------|
| 1        | CI/CD Reliability & Visibility | In Progress | 40%     |
| 2        | Security Hardening & Evidence  | In Progress | 15%     |
| 3        | Testing                        | Not Started | 0%      |
| 4        | Production Readiness           | Not Started | 0%      |
| 5        | Documentation                  | In Progress | 50%     |

---

## Priority 1: CI/CD Reliability & Visibility (Start Here)

| #   | Task                        | Action Items                                                                 | Priority | Status      | Notes / PR | Completed |
|-----|-----------------------------|------------------------------------------------------------------------------|----------|-------------|------------|-----------|
| 1.1 | Add CI Badges               | Add workflow badges to README.md for ci.yml and production-checks.yml       | High     | **Done**    | Added to top of README | 2026-05-13 |
| 1.2 | Improve ci.yml              | Add caching, separate jobs (lint, typecheck, build, test), run on 2nd-main  | High     | In Progress | Current ci.yml is already strong; enhancing further |           |
| 1.3 | Review Production Workflows | Check production-candidate.yml and production-checks.yml for safety gates   | High     | To Do       |            |           |
| 1.4 | Add Notifications           | Configure failure notifications for workflows                               | Medium   | To Do       |            |           |
| 1.5 | Create CI Status Doc        | Create docs/CI_STATUS.md to track CI health                                 | Medium   | To Do       |            |           |

---

## Priority 2: Security Hardening & Evidence

| #   | Task                          | Action Items                                              | Priority | Status     | Notes | Completed |
|-----|-------------------------------|-----------------------------------------------------------|----------|------------|-------|-----------|
| 2.1 | Audit Auth & Authz            | Review JWT, role guards, and endpoint protection          | High     | To Do      |       |           |
| 2.2 | Review MinIO Security         | Check bucket policies, signed URLs, and access control    | High     | To Do      |       |           |
| 2.3 | Input Validation + Rate Limiting | Add ValidationPipe and rate limiting on sensitive routes | High     | To Do      |       |           |
| 2.4 | Security Headers              | Add Helmet middleware                                     | Medium   | To Do      |       |           |
| 2.5 | Create Security Review Doc    | Create docs/SECURITY_REVIEW.md                            | High     | **Done**   | Initial skeleton created with sections for all tasks | 2026-05-13 |
| 2.6 | Secrets Handling              | Ensure app fails fast if critical secrets are missing in production | High | To Do |       |           |

---

## Priority 3: Testing

| #   | Task                    | Action Items                                      | Priority | Status | Notes | Completed |
|-----|-------------------------|---------------------------------------------------|----------|--------|-------|-----------|
| 3.1 | Test Critical Flows     | Add tests for auth, projects, tasks, roles        | High     | To Do  |       |           |
| 3.2 | Improve E2E Tests       | Enhance Playwright tests with better assertions   | High     | To Do  |       |           |
| 3.3 | Add Integration Tests   | Test Prisma and service layers                    | Medium   | To Do  |       |           |
| 3.4 | Coverage Reporting      | Enable coverage in CI                             | Medium   | To Do  |       |           |

---

## Priority 4: Production Readiness

| #   | Task                  | Action Items                                           | Priority | Status | Notes | Completed |
|-----|-----------------------|--------------------------------------------------------|----------|--------|-------|-----------|
| 4.1 | Structured Logging    | Add correlation IDs and consistent logging             | High     | To Do  |       |           |
| 4.2 | Health Checks         | Verify /health/live, /health/ready endpoints           | Medium   | To Do  |       |           |
| 4.3 | Migration Safety      | Document safe migration + rollback process             | High     | To Do  |       |           |
| 4.4 | Monitoring            | Confirm actual monitoring/alerting is active           | Medium   | To Do  |       |           |

---

## Priority 5: Documentation

| #   | Task                    | Action Items                                      | Priority | Status     | Notes | Completed |
|-----|-------------------------|---------------------------------------------------|----------|------------|-------|-----------|
| 5.1 | Audit Production Docs   | Clean outdated PRODUCTION_READINESS files         | Medium   | To Do      |       |           |
| 5.2 | Maintain Tracker        | Keep docs/2ND_MAIN_IMPROVEMENTS.md updated        | High     | **Done**   | Created and being maintained | 2026-05-13 |
| 5.3 | Fix Overstated Claims   | Update README and docs to match reality           | Medium   | To Do      |       |           |

---

## Documents Created

- [x] `docs/2ND_MAIN_IMPROVEMENTS.md` — This tracker
- [x] `docs/SECURITY_REVIEW.md` — Initial structure with all Priority 2 sections
- [ ] `docs/TESTING_STRATEGY.md`
- [ ] `docs/OPERATIONAL_READINESS.md`
- [ ] `docs/MIGRATION_SAFETY_CHECKLIST.md`
- [ ] `docs/ROLLBACK_STRATEGY.md`
- [ ] `docs/SECRETS_MANAGEMENT_CHECKLIST.md`
- [ ] `docs/CI_STATUS.md`

## Completed Today (2026-05-13)

- [x] Created main improvement tracker
- [x] Added CI badges to README.md
- [x] Created SECURITY_REVIEW.md skeleton
- [x] Updated this tracker

## Next Steps

1. Improve ci.yml (enhance job separation and add explicit 2nd-main focus)
2. Review production workflows (1.3)
3. Begin deep Auth & MinIO security audit
4. Create additional recommended documents

**Rule**: Everything on this plan must be done on the `2nd-main` branch only.