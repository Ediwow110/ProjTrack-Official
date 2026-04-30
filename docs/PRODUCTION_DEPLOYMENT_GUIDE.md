# Production Deployment Guide for ProjTrack

This guide outlines the steps and requirements for deploying ProjTrack to staging and production environments. Follow these instructions to ensure a smooth and secure deployment process.

## Clean Linux Verification Requirement

- **Linux CI Requirement**: All verification must be done on a clean Linux environment (e.g., Ubuntu latest via GitHub Actions). Windows npm ci failures are considered local toolchain issues and are not accepted as final proof until Linux CI passes.
- **Reason**: Windows environments have shown inconsistent behavior with npm ci due to issues like esbuild crashes and Prisma preinstall errors (e.g., ENOTEMPTY, EPERM, exit 3221225477). Linux provides a stable and reproducible environment for production validation.

## Production Candidate CI Workflow

- **Workflow File**: `.github/workflows/production-candidate.yml`
- **Triggers**: Runs on push and pull requests to the `main` branch.
- **Environment**: Uses `ubuntu-latest` with Node.js 20.
- **Frontend Checks**:
  - `npm ci`
  - `npm run security:secrets`
  - `npm run check:release-hygiene`
  - `npm run check:frontend-env:production`
  - `npm run typecheck`
  - `npm run build:production-fixture`
  - `npm audit --audit-level=high`
- **Backend Checks**:
  - `npm ci` in backend directory
  - `npx prisma validate --schema prisma/schema.prisma`
  - `npx prisma generate --schema prisma/schema.prisma`
  - `npx prisma migrate deploy --schema prisma/schema.prisma`
  - `npm run build`
  - `npm run test`
  - `npm audit --audit-level=high`
- **PostgreSQL Service**: Configured for backend tests with a test database.

## Required Staging Environment Variables

Ensure these variables are set for the staging environment. Do not commit real secrets to the repository.

### Frontend
- `VITE_USE_BACKEND=true`
- `VITE_API_BASE_URL=https://api-staging.projtrack.codes`
- `VITE_PUBLIC_APP_URL=https://staging.projtrack.codes`

### Backend Core
- `NODE_ENV=production`
- `APP_ENV=production`
- `DATABASE_URL=postgresql://...`
- `APP_URL=https://staging.projtrack.codes`
- `FRONTEND_URL=https://staging.projtrack.codes`
- `BACKEND_URL=https://api-staging.projtrack.codes`
- `CORS_ORIGINS=https://staging.projtrack.codes`
- `TRUST_PROXY=true`

### Authentication
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `JWT_ISSUER=projtrack`
- `JWT_AUDIENCE=projtrack-users`
- `JWT_KEY_ID=staging-2026-05`
- `ACCOUNT_ACTION_TOKEN_ENC_KEY=...`

### Mail
- `MAIL_PROVIDER=mailrelay`
- `MAILRELAY_API_KEY=...`
- `MAILRELAY_API_URL=...`
- `MAIL_WORKER_ENABLED=true`
- `MAIL_SMOKE_TO=your-test-email@example.com`
- `MAIL_FROM_NOREPLY=...`
- `MAIL_FROM_ADMIN=...`
- `MAIL_FROM_INVITE=...`
- `MAIL_FROM_NOTIFY=...`
- `MAIL_FROM_SUPPORT=...`

### Storage/Uploads
- `OBJECT_STORAGE_MODE=s3`
- `S3_BUCKET=...`
- `S3_REGION=...`
- `S3_ACCESS_KEY_ID=...`
- `S3_SECRET_ACCESS_KEY=...`
- `S3_SIGNED_URL_TTL_SECONDS=300`
- `S3_BUCKET_PUBLIC=false`
- `FILE_MALWARE_SCAN_MODE=fail-closed`
- `FILE_MALWARE_SCANNER=clamav`
- `CLAMAV_HOST=...`
- `CLAMAV_PORT=3310`

### Smoke Test Accounts
- `SMOKE_ADMIN_EMAIL=...`
- `SMOKE_ADMIN_PASSWORD=...`
- `SMOKE_TEACHER_EMAIL=...`
- `SMOKE_TEACHER_PASSWORD=...`
- `SMOKE_STUDENT_EMAIL=...`
- `SMOKE_STUDENT_PASSWORD=...`

## Required Production Environment Variables

Production variables are similar to staging but must point to production endpoints and use production credentials. Ensure all values are updated accordingly.

