# Staging Smoke Test Guide for ProjTrack

This guide provides the commands and steps necessary to validate the staging environment for ProjTrack. These smoke tests ensure that critical functionalities are operational before proceeding to production deployment.

## Prerequisites

- Ensure the staging environment is set up with the correct environment variables as outlined in `PRODUCTION_DEPLOYMENT_GUIDE.md`.
- Verify that the backend and frontend are deployed and accessible at the staging URLs (e.g., `https://api-staging.projtrack.codes` and `https://staging.projtrack.codes`).
- Have test accounts ready for admin, teacher, and student roles with credentials set in environment variables (`SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, etc.).

## Smoke Test Commands

Run these commands from the project root to validate various components of the system. Adjust environment variables as needed for your staging setup.

### Backend General Smoke Test
- **Command**: `npm --prefix backend run smoke`
- **Purpose**: Validates basic backend functionality, API endpoints, and database connectivity.
- **Expected Output**: Should report success if all checks pass. Look for any error messages indicating connection issues or misconfigurations.

### Mail Service Smoke Test
- **Command**: `MAIL_SMOKE_TO=your-test-email@example.com npm --prefix backend run smoke:mail`
- **Purpose**: Tests email sending capability through the configured mail provider (Mailrelay in staging).
- **Expected Output**: An email should be sent to the specified address. Check the inbox for receipt and verify the content and sender details.
- **Troubleshooting**: If no email is received, ensure `MAIL_PROVIDER=mailrelay`, `MAILRELAY_API_KEY`, and `MAILRELAY_API_URL` are correctly set. Verify DNS setup for Mailrelay.

### Object Storage Smoke Test
- **Command**: `node backend/scripts/object-storage-smoke.js`
- **Purpose**: Validates connectivity and permissions with the S3-compatible storage for file uploads.
- **Expected Output**: Should report success if a test file can be uploaded and retrieved. Errors indicate issues with `S3_*` environment variables or bucket permissions.
- **Troubleshooting**: Confirm `OBJECT_STORAGE_MODE=s3` and check credentials (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) and bucket settings (`S3_BUCKET`, `S3_REGION`).

### Academic Structure Smoke Test
- **Command**: `npm --prefix backend run smoke:academic-structure`
- **Purpose**: Ensures the academic structure data (e.g., courses, sections) is correctly set up and accessible.
- **Expected Output**: Should list or validate academic structure entries. Errors may indicate database seeding issues.

### End-to-End (E2E) Smoke Test
- **Command**: `npm run e2e:smoke`
- **Purpose**: Runs automated browser tests to simulate user interactions across critical workflows (login, submission, review).
- **Expected Output**: All tests should pass. Failures will detail which workflow or component failed (e.g., login, file upload).
- **Troubleshooting**: Ensure test accounts are set (`SMOKE_*_EMAIL`, `SMOKE_*_PASSWORD`). Check for frontend-backend URL mismatches (`VITE_API_BASE_URL`, `CORS_ORIGINS`).

## Manual Validation Steps

If automated tests fail or external services are unavailable, perform these manual checks:

- **Authentication**: Log in with admin, teacher, and student accounts at `https://staging.projtrack.codes`. Verify role-specific features are accessible.
- **File Upload/Submission/Review**: Upload a file as a student, submit it for review, and verify a teacher can access and review it.
- **Email Notifications**: Trigger an action that sends an email (e.g., invite a user) and confirm receipt.
- **Backup and Restore Drill**: Perform a backup of the staging database and storage, then attempt a restore to ensure data integrity. Document findings.
- **Monitoring Alerts**: Simulate a failure (e.g., stop backend service temporarily) and confirm monitoring alerts are triggered if set up.

## Required Environment Variables for Smoke Tests

Ensure these are set for staging smoke tests to run correctly:

- **Backend Core**: `DATABASE_URL`, `NODE_ENV=production`, `APP_ENV=production`, `BACKEND_URL`, `FRONTEND_URL`, `CORS_ORIGINS`
- **Authentication**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCOUNT_ACTION_TOKEN_ENC_KEY`
- **Mail**: `MAIL_PROVIDER=mailrelay`, `MAILRELAY_API_KEY`, `MAILRELAY_API_URL`, `MAIL_SMOKE_TO`, `MAIL_FROM_*`
- **Storage**: `OBJECT_STORAGE_MODE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `FILE_MALWARE_SCAN_MODE=fail-closed`, `CLAMAV_HOST`, `CLAMAV_PORT`
- **Smoke Test Accounts**: `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_TEACHER_EMAIL`, `SMOKE_TEACHER_PASSWORD`, `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`
- **Frontend**: `VITE_USE_BACKEND=true`, `VITE_API_BASE_URL=https://api-staging.projtrack.codes`

## Troubleshooting Common Issues

- **Emails Not Sent**: Verify `MAIL_WORKER_ENABLED=true` and Mailrelay credentials. Check DNS records for SPF/DKIM/DMARC setup.
- **S3 Upload Failures**: Ensure `S3_BUCKET_PUBLIC=false` and credentials are correct. Run the object storage smoke test for detailed errors.
- **ClamAV Scanning Issues**: Confirm `CLAMAV_HOST` is reachable. If unavailable, uploads should fail closed as per policy.
- **E2E Test Failures Due to Missing Accounts**: Set all `SMOKE_*` variables with valid test credentials.
- **CORS Errors in Browser**: Ensure `CORS_ORIGINS` includes the staging frontend URL.

## Next Steps After Smoke Tests

- If all tests pass, document the results and proceed with stakeholder review for production readiness.
- If failures occur, address the specific issues, update configurations or code as needed, and rerun the tests.
- Update `PRODUCTION_READINESS.md` with any findings or blockers identified during smoke testing.
