# Mailrelay Runbook

## Production Provider

Mailrelay is the active production provider. SMTP is not a production path and Sender.net remains inactive future backup only.

Required environment:

```bash
MAIL_PROVIDER=mailrelay
MAILRELAY_API_URL=https://your-mailrelay-api.example
MAILRELAY_API_KEY=replace-with-mailrelay-key
DATABASE_URL=postgresql://...
FRONTEND_URL=https://projtrack.codes
MAIL_FROM_NAME=ProjTrack
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
TESTMAIL_ENABLED=false
MAIL_WORKER_ENABLED=false
```

Run the web backend with HTTP enabled and workers disabled:

```bash
cd backend
MAIL_WORKER_ENABLED=false BACKUP_WORKER_ENABLED=false npm run start:prod
```

Run exactly one dedicated worker with workers enabled:

```bash
cd backend
MAIL_WORKER_ENABLED=true BACKUP_WORKER_ENABLED=true npm run start:worker
```

Both processes must use the same production `DATABASE_URL`, `MAIL_PROVIDER=mailrelay`, `MAILRELAY_API_URL`, `MAILRELAY_API_KEY`, `FRONTEND_URL`, and `MAIL_FROM_*` values. Do not point the worker at localhost unless the production database is intentionally local to that host.

For local Windows testing from the repo root:

```powershell
npm run start:worker
```

For local development with API and mail worker in separate terminals:

```powershell
# Terminal 1: backend API only
cd backend
npm run dev:raw
```

```powershell
# Terminal 2: dedicated local mail worker
cd backend
$env:MAIL_WORKER_ENABLED="true"
$env:MAIL_PROVIDER="stub"
npm run dev:worker
```

The local stub provider processes the same queue and moves jobs through
`QUEUED -> PROCESSING -> SENT`, but it only logs local acceptance. It does not
deliver to a real inbox. Keep `MAIL_WORKER_ENABLED=false` for the API process
and `MAIL_WORKER_ENABLED=true` for the dedicated worker process.

## Sender Confirmation

Mailrelay must confirm every configured sender before it will accept messages.
Confirm these addresses in Mailrelay:

- `admin@projtrack.codes`
- `support@projtrack.codes`
- `notification@projtrack.codes`

If Mailrelay rejects `sender email isn't confirmed`, the queue and worker can still be healthy. Admin -> Mail Jobs will show `SENDER_NOT_CONFIRMED`, the From sender used by the job, and a safe provider detail. Fix the sender in Mailrelay before retrying old jobs.

Do not point every flow at `admin@projtrack.codes`. Production uses a strict
sender map so account emails, academic notifications, and system messages stay
separated:

```bash
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
```

Restart both the backend web process and the worker process after changing sender env vars.

## Test Email

Admins can test from Admin -> Mail Jobs or:

```http
POST /admin/mail/test
Content-Type: application/json

{ "to": "operator@example.com" }
```

The response returns queued status, active provider, job ID, and safe provider message details when available. API keys and raw secret config are never returned. A queued response means the message is waiting for the mail worker; it is not proof of delivery.

Send Test proves only the Mailrelay provider, sender config, queue table, and worker path. Student account setup/invite and forgot-password are separate application flows; each valid email action must create a fresh `EmailJob` row before the worker can deliver anything.

Confirm delivery in three places:

1. Admin -> Mail Jobs shows the active provider, worker status, queue depth, processing count, and safe latest provider error.
2. `GET /health/mail` shows `providerName=mailrelay`, `providerConfigured=true`, queue depth, worker status, sender config issues, latest safe failure reason, last successful send, and last worker heartbeat.
3. The `EmailJob` row has provider `mailrelay`, then moves `QUEUED -> PROCESSING -> SENT`.
4. The Mailrelay dashboard shows the accepted message, and the target Gmail mailbox receives it.

Mailrelay Gmail test flow:

1. Confirm sender addresses in Mailrelay:
   - `admin@projtrack.codes`
   - `support@projtrack.codes`
   - `notification@projtrack.codes`
2. Restart backend web process.
3. Restart worker process with `MAIL_WORKER_ENABLED=true`.
4. Open Admin -> Mail Jobs.
5. Send a fresh Mailrelay test email to Gmail.
6. Confirm job moves:
   `QUEUED -> PROCESSING -> SENT`
7. Confirm `provider=mailrelay`.
8. Confirm `lastError=null`.
9. Confirm `sentAt` is filled.
10. Confirm Mailrelay dashboard shows accepted/sent.
11. Confirm Gmail inbox/spam/promotions receives the message.

Do not keep retrying old jobs until sender confirmation is fixed; they will keep dying with the same provider rejection.

## Student Setup And Password Reset Flows

Admin -> Students pending-setup accounts use `Send Setup Email`. This creates or reuses a secure activation token internally, queues an `account-activation` mail job, and does not return the token or full setup link in API responses. The queued setup job should show `provider=mailrelay` and `From: support@projtrack.codes`.

Public forgot-password only queues `password-reset` for active users whose requested role matches the account role. The public response stays generic. Pending Setup users should use the admin setup invite flow instead of forgot-password, so a pending setup forgot-password request is skipped and recorded in internal diagnostics.

After an admin clicks `Send Setup Email`, Admin -> Mail Jobs must show a fresh current-timestamp row:

