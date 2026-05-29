# Authenticated Production Baseline Summary - Issue #75

## Results Overview
- **Target Environment**: Vercel Production (https://www.projtrack.codes)
- **API Environment**: Production API (https://api.projtrack.codes)
- **Generated At**: 2026-05-29
- **Tool**: Playwright + Enhanced Baseline Script

## Authentication Status

| Role | Status | Authenticated | Screenshots | Notes |
|------|--------|---------------|-------------|-------|
| **Admin** | **PASS** | Yes | 20 | Verified authenticated dashboard/settings/users access. |
| **Student** | **PARTIAL** | No | 20 | Connectivity verified; login skipped (missing secrets). |
| **Teacher** | **PARTIAL** | No | 10 | Connectivity verified; login skipped (missing secrets). |

## Viewport Coverage
All routes were captured at the following viewports:
- 360x800 (Mobile)
- 390x844 (Mobile iPhone 12)
- 414x896 (Mobile Plus)
- 768x1024 (Tablet iPad)
- 1440x900 (Desktop)

## Key Findings
- **Admin Authentication**: Successfully bypassed login redirects and captured real dashboard content.
- **Connectivity**: Post-deploy smoke tests confirmed that all login portals are reachable and correctly integrated with the production API.
- **Role Awareness**: The baseline script successfully differentiates between student, teacher, and admin login requirements.

## Artifacts
- **Manifest**: \docs/frontend-mobile-readiness/evidence/baseline/manifest.json\
- **Raw Screenshots**: Captured and stored as workflow artifacts in GitHub Actions (Run #26627924091). Not committed to the repository to avoid bloat.

---
*Phase 2 Status: Credentialed baseline partially satisfied (Admin complete, Student/Teacher connectivity verified).*