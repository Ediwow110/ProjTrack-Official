# Staging Smoke Test

Run this after deploying to staging and before approving production.

## Environment

- Staging frontend URL:
- Staging backend URL:
- Commit SHA:
- Database migration version:
- Tester:
- Date/time:

## Checks

- `/health/live` returns `ok: true`.
- `/health/ready` returns `ok: true` or lists only accepted non-blocking warnings.
- Admin can sign in and view system health.
- Admin can verify users, subjects, sections, mail jobs, and backup status.
- Teacher can sign in, view assigned subjects, and open submission review.
- Student can sign in, view due work, existing submissions, group status, and feedback.
- Login role mismatch is rejected.
- Logout revokes the session.
- Oversized upload is rejected.
- Invalid MIME upload is rejected.
- Smoke mail path uses the expected staging provider.
- No private token, reset link, password hash, or secret is visible in browser responses.

## Evidence

- Command output link or pasted summary:
- Screenshots:
- Failed checks:
- Owner for remediation:
- Final decision:
