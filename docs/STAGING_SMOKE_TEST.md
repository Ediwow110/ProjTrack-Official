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

- Local preflight before browser smoke: `npm run check:smoke-deps`.
- Local dependency startup, if needed: start Docker Desktop, then run `npm run prepare:local`.
- Browser smoke command: `npm run e2e:smoke`.
- Auth responsive command: `npm run e2e:responsive`.
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

- `npm run check:smoke-deps` result:
- `npm run e2e:responsive` result:
- `npm run e2e:smoke` result:
- If blocked, exact infrastructure blocker:
- Command output link or pasted summary:
- Screenshots:
- Failed checks:
- Owner for remediation:
- Final decision:
