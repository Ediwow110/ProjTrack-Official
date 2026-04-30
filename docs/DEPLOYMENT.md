# Deployment Instructions for ProjTrack

This document provides a streamlined set of instructions for deploying ProjTrack to both staging and production environments. For detailed guidance, refer to `PRODUCTION_DEPLOYMENT_GUIDE.md`.

## Deployment Prerequisites

- **Repository**: Ensure you are working from a clean clone of `https://github.com/Ediwow110/ProjTrack-Official`.
- **CI Verification**: All checks in `.github/workflows/production-candidate.yml` must pass on the `main` branch before deployment.
- **Environment Variables**: Staging and production environment variables must be prepared as outlined in `PRODUCTION_DEPLOYMENT_GUIDE.md`. Do not commit real secrets to the repository.
- **Infrastructure**: Database (PostgreSQL), object storage (S3-compatible), mail service (Mailrelay), and malware scanning (ClamAV) must be provisioned.

## Staging Deployment

### Step 1: Build and Package
- **Frontend**: Run `npm run build:production-fixture` to create a production-ready build.
- **Backend**: Run `npm --prefix backend run build` to compile the NestJS application.

### Step 2: Deploy Frontend
- **Hosting**: Deploy the frontend build (from `dist` folder) to a static hosting service pointing to `https://staging.projtrack.codes`.
- **Environment**: Ensure frontend environment variables (`VITE_USE_BACKEND=true`, `VITE_API_BASE_URL=https://api-staging.projtrack.codes`) are set in the hosting configuration.

### Step 3: Deploy Backend
- **Hosting**: Deploy the backend build (from `backend/dist`) to a Node.js server environment pointing to `https://api-staging.projtrack.codes`.
- **Environment**: Set backend environment variables for staging as per `PRODUCTION_DEPLOYMENT_GUIDE.md` (e.g., `DATABASE_URL`, `JWT_*_SECRET`, `MAILRELAY_API_KEY`, `S3_*`).
- **Database**: Run `npx prisma migrate deploy --schema backend/prisma/schema.prisma` on the server to apply migrations to the staging database.

### Step 4: Smoke Tests
- Follow `STAGING_SMOKE_TEST_GUIDE.md` to run smoke tests:
  - Backend: `npm --prefix backend run smoke`
  - Mail: `MAIL_SMOKE_TO=admin@example.com npm --prefix backend run smoke:mail`
  - Object Storage: `node backend/scripts/object-storage-smoke.js`
  - E2E: `npm run e2e:smoke`
- Perform manual validations for auth, uploads, and reviews if automated tests fail.

### Step 5: Validation
- Confirm all smoke tests pass and document results in `PRODUCTION_READINESS.md`.
- Address any failures before proceeding.

## Production Deployment

### Step 1: Final CI Verification
- Ensure the latest `main` branch commit has passed all CI checks in GitHub Actions under `production-candidate.yml`.

### Step 2: Build and Package
- **Frontend**: Run `npm run build:production-fixture` for the final production build.
- **Backend**: Run `npm --prefix backend run build` for the production backend.

### Step 3: Deploy Frontend
- **Hosting**: Deploy the frontend build to static hosting at `https://www.projtrack.codes`.
- **Environment**: Set `VITE_API_BASE_URL=https://api.projtrack.codes` and other production variables.

### Step 4: Deploy Backend
- **Hosting**: Deploy the backend build to a Node.js server at `https://api.projtrack.codes`.
- **Environment**: Set production environment variables as per `PRODUCTION_DEPLOYMENT_GUIDE.md`, ensuring all secrets are secure and unique to production.
- **Database**: Run `npx prisma migrate deploy --schema backend/prisma/schema.prisma` to apply migrations to the production database.

### Step 5: Go/No-Go Checklist
- Verify CI success, staging smoke test results, backup/restore drill completion, monitoring setup, and stakeholder approval.
- Confirm no high/critical security vulnerabilities remain unresolved in audits.

### Step 6: Post-Deployment Validation
- Run a subset of smoke tests in production:
  - Backend: `npm --prefix backend run smoke`
  - Mail: Test with a production-safe email recipient.
  - Object Storage: `node backend/scripts/object-storage-smoke.js`
- Manually validate login for all roles and a sample upload/submit/review cycle.
- Monitor initial user interactions for errors via configured monitoring tools.

## Rollback Procedure

- **Frontend Rollback**: Redeploy the previous frontend build version to the hosting service.
- **Backend Rollback**: Redeploy the previous backend build version. Avoid database rollback unless critical, as migrations may be irreversible. If needed, restore from the last backup after stakeholder approval.
- **Communication**: Notify users of any downtime or issues via predefined channels (e.g., email, status page).

## Troubleshooting

Refer to `PRODUCTION_DEPLOYMENT_GUIDE.md` for detailed troubleshooting steps for common issues like npm ci failures, CORS errors, email delivery problems, S3 connectivity, and ClamAV setup.

- **CI Failures**: Review GitHub Actions logs for specific errors (e.g., npm ci, build failures) and adjust dependencies or configurations.
- **Deployment Errors**: Check server logs for backend issues. Ensure environment variables match the deployed environment.
- **Smoke Test Failures**: Address specific component failures (e.g., mail, storage) by verifying credentials and connectivity.

## Additional Resources

- **Full Deployment Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Smoke Test Guide**: `STAGING_SMOKE_TEST_GUIDE.md`
- **Security Summary**: `SECURITY_AUDIT_SUMMARY.md`
- **Runbooks**: `MAILRELAY_RUNBOOK.md`, `BACKUP_RUNBOOK.md`

Ensure all deployments are logged with timestamps, responsible parties, and outcomes for audit purposes.
