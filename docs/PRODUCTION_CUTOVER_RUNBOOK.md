# Production Cutover Runbook

This runbook is the **exact deployment sequence** for promoting the candidate SHA on `production-hardening-repo-audit` to production. It must not be executed until `docs/FINAL_PRODUCTION_APPROVAL_CHECKLIST.md` is complete and signed.

> **Secrets policy.** Never paste real secrets into this file or into chat / commit messages / PR comments. All secret values live exclusively in the production secret manager. The commands below reference environment variables and placeholders only.

## Inputs

- `RELEASE_SHA` — the approved candidate SHA (e.g. `8f90169369cb3186900ea5136cadf7eca2000025`)
- `RELEASE_TAG` — the annotated tag for this release (e.g. `v2026.05.06-prod`)
- Production secrets pre-loaded into the production secret manager / orchestrator
- Backend production image tag, e.g. `projtrack/backend:<RELEASE_SHA>`
- Frontend artifact handle (Vercel project + commit)

## 0. Pre-flight (no changes yet)

```bash
# Confirm checklist
grep -c '^- \[ \]' docs/FINAL_PRODUCTION_APPROVAL_CHECKLIST.md   # must be 0 unchecked

# Confirm CI green
gh run list --branch production-hardening-repo-audit --limit 5
# expect: completed / success on the SHA

# Confirm migrations pending count is what was reviewed
npm --prefix backend run prisma:validate
# (run a "migrate diff" against the production DB out-of-band; do NOT run migrate from a laptop)
```

## 1. Freeze changes

- Announce release freeze in the team channel.
- Disable auto-merge on `main` and the release branch.
- Confirm no schema-affecting PRs are open outside this release.

## 2. Record release SHA

```bash
echo "$RELEASE_SHA" > /tmp/release-sha.txt
git -C /home/ubuntu/repos/ProjTrack-Official log -1 --pretty=fuller "$RELEASE_SHA"
```

Paste the commit hash and author into `docs/PRODUCTION_LAUNCH_SIGNOFF.md` at the start of the cutover.

## 3. Tag the release

```bash
git -C /home/ubuntu/repos/ProjTrack-Official tag -a "$RELEASE_TAG" -m "Production release $RELEASE_TAG" "$RELEASE_SHA"
git -C /home/ubuntu/repos/ProjTrack-Official push origin "$RELEASE_TAG"
```

## 4. Build the backend image

Build in CI (preferred) or on a clean release host. Never build from a developer laptop.

```bash
docker build \
  -f Dockerfile.backend \
  -t "projtrack/backend:${RELEASE_SHA}" \
  -t "projtrack/backend:latest" \
  .

# Push to production registry (do NOT push :latest as the rollout pointer; use the SHA tag)
docker push "projtrack/backend:${RELEASE_SHA}"
```

## 5. Build the frontend artifact

For Vercel: the production deployment is created by promoting the existing preview deployment for `RELEASE_SHA` to production via the Vercel UI or `vercel promote <preview-url> --scope <team>`. Do not run `npm run build` from a laptop and upload — use the immutable Vercel build for the SHA.

For self-hosted frontends (if applicable): `npm run build` in CI on `RELEASE_SHA`, then upload the `dist/` to the production CDN bucket.

## 6. Pre-deploy DB backup

```bash
# Run from a host that has psql/pg_dump matching the production Postgres major version.
# DATABASE_URL is read from the production secret manager into the host shell ONLY for this command.

DUMP_FILE="/srv/backups/projtrack-pre-${RELEASE_TAG}.sql.gz"

pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" \
  | gzip -9 > "$DUMP_FILE"

# Verify
test -s "$DUMP_FILE" || { echo "FAIL: empty dump"; exit 1; }
sha256sum "$DUMP_FILE" | tee "${DUMP_FILE}.sha256"
ls -la "$DUMP_FILE"
```

## 7. Verify backup off-host

Ship the backup off the application host immediately:

```bash
# AWS S3 example
aws s3 cp "$DUMP_FILE"           "s3://${PROD_BACKUP_BUCKET}/pre-deploy/${RELEASE_TAG}.sql.gz" --sse AES256
aws s3 cp "${DUMP_FILE}.sha256" "s3://${PROD_BACKUP_BUCKET}/pre-deploy/${RELEASE_TAG}.sql.gz.sha256"

# Verify object exists and matches
aws s3api head-object --bucket "$PROD_BACKUP_BUCKET" --key "pre-deploy/${RELEASE_TAG}.sql.gz"
```

For GCS use `gcloud storage cp` with a CMEK-protected bucket. The bucket must have versioning enabled and a 30+ day retention.

## 8. Run prisma migrate deploy

Run from a privileged migration runner (a sidecar job, a CI runner, or a one-shot container against the production DB). Never from a laptop.

```bash
# Inside a one-shot container with DATABASE_URL bound to the production secret manager:
docker run --rm \
  --env DATABASE_URL \
  "projtrack/backend:${RELEASE_SHA}" \
  npx prisma migrate deploy --schema /app/prisma/schema.prisma
```

Expected: `N migrations applied successfully` (where N is the number reviewed during checklist sign-off).

If migration fails:

- Do **not** roll the schema back with `prisma migrate down` or `psql` ad-hoc DDL.
- Halt cutover. Engage the SRE owner and follow `docs/PRODUCTION_ROLLBACK_RUNBOOK.md`.

## 9. Deploy backend

```bash
# Update the orchestrator pointer (k8s deployment image / DigitalOcean App Platform / compose) to the new SHA.
# Example: DigitalOcean App Platform via doctl
doctl apps update "$DO_APP_ID" --spec /etc/projtrack/app-spec-${RELEASE_SHA}.yaml

# Or k8s
kubectl set image deployment/projtrack-backend api="projtrack/backend:${RELEASE_SHA}"
kubectl rollout status deployment/projtrack-backend --timeout=180s
```

Wait for orchestrator-reported readiness before continuing.

## 10. Deploy worker

Mail-worker and backup-worker run the same image with `command: ["node", "dist/worker.js"]`. The image swap from §9 also applies to the worker deployments.

```bash
kubectl set image deployment/projtrack-mail-worker   worker="projtrack/backend:${RELEASE_SHA}"
kubectl set image deployment/projtrack-backup-worker worker="projtrack/backend:${RELEASE_SHA}"
kubectl rollout status deployment/projtrack-mail-worker   --timeout=180s
kubectl rollout status deployment/projtrack-backup-worker --timeout=180s
```

Or for compose-based hosts:

```bash
docker compose -f infra/docker-compose.production.yml --env-file /etc/projtrack/.env up -d --no-deps mail-worker backup-worker
```

## 11. Deploy frontend

If the Vercel project is configured for production-on-promote:

- Promote the preview deployment for `RELEASE_SHA` to production via the Vercel UI or CLI.
- Confirm the production alias now points at the new deployment (`vercel inspect <prod-domain>`).

If using a self-hosted frontend, swap the CDN origin or static-asset symlink to the new build.

## 12. Verify health endpoints

From an external monitor (not from inside the production cluster):

```bash
PROD="https://<production-backend-host>"

curl -fsS "$PROD/health/live"      | jq .         # expect ok:true
curl -fsS "$PROD/health/api-ready" | jq .         # expect ok:true, all checks true
curl -fsS "$PROD/health/ready"     | jq .         # expect ok:true (mail.ok requires real Mailrelay key)
```

If `/health/ready` returns 503 with `mail.ok=false`, the production Mailrelay key is not yet wired or is being rejected. Pause the rollout, fix the secret, and re-check before opening to traffic.

## 13. Run production smoke

Run only the read-only / safe-write production smoke. **Never** point the staging smoke scripts at production. Production smoke admin credentials are scoped to a smoke-only ADMIN account.

```bash
# Production smoke: admin login, RBAC, file metadata read, queue a tagged test email to a safe internal recipient,
# verify health endpoints, verify Vercel deployment alias.
PROD_BACKEND_URL="https://<production-backend-host>" \
PROD_FRONTEND_URL="https://<production-frontend-host>" \
PROD_SMOKE_ADMIN_IDENTIFIER='<production-smoke-admin-identifier>' \
PROD_SMOKE_ADMIN_PASSWORD='<production-smoke-admin-password>' \
node ops/scripts/production-smoke.mjs
```

(If `ops/scripts/production-smoke.mjs` does not exist yet, port the staging smoke logic from `auth-smoke` / `storage-smoke` and run it with `expectedRole=ADMIN`. Do not commit production credentials into the smoke script.)

## 14. Monitor first hour

For the first 60 minutes:

- Tail backend, mail-worker, and backup-worker logs in the production sink.
- Watch for `request.error` rate, `5xx` rate, `mail.failed` count, `backup.completed` cadence.
- Watch alerting channels (Datadog / Loki / DigitalOcean Monitoring) for any new alert.
- Verify a real email send from the production environment to a safe internal recipient returns 200 and is delivered.

## 15. Rollback if triggers fire

Triggers (any one):

- `/health/api-ready` returns non-200 for > 2 minutes
- 5xx rate > 1% over 5 minutes
- New error-class spike (>10× the prior baseline)
- Mail-worker permanently authentication-rejected against Mailrelay
- Storage upload error rate > 1%
- Any data-integrity error reported by clients
- Migration left the schema in an inconsistent state

If triggered, follow `docs/PRODUCTION_ROLLBACK_RUNBOOK.md` immediately.

## 16. Close the cutover

- Update `docs/PRODUCTION_LAUNCH_SIGNOFF.md` with: time deployed, verifier names, observed metrics for the first hour, any incidents.
- Lift the release freeze.
- Close the cutover ticket.
