# Mailrelay Runbook

## Production Provider

Mailrelay is the active production provider. SMTP is not a production path and Sender.net remains inactive future backup only.

Required environment:

```bash
MAIL_PROVIDER=mailrelay
MAILRELAY_API_URL=https://your-mailrelay-api.example
MAILRELAY_API_KEY=replace-with-mailrelay-key
MAIL_FROM_NAME=ProjTrack
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
TESTMAIL_ENABLED=false
MAIL_WORKER_ENABLED=false
```

Run the web backend with workers disabled:

```bash
MAIL_WORKER_ENABLED=false BACKUP_WORKER_ENABLED=false node backend/dist/main.js
```

Run exactly one dedicated worker with workers enabled:

```bash
cd backend
MAIL_WORKER_ENABLED=true BACKUP_WORKER_ENABLED=true npm run start:worker
```

For local Windows testing from the repo root:

```powershell
npm run start:worker
```

## Sender Confirmation

Mailrelay must confirm every configured sender before it will accept messages.
Confirm these addresses in Mailrelay:

- `admin@projtrack.codes`
- `support@projtrack.codes`
- `notification@projtrack.codes`

If Mailrelay rejects `sender email isn't confirmed`, the queue and worker can still be healthy. Admin -> Mail Jobs will show `SENDER_NOT_CONFIRMED`, the From sender used by the job, and a safe provider detail. Fix the sender in Mailrelay before retrying old jobs.

Fast temporary test fix while `support@projtrack.codes` or `notification@projtrack.codes` is still unconfirmed:

```bash
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=admin@projtrack.codes
MAIL_FROM_INVITE=admin@projtrack.codes
MAIL_FROM_NOTIFY=admin@projtrack.codes
MAIL_FROM_SUPPORT=admin@projtrack.codes
```

Restart both the backend web process and the worker process after changing sender env vars.

After confirming the senders in Mailrelay, switch back to:

```bash
MAIL_FROM_ADMIN=admin@projtrack.codes
MAIL_FROM_NOREPLY=support@projtrack.codes
MAIL_FROM_INVITE=support@projtrack.codes
MAIL_FROM_NOTIFY=notification@projtrack.codes
MAIL_FROM_SUPPORT=support@projtrack.codes
```

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
2. The `EmailJob` row has provider `mailrelay`, then moves `QUEUED -> PROCESSING -> SENT`.
3. The Mailrelay dashboard shows the accepted message, and the target Gmail mailbox receives it.

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

Admin -> Students pending-setup accounts use `Send Setup Email`. This creates or reuses a secure activation token internally, queues an `account-activation` mail job, and does not return the token or full setup link in API responses. With local sender testing where every `MAIL_FROM_*` value is `admin@projtrack.codes`, the queued setup job should show `provider=mailrelay` and `From: admin@projtrack.codes`.

Public forgot-password only queues `password-reset` for active users whose requested role matches the account role. The public response stays generic. Pending Setup users should use the admin setup invite flow instead of forgot-password, so a pending setup forgot-password request is skipped and recorded in internal diagnostics.

After an admin clicks `Send Setup Email`, Admin -> Mail Jobs must show a fresh current-timestamp row:

- template `account-activation`
- recipient is the student email
- initial status `QUEUED`
- provider `mailrelay`
- From is resolved from `MAIL_FROM_INVITE`

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
3. If jobs fail with `SENDER_NOT_CONFIRMED`, confirm the From address shown on the job in Mailrelay or temporarily point all `MAIL_FROM_*` values at `admin@projtrack.codes`.
4. If jobs stay `QUEUED`, check the dedicated worker process first: it must have `MAIL_WORKER_ENABLED=true`, the same `DATABASE_URL`, and `MAIL_PROVIDER=mailrelay`.
5. Check `nextTryAt`: `null` or a past timestamp is eligible; a future timestamp is intentionally delayed.
6. Check Admin -> Mail Jobs for failed jobs and safe provider errors.
7. Retry a failed/dead job after fixing sender/API configuration; manual retry makes it immediately eligible.
8. Keep `TESTMAIL_ENABLED=false` in production.
9. If Mailrelay returns an error body, only a redacted/truncated detail should be logged or shown.
10. Production needs one worker only unless multi-worker locking is intentionally validated.
11. Use archive actions to remove old sent/dead jobs from the default view instead of deleting them.

Do not enable SMTP credentials in production.

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
