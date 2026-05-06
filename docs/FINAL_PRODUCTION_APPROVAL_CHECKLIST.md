# Final Production Approval Checklist

This checklist gates the production cutover for SHA `8f90169369cb3186900ea5136cadf7eca2000025` (or any newer intentional commit on `production-hardening-repo-audit`). Every item must be confirmed **by a human approver** before deployment. The checklist must never be filled in with real secret values; record only confirmations and references to where secrets live.

## How to use this file

- Tick `[x]` only after explicit verification.
- Where a secret is involved, record only the *fact of confirmation* (e.g. "rotated 2026-05-06 by SRE owner", "validated against runtime-safety guard"). Never paste secret values.
- If any item is `[ ]`, the cutover is **blocked**.

## 1. Production secrets

- [ ] Production `DATABASE_URL` confirmed; host is the production Postgres host (not `localhost`, not `127.0.0.1`, not `[::1]`, not `@db:`, not `@postgres:`, not `file:`/`sqlite:` scheme, not the staging hostname).
- [ ] `DATABASE_URL` contains a TLS/SSL parameter appropriate for the provider, or is an explicitly approved private-network connection.
- [ ] `JWT_ACCESS_SECRET` rotated and ≥ 48 characters; not in `runtime-safety.ts:DEFAULT_SECRET_VALUES`; not a placeholder; unique to production.
- [ ] `JWT_REFRESH_SECRET` rotated and ≥ 48 characters; unique to production; distinct from `JWT_ACCESS_SECRET`.
- [ ] `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_KEY_ID` set to production-specific values.
- [ ] `ACCOUNT_ACTION_TOKEN_ENC_KEY` is a 32-byte base64 or hex value (rotated).
- [ ] `AUTH_REFRESH_COOKIE_NAME` uses the `__Secure-` or `__Host-` prefix.
- [ ] `AUTH_REFRESH_COOKIE_SAME_SITE` is `lax` or `strict` (not `none` unless explicitly approved cross-site).
- [ ] `AUTH_REFRESH_COOKIE_SECURE=true` (or equivalent).
- [ ] Production S3 bucket name confirmed (NOT `projtrack-staging`). Bucket is private (`S3_BUCKET_PUBLIC=false`).
- [ ] Production `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` are real production credentials (NOT MinIO defaults). IAM user is scoped to the production bucket only.
- [ ] `S3_ENDPOINT` is the production endpoint (not the staging MinIO container). For AWS-managed S3, this is unset or set to the regional AWS endpoint.
- [ ] `S3_REGION` matches the production bucket region.
- [ ] `S3_FORCE_PATH_STYLE` set correctly for the chosen provider.
- [ ] `S3_SIGNED_URL_TTL_SECONDS` ≤ 600.
- [ ] Production `MAILRELAY_API_KEY` is the real production key. A real-send test from production returns 200, not 401.
- [ ] `MAILRELAY_API_URL` matches the production Mailrelay region/account.
- [ ] All `MAIL_FROM_*` addresses are verified senders in the production Mailrelay account.
- [ ] `MAIL_PROVIDER=mailrelay` in production. No `TESTMAIL_ENABLED=true` in production.
- [ ] Production `CLAMAV_HOST` and `CLAMAV_PORT` are configured (or `FILE_MALWARE_SCAN_MODE` is set to a documented production posture and the choice is approved).
- [ ] `FILE_MALWARE_SCAN_MODE=fail-closed` in production.
- [ ] `BACKUP_STORAGE_PROVIDER` is `gcs` or `s3` (not `local`). Provider-side server-side encryption is enabled at the bucket level.
- [ ] `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_COUNT` match the production retention policy.
- [ ] Monitoring / logging sink configured at the orchestrator level (Docker logging driver, k8s sidecar, or platform-native log forwarder).
- [ ] Error-tracking endpoint configured for the frontend (`POST /monitoring/client-errors` reachable from the production frontend domain via CORS).
- [ ] Secrets are stored in the production secret manager (Vault / SSM / GCP Secret Manager / DigitalOcean App Platform encrypted env vars), not in the repo and not in plain CI variables.

## 2. Production safety

- [ ] Production DB backup will be taken **before** `prisma migrate deploy`, with an off-host destination confirmed.
- [ ] The pre-deploy backup artifact will be persisted to the production backup bucket (off the application host).
- [ ] The pre-deploy backup will be size- and sha256-verified before migration runs.
- [ ] The restore command is documented in `docs/PRODUCTION_ROLLBACK_RUNBOOK.md` and an SRE has read it.
- [ ] Backend rollback path is known: previous image SHA tagged and reachable.
- [ ] Frontend rollback path is known: Vercel alias swap is approved and documented.
- [ ] Worker rollback path is known: same image tag as backend, swapped together.
- [ ] Migration rollback strategy is **forward-fix** or **verified restore from backup** — never `prisma migrate down` or schema-destructive rollback.
- [ ] On-call SRE, security owner, QA owner, and business approver named in `docs/PRODUCTION_LAUNCH_SIGNOFF.md`.
- [ ] Incident-response runbook (`docs/INCIDENT_RESPONSE.md`) is current.

## 3. Production deploy plan

- [ ] Release SHA recorded.
- [ ] Release tag pushed (annotated tag with the same SHA).
- [ ] Backend image built and signed/published to the production registry.
- [ ] Frontend artifact built and uploaded to the production hosting target.
- [ ] Pre-deploy DB backup taken and verified off-host.
- [ ] Migration plan reviewed (number of pending migrations + any data migrations).
- [ ] Rollback image tag is in the registry and verified pull-able.
- [ ] Health-check URLs and expected responses are documented.
- [ ] Production smoke playbook is ready and authorized to run with **production smoke admin credentials only** (not staging).
- [ ] Maintenance window announced and freeze active.

## 4. Repo-level checks (run on the candidate SHA before cutover)

- [ ] `npm run security:secrets` clean
- [ ] `npm run check:release-hygiene` clean
- [ ] `npm run check:frontend-env:production` clean (production-shaped frontend env validates)
- [ ] `npm run typecheck` clean
- [ ] `npm --prefix backend run build` clean
- [ ] `npm --prefix backend run check:boot:production` clean
- [ ] `npm --prefix backend run check:boot:worker` clean
- [ ] `npm --prefix backend test` clean
- [ ] `npm --prefix backend run test:unit` clean
- [ ] GitHub Actions on the SHA: all required checks green

## 5. Approval signatures

| Role | Name | Date (UTC) | Decision |
|---|---|---|---|
| Release owner | | | |
| Security owner | | | |
| SRE owner | | | |
| QA owner | | | |
| Business approver | | | |

If any signature is missing or any item above is unchecked, the cutover is **NOT APPROVED**.