- template `account-activation`
- recipient is the student email
- initial status `QUEUED`
- provider `mailrelay`
- From is resolved from `MAIL_FROM_INVITE` and must be `support@projtrack.codes`

If no MailJob appears for setup/reset:

1. Check the frontend action label and endpoint; setup email must call the setup invite action, not copy/open a link.
2. Check user status; Pending Setup uses admin setup invite, Active uses password reset.
3. Check requested role for forgot-password.
4. Check throttling and idempotency; repeated clicks can reuse the same safe mail job during the protection window.
5. Check backend diagnostics for skipped reason.
6. Check missing or invalid email on the account.

Do not use old failed jobs as proof after changing provider, sender, or worker environment. Create a fresh setup/invite/reset job after every fix.

## Queue Operations

Admin Mail Operations shows:

- active provider
- queue depth
- queued-too-long count
- processing-too-long count
- failed/dead jobs
- recent sent jobs
- worker status
- worker heartbeat age
- safe latest provider error
- retry, cancel, archive, and archived-view controls for mail jobs

Lifecycle meanings:

- `QUEUED` means the worker has not processed the job yet and this should stay temporary.
- `PROCESSING` means the dedicated worker claimed the job and this should stay temporary.
- `SENT` means Mailrelay accepted the email.
- `FAILED` means the job is retryable and waiting for the next backoff window.
- `DEAD` means the job hit a non-retryable problem or exhausted the retry budget.
- `CANCELLED` means an operator or suppression rule stopped the job before send.

Normal success path:

`QUEUED -> PROCESSING -> SENT`

Retry path:

`QUEUED -> PROCESSING -> FAILED -> QUEUED -> PROCESSING -> SENT`

Non-retryable or exhausted path:

`QUEUED -> PROCESSING -> DEAD`

Old dead jobs should be archived, not hard-deleted.
Old sent jobs should be archived from the default view instead of hard-deleted.

Default backoff:

- attempt 1 retry after 1 minute
- attempt 2 retry after 5 minutes
- attempt 3 retry after 15 minutes
- attempt 4 retry after 1 hour
- move to `DEAD` after max attempts

Stuck-job behavior:

- queued warning threshold defaults to 5 minutes
- processing warning threshold defaults to 5 minutes
- stale processing recovery defaults to 10 minutes
- worker heartbeat is considered stale after roughly two poll intervals plus buffer unless overridden by env

If `QUEUED` stays too long, check the worker heartbeat first.
If `PROCESSING` stays too long, the worker should recover it automatically; if not, inspect the worker logs and latest failure reason.
If `DEAD` appears, check `failureReason` and the safe provider message before retrying.

## Troubleshooting

1. Confirm `MAIL_PROVIDER=mailrelay`.
2. Confirm Mailrelay sender identities match configured `MAIL_FROM_*` values.
3. If jobs fail with `SENDER_NOT_CONFIRMED`, confirm the From address shown on the job in Mailrelay. Do not remap account or classroom flows to `admin@projtrack.codes`.
4. If jobs stay `QUEUED`, check the dedicated worker process first: it must have `MAIL_WORKER_ENABLED=true`, the same `DATABASE_URL`, and `MAIL_PROVIDER=mailrelay`.
5. Check `nextTryAt`: `null` or a past timestamp is eligible; a future timestamp is intentionally delayed.
6. Check Admin -> Mail Jobs for failed jobs and safe provider errors.
7. Retry a failed/dead job after fixing sender/API configuration; manual retry makes it immediately eligible.
8. Keep `TESTMAIL_ENABLED=false` in production.
9. If Mailrelay returns an error body, only a redacted/truncated detail should be logged or shown.
10. Production needs one worker only unless multi-worker locking is intentionally validated.
11. Use archive actions to remove old sent/dead jobs from the default view instead of deleting them.

Do not enable SMTP credentials in production.
Do not commit secrets, API keys, activation links, reset links, or provider tokens.

## Daily Operator Check

Perform this once per day:

1. Confirm Admin -> Mail Jobs shows a healthy worker heartbeat.
2. Confirm queue depth is near zero and `queued-too-long` is zero.
3. Confirm `processing-too-long` is zero.
4. Confirm `latest sent` is recent enough for expected traffic.
5. Review any `DEAD` jobs and archive only after the failure reason is understood.
6. Optionally send one test email to an operator mailbox only when explicitly enabled for that environment.

Daily test email sending must stay disabled by default:

```bash
MAIL_DAILY_HEALTH_TEST_ENABLED=false
MAIL_DAILY_HEALTH_TEST_RECIPIENT=admin@projtrack.codes
```

## UI Success Contract

Admin UI mail actions must not show queued/sent success unless the backend returns a confirmed MailJob ID. If Mailrelay or the queue layer fails to create a job, the UI must show a safe failure message and Mail Jobs must remain the source of truth for delivery state. Provider diagnostics shown to admins must be sanitized and must not include secrets, tokens, reset/setup links, raw payloads, or API keys.

## Classroom Notification Success Contract

Teacher classroom actions must show exact queue outcomes: in-app notifications created, confirmed email jobs queued, and any safe queue warnings. Do not say email jobs were queued unless `emailJobsQueued` is greater than zero or the backend explicitly confirms the count.
