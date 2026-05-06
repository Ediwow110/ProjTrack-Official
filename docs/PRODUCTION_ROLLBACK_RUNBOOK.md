# Production Rollback Runbook

When a production cutover misbehaves, **stability comes first**: roll the running services back to the last known-good image/artifact, then triage. This runbook is the exact rollback sequence for the production-hardening branch's image-and-Vercel architecture.

> **Secrets policy.** Rollback never requires production secrets to leave the secret manager. If you find yourself reaching for raw credentials, stop and ask the SRE owner.

## Rollback triggers

Trigger rollback when any one of these holds for ≥ 2 minutes (or immediately on confirmed data-integrity error):

- `/health/api-ready` returns non-200 from the production backend host.
- 5xx rate at the public endpoint > 1% over a 5-minute window.
- New `request.error` class spike (>10× baseline).
- Mail-worker permanently rejected by Mailrelay (`AUTH_FAILED` not transient).
- File-upload error rate > 1%, or ClamAV unreachable while `FILE_MALWARE_SCAN_MODE=fail-closed`.
- Authentication regressions (logged-out loops, refresh-token rotation failure).
- Any client-reported data corruption.
- A migration left the schema in an inconsistent state.

If a trigger fires, **announce in the on-call channel** and execute §1–§4 in order.

## 1. Backend image rollback

The backend rollback is a tag swap to the previous SHA's image, which is already in the production registry from the prior release. Workers are rolled together because they share the image.

```bash
PREV_SHA="<previous-known-good-sha>"

# k8s
kubectl set image deployment/projtrack-backend       api="projtrack/backend:${PREV_SHA}"
kubectl set image deployment/projtrack-mail-worker   worker="projtrack/backend:${PREV_SHA}"
kubectl set image deployment/projtrack-backup-worker worker="projtrack/backend:${PREV_SHA}"
kubectl rollout status deployment/projtrack-backend       --timeout=180s
kubectl rollout status deployment/projtrack-mail-worker   --timeout=180s
kubectl rollout status deployment/projtrack-backup-worker --timeout=180s

# Compose-based host (DigitalOcean Droplet)
sed -i "s|image: projtrack/backend:.*|image: projtrack/backend:${PREV_SHA}|" /etc/projtrack/docker-compose.production.yml
docker compose -f /etc/projtrack/docker-compose.production.yml --env-file /etc/projtrack/.env up -d --no-deps backend mail-worker backup-worker

# DigitalOcean App Platform
doctl apps update "$DO_APP_ID" --spec /etc/projtrack/app-spec-${PREV_SHA}.yaml
```

Verify: `curl -fsS https://<production-backend-host>/health/api-ready` returns 200 from the new pod / container.

## 2. Frontend artifact rollback

Vercel:

- Open the project's Deployments list.
- Locate the previous production deployment for `PREV_SHA`.
- Use **Promote to Production** (UI) or `vercel rollback <deployment-id> --scope <team>`.
- Confirm `vercel inspect <prod-domain>` shows the alias now pointing at the previous deployment.

Self-hosted frontend (if applicable):

```bash
ln -sfn /srv/projtrack/frontend/build-${PREV_SHA} /srv/projtrack/frontend/current
nginx -s reload
```

## 3. Worker rollback

Workers run the same image as the backend with `command: ["node", "dist/worker.js"]`, so §1 already rolled them. Verify worker health independently:

```bash
# Mail worker heartbeat (admin token)
curl -fsS -H "Authorization: Bearer $ADMIN_BEARER" "https://<production-backend-host>/health/mail" | jq '{worker: .worker, lastHeartbeatAt: .lastWorkerHeartbeatAt}'

# Backup worker
curl -fsS -H "Authorization: Bearer $ADMIN_BEARER" "https://<production-backend-host>/health/backups" | jq .
```

`heartbeatFresh` should be `true` and `heartbeatProviderMatches` should be `true` within 60 seconds of the rollback completing.

## 4. DB forward-fix strategy (preferred)

For the vast majority of production migration issues, **forward-fix is correct**, not schema rollback. Prisma migrations are append-only.

1. Identify the failure: read the failed migration's diff and the Prisma migration logs from the failed cutover.
2. Author a corrective migration on a branch off the broken release SHA.
3. Run it on a staging copy of the failed-migration DB (use the pre-deploy backup taken in §6 of the cutover runbook to make a disposable copy first, then restore the failed-migration state and apply the fix).
4. Once verified on staging, apply via `prisma migrate deploy` against production.

