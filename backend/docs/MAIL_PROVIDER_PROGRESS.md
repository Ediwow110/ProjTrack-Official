# Mail API System Progress

ProjTrack now uses an API-provider mail architecture, with Mailrelay as the primary outbound provider and testmail.app as the non-production inbox target.

## Providers

- `MAIL_PROVIDER=mailrelay` sends through Mailrelay's HTTP API and stores the returned provider message id when available.
- `MAIL_PROVIDER=stub` uses the local stub provider and records a synthetic provider message id.
- `MAIL_PROVIDER=resend` remains available as a secondary provider.
- Unknown or legacy `smtp` provider values fall back to the stub provider so local development stays safe.

Provider code lives in:

- `src/mail/providers/mail-provider.interface.ts`
- `src/mail/providers/mailrelay.provider.ts`
- `src/mail/providers/stub.provider.ts`
- `src/mail/providers/resend.provider.ts`
- `src/mail/providers/provider-error-classification.ts`
- `src/mail/mail-provider-router.service.ts`
- `src/mail/mail-limit.service.ts`

## Mail Queue Behavior

- Mail jobs are still persisted as `EmailJob` records.
- `EmailJob.failureReason` stores machine-readable reasons such as Mailrelay limit or API failures.
- Provider message ids are stored in `EmailJob.providerMessageId`.
- `EmailJob.deliveredAt` is set by verified delivered webhooks.
- Outbound idempotency uses `EmailJob.idempotencyKey` and `EmailJob.idempotencyUntil`.
- Password reset, account activation, and invitations should use the dedicated queue helpers on `MailService` instead of raw queue calls.
- Retry delays and queue knobs live in common policy constants, not inline service logic.
- When Mailrelay app-side limits are hit, jobs move to `paused_limit_reached` instead of being deleted.
- Bulk jobs sharing the same `campaignId` or `batchKey` are paused together when a Mailrelay limit is hit.
- Paused jobs can be resumed with `POST /admin/mail-jobs/resume-paused` or retried individually.

## Mailrelay Limits

Mailrelay sends are checked in-app before the API is called.

- Monthly success cap: `MAILRELAY_MONTHLY_LIMIT`
- Daily safety cap: `MAILRELAY_DAILY_SAFETY_LIMIT`
- Transactional per-minute cap: `MAILRELAY_TX_PER_MIN`
- Bulk per-minute cap: `MAILRELAY_BULK_PER_MIN`

Failure reasons currently used for Mailrelay:

- `MAILRELAY_MONTHLY_LIMIT_REACHED`
- `MAILRELAY_DAILY_SAFETY_LIMIT_REACHED`
- `MAILRELAY_RATE_LIMIT_REACHED`
- `MAILRELAY_API_ERROR`

Successful sends count against limits using `EmailJob.status='sent'` plus the stored `sentAt` timestamp.

## Sender Routing

The transport now resolves sender addresses by message category:

- `MAIL_FROM_NOREPLY` for activation, password reset, and verification-style messages
- `MAIL_FROM_INVITE` for bulk invitations
- `MAIL_FROM_NOTIFY` for classroom/activity notifications
- `MAIL_FROM_SUPPORT` for support-style messages
- `MAIL_FROM_ADMIN` for admin broadcasts and system messages

## testmail.app Routing

In non-production environments, outbound mail is rerouted to testmail.app when testmail settings are present.

- Activation and verification-style mail routes to `TEST_EMAIL_ACTIVATION`
- Password reset mail routes to `TEST_EMAIL_PASSWORD_RESET`
- Invitation mail routes to `TEST_EMAIL_INVITE`
- Notification/admin/support mail routes to `TEST_EMAIL_NOTIFICATION`

## Webhooks

Resend webhooks are exposed at `POST /mail/webhooks/resend`.

- Svix headers are verified with `RESEND_WEBHOOK_SECRET`.
- Local unsafe webhook testing can be enabled with `ALLOW_UNSAFE_DEV_WEBHOOKS=true`.
- Events are stored idempotently in `EmailProviderEvent` using the provider plus `svix-id`.
- Duplicate webhook deliveries are ignored safely.
- Delivered events update matching jobs by provider message id.
- Bounce and complaint events add or update an `EmailSuppression` row and mark matching jobs as permanently failed.

## Account Action Tokens

Password reset and account activation no longer depend on token columns on `User`.

- Sessions are stored in `AccountActionToken`.
- Links include both `ref` and `token`.
- The token is shown only in the generated link; the database stores a hash.
- Active sessions can be reused while valid so repeated sends produce stable links inside the policy window.
- Successful reset or activation consumes the session.

Frontend reset and activation pages must submit both values:

- `ref`
- `token`

## Important Environment Variables

Local development:

- `MAIL_PROVIDER=mailrelay`
- `MAIL_FROM_NAME=PROJTRACK`
- `MAIL_FROM_ADMIN=admin@projtrack.codes`
- `MAIL_FROM_NOREPLY=support@projtrack.codes`
- `MAIL_FROM_INVITE=support@projtrack.codes`
- `MAIL_FROM_NOTIFY=notification@projtrack.codes`
- `MAIL_FROM_SUPPORT=support@projtrack.codes`
- `MAILRELAY_API_KEY=<mailrelay-api-key>`
- `MAILRELAY_API_URL=<mailrelay-api-url>`
- `TESTMAIL_ENABLED=false`
- `TESTMAIL_NAMESPACE=<development-only-namespace>`
- `TESTMAIL_API_KEY=<development-only-testmail-api-key>`
- `TEST_EMAIL_ACTIVATION=<development-only-testmail-address>`
- `TEST_EMAIL_PASSWORD_RESET=<development-only-testmail-address>`
- `TEST_EMAIL_INVITE=<development-only-testmail-address>`
- `TEST_EMAIL_NOTIFICATION=<development-only-testmail-address>`
- `APP_URL=http://localhost:5173`
- `ALLOW_UNSAFE_DEV_WEBHOOKS=true`

Production or staging:

- `MAIL_PROVIDER=mailrelay`
- `MAIL_FROM_NAME=PROJTRACK`
- `MAIL_FROM_ADMIN=admin@projtrack.codes`
- `MAIL_FROM_NOREPLY=support@projtrack.codes`
- `MAIL_FROM_INVITE=support@projtrack.codes`
- `MAIL_FROM_NOTIFY=notification@projtrack.codes`
- `MAIL_FROM_SUPPORT=support@projtrack.codes`
- `TESTMAIL_ENABLED=false`
- `MAILRELAY_API_KEY=<mailrelay-api-key>`
- `MAILRELAY_API_URL=<mailrelay-api-url>`
- `ACCOUNT_ACTION_TOKEN_ENC_KEY=<long-random-token-encryption-key>`
- `APP_URL=https://projtrack.codes`

Rate limits remain environment-specific:

- `MAILRELAY_MONTHLY_LIMIT`
- `MAILRELAY_DAILY_SAFETY_LIMIT`
- `MAILRELAY_TX_PER_MIN`
- `MAILRELAY_BULK_PER_MIN`

## Validation

Checks that do not require a running database:

```bash
npm run build
npx prisma validate
npx prisma generate
```

Database-backed checks require PostgreSQL:

```bash
npx prisma migrate status
npm run smoke
```

If those fail with `P1001` or a Docker daemon error, start PostgreSQL first with Docker Desktop or a local PostgreSQL service, then rerun the commands.