- Update `VITE_API_BASE_URL`, `VITE_PUBLIC_APP_URL`, `APP_URL`, `FRONTEND_URL`, `BACKEND_URL`, and `CORS_ORIGINS` to production URLs (e.g., `https://api.projtrack.codes` and `https://www.projtrack.codes`).
- Use production-grade secrets and credentials for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MAILRELAY_API_KEY`, etc.
- Set `JWT_KEY_ID` to a production-specific value (e.g., `prod-2026-05`).

## Mailrelay Sender/DNS Verification

- **Sender Verification**: Ensure the sender email addresses (`MAIL_FROM_*`) are verified in Mailrelay.
- **DNS Setup**: Configure DNS records for Mailrelay to enable email sending and tracking. Follow Mailrelay's documentation for SPF, DKIM, and DMARC settings.
- **Validation**: Run `npm --prefix backend run smoke:mail` with `MAIL_SMOKE_TO` set to a test email address to verify email delivery.

## Private S3 Bucket Setup

- **Bucket Creation**: Create a private S3-compatible bucket for file storage.
- **Permissions**: Set bucket policy to deny public access (`S3_BUCKET_PUBLIC=false`).
- **Credentials**: Provide `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` for access.
- **Validation**: Run `node backend/scripts/object-storage-smoke.js` to verify connectivity and permissions.

## ClamAV Setup

- **Endpoint Configuration**: Set `CLAMAV_HOST` and `CLAMAV_PORT` to point to a ClamAV service for malware scanning.
- **Fail-Closed Policy**: Ensure `FILE_MALWARE_SCAN_MODE=fail-closed` to reject uploads if scanning fails.
- **Validation**: Test with a sample file upload to confirm scanning functionality.

## Monitoring Requirements

- **Provider Setup**: Choose a monitoring provider (e.g., New Relic, Datadog) and configure alerts for uptime, errors, and performance metrics.
- **Integration**: Add monitoring SDK or agent to the backend and frontend if supported.
- **Alerts**: Set up alerts for critical issues like database downtime or high error rates.

## Backup/Restore Drill

- **Backup Process**: Configure automated backups for the PostgreSQL database and S3 storage.
- **Restore Drill**: Perform a staging restore drill to ensure data can be recovered. Document the process in `BACKUP_RUNBOOK.md`.
- **Validation**: Verify restored data integrity and application functionality post-restore.

## Staging Smoke Checklist

Run these commands to validate staging readiness. If external services are unavailable, manual verification is required.

- **Backend Smoke**: `npm --prefix backend run smoke`
- **Mail Smoke**: `MAIL_SMOKE_TO=admin@example.com npm --prefix backend run smoke:mail`
- **Object Storage Smoke**: `node backend/scripts/object-storage-smoke.js`
- **E2E Smoke**: `npm run e2e:smoke`
- **Auth**: Verify login for admin, teacher, and student accounts.
- **Upload/Submit/Review**: Test file upload, submission, and review process.
- **Backup Restore**: Perform a restore drill in staging.
- **Monitoring Alerts**: Confirm alerts are triggered for simulated failures.

## Production Go/No-Go Checklist

Before production deployment, ensure:

- All CI checks pass on `main` branch.
- Staging smoke tests pass with real credentials.
- Backup and restore processes are validated.
- Monitoring is active with alert thresholds set.
- All environment variables are set to production values.
- Security audits show no high/critical vulnerabilities.
- Final review by stakeholders confirms readiness.

## Troubleshooting

- **npm ci Windows esbuild Crash**: Use Linux CI for verification. On Windows, consider WSL2 or Docker for a Linux environment.
- **Prisma Preinstall Crash**: Ensure npm ci is run on Linux. Check for compatible Prisma and Node.js versions.
- **CORS Issues**: Verify `CORS_ORIGINS` matches the frontend URL. Check browser console for CORS errors.
- **Frontend Calling Localhost**: Ensure `VITE_USE_BACKEND=true` and `VITE_API_BASE_URL` is set to the production API endpoint.
- **Emails Queued but Not Sent**: Check `MAIL_WORKER_ENABLED=true` and verify Mailrelay credentials and DNS setup.
- **S3 Smoke Failure**: Confirm `OBJECT_STORAGE_MODE=s3` and credentials are correct. Test connectivity with `object-storage-smoke.js`.
- **ClamAV Unavailable**: Set a valid `CLAMAV_HOST` and ensure the service is running. Fallback to `fail-closed` mode rejects uploads if unavailable.
- **E2E Skipped Due to Missing Test Accounts**: Provide `SMOKE_*_EMAIL` and `SMOKE_*_PASSWORD` for admin, teacher, and student roles.
