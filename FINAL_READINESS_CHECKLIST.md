# Final Readiness Checklist for ProjTrack Production Deployment

This checklist summarizes the critical items that must be completed or verified before approving ProjTrack for production deployment. It serves as a quick reference to ensure all aspects of the phased plan are addressed.

## Repository Hygiene
- [X] `.gitignore` updated to prevent commits of generated artifacts, local files, and sensitive data.
- [X] Release hygiene script (`scripts/release-hygiene-check.mjs`) enhanced to detect forbidden files and secrets.
- [X] Local run of `npm run check:release-hygiene` passes without violations.

## CI Workflow for Linux
- [X] GitHub Actions workflow (`production-candidate.yml`) created for Ubuntu-latest with Node 20 and PostgreSQL service.
- [ ] CI workflow successfully runs `npm ci` for root and backend without errors on Linux.
- [ ] CI completes all verification steps (frontend build, backend build, tests, Prisma commands) on Linux.

## Frontend Build and Validation
- [ ] Frontend typecheck (`npm run typecheck`) passes in CI.
- [ ] Frontend environment validation for production (`npm run check:frontend-env:production`) passes in CI.
- [ ] Frontend production build (`npm run build:production-fixture`) completes successfully in CI.

## Backend Build, Prisma, and Tests
- [X] Prisma schema fixed for compatibility with version 5.x (local success).
- [X] Backend build (`npm --prefix backend run build`) completes locally.
- [X] Backend tests (`npm --prefix backend run test`) pass locally.
- [ ] Backend Prisma validation, generation, and migration deploy pass in CI.
- [ ] Backend build and tests pass in CI on Linux.

## Security Audits and Checks
- [X] Secret scans (`npm run security:secrets`, `npm --prefix backend run security:secrets`) pass with no detected secrets.
- [X] Frontend audit (`npm audit --audit-level=high`) shows no high/critical vulnerabilities.
- [X] Backend audit (`npm --prefix backend audit --audit-level=high`) completed, with moderate vulnerabilities documented.
- [X] Security mitigations and risk acceptance for moderate backend vulnerabilities documented in `SECURITY_NOTES.md`.
- [ ] Final security audit rerun in CI to confirm status after dependency adjustments.

## Staging Smoke Readiness
- [X] Smoke test guide (`STAGING_SMOKE_TEST_GUIDE.md`) created with commands for backend, mail, storage, and E2E tests.
- [X] Required staging environment variables documented for smoke tests.
- [ ] Smoke tests executed in staging environment with real credentials (backend, mail, storage, E2E).
- [ ] Manual validation of auth, upload/submit/review workflows completed in staging.

## Documentation
- [X] Production deployment guide (`PRODUCTION_DEPLOYMENT_GUIDE.md`) completed with staging and production instructions.
- [X] Streamlined deployment instructions (`DEPLOYMENT.md`) provided.
- [X] Backup and restore runbook (`BACKUP_RUNBOOK.md`) created with procedures and validation drills.
- [X] Mailrelay setup and troubleshooting runbook (`MAILRELAY_RUNBOOK.md`) completed.
- [X] Security audit summary (`SECURITY_AUDIT_SUMMARY.md`) and notes (`SECURITY_NOTES.md`) documented.
- [X] Production readiness report (`PRODUCTION_READINESS.md`) updated with status, blockers, and recommendations.

## Final Commits and Report
- [X] Structured commit messages prepared in `COMMIT_MESSAGES.md` for version control history.
- [ ] Final commits applied post-CI success on Linux.
- [X] Final readiness report completed and ready for stakeholder review.

## Go/No-Go Criteria for Production
- [ ] All CI checks pass on `main` branch in GitHub Actions (`production-candidate.yml`).
- [ ] Staging smoke tests pass with real credentials, confirming backend, mail, storage, and E2E functionality.
- [ ] Backup and restore drill completed successfully in staging, with documented results.
- [ ] Monitoring setup active with alert thresholds for uptime, errors, and performance.
- [ ] No unresolved high or critical security vulnerabilities; moderate issues mitigated or accepted with documentation.
- [ ] Stakeholder review and approval of readiness report and security posture.

## Instructions

- **Checklist Completion**: Mark items as checked ([X]) only when verified in the appropriate environment (local for initial tasks, CI for final proof, staging for smoke tests).
- **Blocker Resolution**: Focus on resolving the remaining blockers (npm ci on Linux, frontend build in CI, final security audit, smoke tests).
- **Final Review**: Ensure all stakeholders review this checklist alongside `PRODUCTION_READINESS.md` before production deployment.
- **Next Action**: Push changes to trigger CI workflow on Linux. Monitor results and address failures iteratively.

This checklist ensures ProjTrack meets all production readiness criteria, with clear visibility into completed and pending tasks for a confident deployment decision.