Forward-fix avoids the data-loss risk of a full restore.

## 5. DB restore strategy (when forward-fix is not safe)

Use the pre-deploy backup from §6 of the cutover runbook. Application-level restore is intentionally disabled; recovery is via `pg_dump`/`psql` against a disposable target first.

```bash
# Step 1: Pull the verified pre-deploy backup off-host
aws s3 cp "s3://${PROD_BACKUP_BUCKET}/pre-deploy/${RELEASE_TAG}.sql.gz"        /tmp/restore.sql.gz
aws s3 cp "s3://${PROD_BACKUP_BUCKET}/pre-deploy/${RELEASE_TAG}.sql.gz.sha256" /tmp/restore.sql.gz.sha256
sha256sum -c /tmp/restore.sql.gz.sha256       # must PASS
gunzip /tmp/restore.sql.gz                    # -> /tmp/restore.sql

# Step 2: Restore into a DISPOSABLE target on the prod Postgres host (NOT into the live DB yet)
# The disposable DB name MUST contain one of: disposable, drill, scratch, throwaway, tmp, temp, test
psql "$PROD_PG_ADMIN_URL" -c 'DROP DATABASE IF EXISTS projtrack_prod_disposable_restore;'
psql "$PROD_PG_ADMIN_URL" -c 'CREATE DATABASE projtrack_prod_disposable_restore;'

DISPOSABLE_URL="$(echo "$DATABASE_URL" | sed 's|/projtrack[^?]*|/projtrack_prod_disposable_restore|')"

psql --quiet --single-transaction -v ON_ERROR_STOP=1 -f /tmp/restore.sql "$DISPOSABLE_URL"

# Step 3: Boot a disposable backend pointed at the restored DB; verify health
docker run --rm -d --name projtrack-restore-validation \
  -p 3099:3001 \
  -e DATABASE_URL="$DISPOSABLE_URL" \
  --env-file /etc/projtrack/restore-validation.env \
  "projtrack/backend:${PREV_SHA}"

curl -fsS http://127.0.0.1:3099/health/live
curl -fsS http://127.0.0.1:3099/health/api-ready

# Step 4: Promote the disposable to live ONLY after SRE+DBA dual sign-off.
# Approaches: rename swap (with downtime), logical replication catch-up, or DR fail-over.
# Coordinate with the on-call DBA. Do NOT freelance this step.
```

## 6. When NOT to roll back migrations

Do not attempt schema rollback in any of these situations:

- The failed migration created data in a new table that has already been written to.
- The failed migration dropped a column whose data is still needed by clients on the rolled-back code path (which would break the new app version that has already been pushed).
- You don't have a verified pre-deploy backup younger than the migration.
- You don't have an SRE + DBA on the call.

In those cases: keep the schema, deploy a forward-fix, or hold traffic on a maintenance page while the DBA assists.

## 7. Post-rollback health checks

Within 5 minutes of completing rollback:

```bash
PROD="https://<production-backend-host>"

curl -fsS "$PROD/health/live"      | jq .   # ok:true
curl -fsS "$PROD/health/api-ready" | jq .   # ok:true, checks all true
curl -fsS "$PROD/health/ready"     | jq .   # ok:true (mail.ok depends on Mailrelay)
```

For all three, expect HTTP 200. If `/health/ready` shows `mail.ok=false`, the Mailrelay key may have been touched during the cutover — coordinate with Security to confirm.

Verify the Vercel production alias resolves to the previous deployment:

```bash
vercel inspect <prod-domain>
```

## 8. Post-rollback smoke checks

Run the same production smoke from `docs/PRODUCTION_CUTOVER_RUNBOOK.md` §13:

- admin login → 200
- invalid login → 401
- refresh + logout
- protected route 200
- file metadata read on a known production file
- queue a tagged test email to a safe internal recipient
- verify the test email is delivered

If smoke fails after rollback, escalate immediately and consider activating the maintenance page while triage continues.

## 9. After-action

- Open an incident report and link it from `docs/PRODUCTION_LAUNCH_SIGNOFF.md`.
- Capture: trigger, time-to-detect, time-to-rollback, time-to-recover, customer impact, root cause, follow-ups.
- File follow-up work as PRs against `production-hardening-repo-audit` or a new hardening branch.
- Schedule the next attempted cutover only after the root cause is fixed and CI is green on the corrected SHA.
