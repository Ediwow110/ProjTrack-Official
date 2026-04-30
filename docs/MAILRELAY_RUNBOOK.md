# Mailrelay Runbook for ProjTrack

This runbook provides operational guidance for setting up, validating, and troubleshooting the Mailrelay integration used for email sending in ProjTrack. Mailrelay is the designated provider for both staging and production environments.

## Setup Instructions

### Step 1: Account and API Credentials
- **Account Creation**: Sign up for a Mailrelay account at [Mailrelay website](https://mailrelay.com).
- **API Key**: Obtain the API key from your Mailrelay dashboard under API settings.
- **API URL**: Note the API endpoint URL provided by Mailrelay for sending emails (e.g., `https://your-account.mailrelay.com/api`).

### Step 2: Sender Verification
- **Sender Emails**: Add and verify the sender email addresses to be used in ProjTrack:
  - `noreply@projtrack.codes` (for automated notifications)
  - `admin@projtrack.codes` (for administrative communications)
  - `invite@projtrack.codes` (for user invitations)
  - `notify@projtrack.codes` (for general notifications)
  - `support@projtrack.codes` (for user support)
- **Verification Process**: Follow Mailrelay's instructions to verify each sender email by confirming ownership via email or DNS records.

### Step 3: DNS Configuration
- **SPF Record**: Add an SPF record to your domain's DNS to authorize Mailrelay to send emails on your behalf. Example:
  ```
  v=spf1 include:mailrelay.com ~all
  ```
  Adjust based on Mailrelay's specific guidance if you have other email services in use.
- **DKIM Record**: Generate DKIM keys in Mailrelay dashboard and add the provided TXT record to your DNS. This ensures email authenticity.
- **DMARC Policy**: Set up a DMARC policy to handle failed authentications (start with `none` for testing, then move to `quarantine` or `reject`):
  ```
  v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com;
  ```
- **Tracking Domain**: Optionally, configure a custom tracking domain in Mailrelay for link tracking by adding a CNAME record pointing to Mailrelay's tracking server.

### Step 4: Environment Variables
- Set the following environment variables in staging and production environments:
  - `MAIL_PROVIDER=mailrelay`
  - `MAILRELAY_API_KEY=your-api-key`
  - `MAILRELAY_API_URL=your-api-url`
  - `MAIL_WORKER_ENABLED=true` (to enable background email sending)
  - `MAIL_FROM_NOREPLY=noreply@projtrack.codes`
  - `MAIL_FROM_ADMIN=admin@projtrack.codes`
  - `MAIL_FROM_INVITE=invite@projtrack.codes`
  - `MAIL_FROM_NOTIFY=notify@projtrack.codes`
  - `MAIL_FROM_SUPPORT=support@projtrack.codes`
- For smoke tests, set `MAIL_SMOKE_TO=your-test-email@example.com` to receive test emails.

## Validation

### Step 1: Smoke Test
- **Command**: Run the mail smoke test to verify email sending:
  ```bash
  MAIL_SMOKE_TO=your-test-email@example.com npm --prefix backend run smoke:mail
  ```
- **Expected Outcome**: An email should be received at the specified address. Check for correct sender, subject, and content.

### Step 2: Manual Validation
- **Trigger Test Emails**: Use application features that send emails (e.g., user invite, password reset) to confirm delivery from different sender addresses.
- **Check Delivery Reports**: Review Mailrelay dashboard for sent email logs, bounce rates, and open/click statistics to ensure emails are not marked as spam.
- **Spam Filter Testing**: Send test emails to common providers (e.g., Gmail, Outlook) to verify they land in the inbox, not spam folder. Adjust DNS settings if needed.

## Troubleshooting

- **Emails Not Sent**:
  - Verify `MAIL_WORKER_ENABLED=true` to ensure the email sending worker is active.
  - Check `MAILRELAY_API_KEY` and `MAILRELAY_API_URL` for correctness. Test API connectivity with a simple curl request if needed.
  - Review backend logs for API errors or rate limit messages from Mailrelay.
- **Emails Marked as Spam**:
  - Confirm SPF, DKIM, and DMARC records are correctly set up and propagated (use tools like `dig` or online DNS checkers).
  - Check sender reputation in Mailrelay dashboard; request delisting if blacklisted.
  - Avoid spammy content in email templates (e.g., excessive links, all caps) by reviewing `backend/src/mail/mail.templates.ts`.
- **Bounce Rates High**:
  - Ensure recipient lists are clean; remove invalid emails after bounces are reported.
  - Verify sender email verification status in Mailrelay.
- **Emails Queued but Delayed**:
  - Check `MAIL_WORKER_POLL_MS` (default 60000) to ensure the worker checks the queue frequently enough. Lower if delays are critical.
  - Review Mailrelay account limits or throttling policies.
- **Authentication Failures**:
  - If DKIM/SPF fails, recheck DNS records for typos or propagation delays (can take 24-48 hours).
  - Update DMARC policy to `p=quarantine` or `p=reject` only after confirming setup to avoid false positives.

## Operational Procedures

- **Quota Management**: Monitor email sending quotas in Mailrelay dashboard. Upgrade plan or request temporary increases if nearing limits during high-volume periods (e.g., start of academic term).
- **Template Updates**: If email templates in `backend/src/mail/mail.templates.ts` are updated, test with `npm --prefix backend run smoke:mail` to ensure formatting and variable substitution work as expected.
- **Incident Response**: If email delivery fails for critical notifications (e.g., password resets), switch to a fallback provider temporarily by updating `MAIL_PROVIDER` and related variables, or communicate via alternative channels (e.g., in-app messages).

## Security Considerations

- **API Key Security**: Store `MAILRELAY_API_KEY` securely in environment variables, never in source code. Rotate the key periodically or if a breach is suspected via Mailrelay dashboard.
- **Sender Spoofing Prevention**: Ensure all sender emails are verified and DNS records are locked to prevent unauthorized use of your domain.
- **Rate Limiting**: Be aware of Mailrelay's rate limits to avoid service interruptions. Configure `MAIL_WORKER_POLL_MS` to space out sends if needed.

## Documentation and Updates

- **Email Logs**: Maintain logs of critical email failures or delivery issues for audit purposes. Backend logs should capture API responses from Mailrelay for debugging.
- **Runbook Review**: Update this runbook after significant email-related incidents or Mailrelay policy changes to reflect lessons learned or new best practices.

This runbook ensures reliable email delivery for ProjTrack through Mailrelay, with clear steps for setup, validation, and issue resolution to maintain user communication integrity.
