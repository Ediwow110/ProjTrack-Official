# Security Notes

## Access Control

Backend authorization is centralized in `backend/src/access`. Controllers and services should use access service methods instead of repeating ad hoc checks. The key rules are:

- Admins can administer all records.
- Teachers can access subjects they own and submissions under those subjects.
- Students can access only enrolled subjects and their own individual or active group submissions.
- Non-admin file access requires database file metadata. Unknown file paths are denied.

## Public Login Routing

The public/default landing page is Student Login. `/`, `/login`, and `/portals` redirect to `/student/login`. Teacher and admin login pages remain available only by direct URL distribution at `/teacher/login` and `/admin/login`.

Direct or hidden URLs are not security controls. Frontend protected routes, backend `JwtAuthGuard`, role guards, and service-level authorization remain mandatory.

## Sensitive Data

Frontend responses must not include:

- `passwordHash`
- activation/reset/setup token values
- mail job raw template payloads
- raw provider payload bodies
- raw Prisma `User` includes
- secret environment values
- setup/reset links in public or production API responses

Use `SAFE_USER_SELECT` or purpose-built DTOs.

Mail job responses are operator-facing, but they still must stay safe:

- do not expose Mailrelay API keys or auth headers
- do not expose raw reset/setup payloads
- do not expose idempotency keys or token-like values
- only expose redacted and truncated provider messages

## Account Email Flows

Pending Setup users should receive admin-triggered setup email, not public forgot-password reset email. The setup flow creates or reuses an activation token internally and queues an `account-activation` MailJob; API responses may include the safe `mailJobId` but must not include token values or full setup links.

Forgot-password responses must stay generic and must not reveal whether an email exists. A reset MailJob is created only for active users whose requested role matches the account role. Role mismatches, pending setup accounts, inactive/restricted accounts, missing users, and throttled requests are logged with safe skipped reasons.

## Sessions

JWT guards load the current database user on each protected request. Inactive, deleted, or role-changed accounts are rejected. Admin status changes revoke refresh sessions.

Frontend refresh uses a single-flight promise so simultaneous `401` responses do not trigger refresh-token reuse revocation.

## Rate Limits and Proxy Trust

Auth throttling uses `req.ip` or the socket address. `x-forwarded-for` is trusted only when Express `trust proxy` is explicitly enabled:

```bash
TRUST_PROXY=true
TRUST_PROXY_HOPS=1
```

Only enable this behind a trusted reverse proxy.

## Upload and Import Risk

Student imports enforce file size, row, column, and sheet limits. The `xlsx` library still has npm audit advisories with no safe package fix; keep import admin-only and prefer CSV for high-volume imports. Follow-up options are replacing `xlsx` with a maintained parser or disabling XLSX import in production and accepting CSV only.

## Backup Sensitivity

Backup artifacts are admin-only but contain production data, including account data required for restore. Store artifacts in encrypted operator-controlled storage, never commit them, and validate checksums before restore.

## Destructive Operations

Backup delete is blocked for latest successful, protected, and running backups. Restore/purge behavior should remain outside routine UI unless a stronger multi-step operator workflow is implemented.

## Remaining Dependency Findings

- Nest 10 and transitive `file-type` advisories require a Nest 11 upgrade.
- `xlsx` advisories have no safe npm audit fix; mitigated with admin-only access and strict import limits.

## Destructive Action and Mail Success Safety

Seed Data Cleanup remains a guarded two-step operation. Preview scans must not mutate data. Blocked previews must report zero records deleted and keep destructive execution disabled. Execution must still require `ALLOW_SEED_DATA_CLEANUP`, production override where applicable, backup acknowledgement, and the exact confirmation phrase.

Mail-related admin actions must create a MailJob row and return a MailJob ID before frontend code shows success. Backend and UI diagnostics must remain safe: do not expose secrets, tokens, reset/setup links, raw provider payloads, password hashes, API keys, or database credentials.

## Bootstrap Status Icons

The shared Bootstrap icon wrapper uses inline SVG path data only. It does not load external font files, expose secrets, or introduce Bootstrap CSS that could override ProjTrack's theme tokens. Use semantic tones (`success`, `danger`, `warning`, `info`) instead of one-off icon colors.

## Silent-Failure Hardening Notes

Do not treat a broad HTTP 200 as enough evidence for mail or destructive operations. Mail paths must confirm a MailJob ID. Destructive cleanup must report secondary storage cleanup warnings, and retention jobs must expose partial failures to operators without leaking secret paths, tokens, reset links, provider payloads, or credentials.
