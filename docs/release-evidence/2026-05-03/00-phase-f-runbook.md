# Phase F — DigitalOcean Staging Runbook

> **Status when this file landed:** none of the steps below have been
> executed. Everything below is a *runnable runbook* derived from the actual
> repo files (`infra/`, `backend/scripts/`, `docs/env/`, `MONITORING_RUNBOOK.md`).
> The build automation deliberately has no DigitalOcean API token, no
> Name.com API token, no SSH key on a Droplet, and no `workflow` PAT scope —
> so it cannot perform any of these steps for you. Run them as the operator
> with the listed commands, paste the outputs into
> `docs/release-evidence/<YYYY-MM-DD>/`, then update
> `FINAL_READINESS_CHECKLIST.md`.

> **Hard rules (carried forward from the brief):**
> - Do **not** shut down Vercel.
> - Do **not** change Name.com nameservers.
> - Do **not** delete MX, SPF, DKIM, DMARC, or TXT verification records.
> - Do **not** mark a step complete unless the real run actually passed.
> - Stage 1 DNS only adds `staging` and `api-staging`. **Do not add `@`,
>   `www`, or `api` until Stage 2 / Stage 3 of `VERCEL_CUTOVER_PLAN.md`.**

---

## Step 0 — Apply the pending CI workflow patch

**What it does.** Adds three required steps to the `backend` job in
`.github/workflows/ci.yml` (verified against the patch file
`docs/phase-b/ci-workflow.patch`):

```yaml
- name: Runtime safety unit tests (jest)
  run: npm run test:unit
- name: Production runtime boot check (NODE_ENV=production)
  run: npm run check:runtime:prod
- name: Worker boot smoke (mail + backup workers)
  run: npm run smoke:worker
```

The frontend job and the e2e job are **unchanged** by this patch — only the
backend job gains the three steps. After the patch is applied, the 242
backend jest tests (Phase D + Phase E) and the live boot probes become
required CI gates instead of run-on-demand scripts.

**Why automation can't apply it.** GitHub blocks workflow-file edits via PATs
without the `workflow` scope. The PAT in this environment has only
`contents:write`. Confirmed in Phase B / D / E.

**Operator commands** (one of two paths).

Path A — git apply via PR with a maintainer account:

```bash
git fetch origin main
git checkout -b ci/apply-phase-b-patch origin/main
git apply docs/phase-b/ci-workflow.patch
git diff --stat .github/workflows/ci.yml          # expect 3 added steps
git add .github/workflows/ci.yml
git commit -m "ci: wire Phase B runtime + worker gates into backend job"
git push origin ci/apply-phase-b-patch
gh pr create --base main --fill --title "Apply ci-workflow.patch (Phase B gates)"
gh pr merge --squash --auto
```

Path B — edit `.github/workflows/ci.yml` directly on github.com and paste
the three steps from the patch immediately after `- run: npm run test`.

**Verification.** Push any tiny change, then:

```bash
gh run list --branch main --limit 4
gh run view <run-id> --log | grep -E "(Runtime safety|Production runtime|Worker boot)"
```

Both `CI` and `Production Candidate Verification` must report `success`.

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/01-ci-workflow-patch.md`
with: PR URL, merge SHA, link to a green CI run on `main` after merge.

---

## Step 1 — Provision DigitalOcean staging

Resources required:

| Resource | Slug / size (recommendation) | Region | Notes |
|---|---|---|---|
| Droplet | `s-2vcpu-4gb` (Ubuntu 22.04) | `sgp1` (matches existing Spaces region) | Reserved IP attached; SSH key only, no password |
| Managed Postgres (staging) | smallest (1 vCPU, 1 GB RAM, 10 GB disk) | `sgp1` | Trusted-source = Droplet reserved IP only |
| Spaces (staging) | `projtrack-staging-uploads`, **private** | `sgp1` | Generate one access key; scope to that bucket if your plan supports it |
| Spaces (backups, optional but recommended) | `projtrack-staging-backups`, private | `sgp1` | Backup destination for the worker |

**doctl one-shot (operator, not automation):**

```bash
doctl auth init                                                       # paste DO API token
doctl projects create --name projtrack-staging \
                      --description "ProjTrack staging environment" \
                      --purpose "Service or API" --environment Staging

# Droplet
doctl compute ssh-key list
doctl compute droplet create projtrack-staging \
  --image ubuntu-22-04-x64 --size s-2vcpu-4gb --region sgp1 \
  --ssh-keys <SSH_KEY_FINGERPRINT> --enable-monitoring --enable-ipv6 \
  --tag-names projtrack,staging --wait
DROPLET_ID=$(doctl compute droplet list --format ID,Name --no-header | awk '/projtrack-staging/{print $1}')
doctl compute reserved-ip create --region sgp1
RESERVED_IP=$(doctl compute reserved-ip list --format IP --no-header | tail -1)
doctl compute reserved-ip-action assign "$RESERVED_IP" "$DROPLET_ID"
echo "Droplet IP: $RESERVED_IP"

# Postgres
doctl databases create projtrack-staging-pg \
  --engine pg --version 16 --size db-s-1vcpu-1gb --region sgp1 --num-nodes 1
DB_ID=$(doctl databases list --format ID,Name --no-header | awk '/projtrack-staging-pg/{print $1}')
doctl databases firewalls append "$DB_ID" --rule "droplet:$DROPLET_ID"
doctl databases db create "$DB_ID" projtrack_staging
doctl databases connection "$DB_ID" --format URI --no-header

# Spaces (must use s3cmd or AWS CLI; doctl does not create Spaces)
# Use the DO console: Spaces Object Storage → Create Spaces Bucket
#   - Region: sgp1
#   - Bucket name: projtrack-staging-uploads     (private)
#   - Bucket name: projtrack-staging-backups     (private)
# Then: Spaces Object Storage → API → Generate New Key, scope to bucket if available
```

**ClamAV** is run as a sidecar in the existing
`infra/docker-compose.production.yml` (`clamav/clamav:1.3` image with
`clamdcheck.sh` healthcheck). No separate provisioning needed.

**Mail** for staging: keep `MAIL_PROVIDER=mailrelay` with a Mailrelay
**test list / test sender**, **not** the production sender. The staging env
template enforces this — see Step 4.

**Evidence.**
`docs/release-evidence/<YYYY-MM-DD>/07-do-resources.md` — paste the
`doctl droplet get`, `doctl databases get`, and Spaces console screenshots
(redact secrets).

---

## Step 2 — Add Name.com Stage 1 DNS only

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `staging` | `<DROPLET_RESERVED_IP>` | 300 |
| A | `api-staging` | `<DROPLET_RESERVED_IP>` | 300 |

**Do not add** `@`, `www`, or `api` yet. Those are Stage 2 / Stage 3 of
`VERCEL_CUTOVER_PLAN.md`.

**Preserve every existing email / verification record.** Before you save,
confirm the editor still shows: MX, SPF (`v=spf1`), DKIM, DMARC, and any
domain-verification TXT records. If the Name.com UI ever offers
"replace-all", click cancel.

**Verification.**

```bash
dig +short A staging.projtrack.codes        @1.1.1.1
dig +short A api-staging.projtrack.codes    @1.1.1.1
# Both must equal $RESERVED_IP. Email records unchanged:
dig +short MX projtrack.codes               @1.1.1.1
dig +short TXT projtrack.codes              @1.1.1.1
```

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/06-dns.md` —
copy of records list (with email records visibly preserved) + `dig` output.

---

## Step 3 — Bootstrap the Droplet

```bash
ssh root@<RESERVED_IP>
curl -fsSL https://raw.githubusercontent.com/Ediwow110/ProjTrack-Official/main/infra/digitalocean-bootstrap.sh \
  | sudo bash
```

The script is idempotent and verified by reading
`infra/digitalocean-bootstrap.sh`. It installs Docker CE, the Compose plugin,
Caddy, configures `ufw` to allow only 22 / 80 / 443, enables unattended
security upgrades, prepares `/opt/projtrack/{repo,data}`, clones the repo at
`/opt/projtrack/repo`, and copies `infra/Caddyfile.example` to
`/etc/caddy/Caddyfile` plus `infra/docker-compose.production.yml` to
`/opt/projtrack/docker-compose.yml`.

**Verification.**

```bash
docker --version && docker compose version
caddy version
ufw status verbose                        # only 22/tcp, 80/tcp, 443/tcp
ls -la /opt/projtrack/repo/.git
```

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/02-bootstrap.md` with the
above command outputs.

---

## Step 4 — Configure staging environment

Use `docs/env/staging.env.example` as the template. Required values to set
(generate the secrets fresh; they must be **distinct from production**):

```bash
sudo cp /opt/projtrack/repo/docs/env/staging.env.example \
        /opt/projtrack/backend.env.staging
sudo chmod 600 /opt/projtrack/backend.env.staging
sudo $EDITOR /opt/projtrack/backend.env.staging
```

Pre-resolved values (already in the template, do not change):

```
NODE_ENV=production
APP_ENV=staging
APP_URL=https://staging.projtrack.codes
FRONTEND_URL=https://staging.projtrack.codes
BACKEND_URL=https://api-staging.projtrack.codes
CORS_ORIGINS=https://staging.projtrack.codes
COOKIE_DOMAIN=projtrack.codes
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
TRUST_PROXY=true
PORT=3002                 # Caddy upstream for api-staging
FILE_MALWARE_SCAN_MODE=fail-closed
FILE_MALWARE_SCANNER=clamav
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
HTTP_RATE_LIMIT_STORE=database
ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=false
```

Values you must paste:

| Key | How to generate / where to find |
|---|---|
| `DATABASE_URL` | `doctl databases connection $DB_ID --format URI --no-header`, append `?sslmode=require`, replace database name with `projtrack_staging` |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 60` (must differ from prod) |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 60` (must differ from prod and from access) |
| `ACCOUNT_ACTION_TOKEN_ENC_KEY` | `openssl rand -base64 32` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | DO Spaces → API → Generate New Key (scoped to the staging buckets) |
| `MAILRELAY_API_KEY` | Mailrelay → API keys (use the staging key, not prod) |

The file ships with `BACKUP_WORKER_ENABLED=false` and
`BACKUP_SCHEDULE_ENABLED=false`. Flip them to `true` once
`projtrack-staging-backups` is wired and you have a destination configured.

---

## Step 5 — Deploy the staging stack

The compose file ships with these services (verified by reading
`infra/docker-compose.production.yml`):

- `backend` (port `127.0.0.1:3001` mapped — **for staging you must change to
  3002 to match the Caddyfile staging upstream**)
- `mail-worker` (`MAIL_WORKER_ENABLED=true`)
- `backup-worker` (`BACKUP_WORKER_ENABLED=true`, `BACKUP_SCHEDULE_ENABLED=true`)
- `clamav` (`clamav/clamav:1.3` with `clamdcheck.sh` healthcheck)

**Operator commands** (on the Droplet):

```bash
cd /opt/projtrack
# (One-time) edit docker-compose.yml: change backend ports line to "127.0.0.1:3002:3002"
# and add PORT=3002 to the staging env_file (already in the template).

sudo docker compose --env-file backend.env.staging build
sudo docker compose --env-file backend.env.staging run --rm backend npx prisma generate
sudo docker compose --env-file backend.env.staging run --rm backend npx prisma migrate deploy
sudo docker compose --env-file backend.env.staging up -d
sudo docker compose ps
sudo docker compose logs --tail=200 backend mail-worker backup-worker clamav
```

All four containers must report `healthy` (`backend` after ~30 s start
period; `clamav` after ~120 s start period).

**Evidence.**
`docs/release-evidence/<YYYY-MM-DD>/10-container-health.md` — `docker
compose ps` output, plus the first 100 lines of each service's logs.
`docs/release-evidence/<YYYY-MM-DD>/11-prisma-migrate.md` — full output of
`prisma migrate deploy`.

---

## Step 6 — Verify HTTPS, liveness, readiness

After containers are up, reload Caddy so it issues certs:

```bash
sudo systemctl reload caddy
sudo journalctl -u caddy --since "5 minutes ago" | grep -i "obtain\|issued"
```

Expected: Let's Encrypt issues certs for `staging.projtrack.codes` and
`api-staging.projtrack.codes` within ~30 s once the A records resolve.

**Probes** (verified against `MONITORING_RUNBOOK.md` § "Probe targets"):

```bash
curl -fsS https://staging.projtrack.codes/                 | head -c 80
curl -fsS https://api-staging.projtrack.codes/health/live  | jq .
curl -fsS https://api-staging.projtrack.codes/health/ready | jq .
```

`/health/ready` body must contain `"ok": true` and `checks.database`,
`checks.storage`, `checks.mail`, `checks.configuration`, `checks.backup`
all `true` (the exact contract that `health.service.spec.ts` was written
against in Phase E).

**Evidence.**
- `docs/release-evidence/<YYYY-MM-DD>/03-runtime-boot.md` — first 200 lines of
  `backend` container logs from cold start, showing the runtime-safety
  config inspection lines and the "Nest application successfully started"
  line.
- `docs/release-evidence/<YYYY-MM-DD>/09-caddy-https.md` — Caddy issuance
  log lines + `curl -vI https://...` headers showing the cert chain.

---

## Step 7 — Run the real staging smoke

```bash
ssh root@<RESERVED_IP>
cd /opt/projtrack/repo/backend
sudo npm ci
export DATABASE_URL='<staging URI from backend.env.staging>'
export SMOKE_ADMIN_EMAIL='<staging admin email>'
export SMOKE_ADMIN_PASSWORD='<staging admin password>'
sudo -E npm run smoke:staging:summary
```

The script (verified by reading `backend/scripts/staging-smoke-summary.mjs`)
refuses to run when `DATABASE_URL` matches `projtrack-prod`,
`projtrack_prod`, `prod.projtrack`, or `production.projtrack`, and refuses
when `NODE_ENV=production` without `STAGING_SMOKE_OVERRIDE`. It then runs
`scripts/smoke.js --real-accounts` and prints `=== staging-smoke-summary
===` with `overall: PASS` or `overall: FAIL`.

**On FAIL, stop here. Do not continue to Step 8.** Inspect the smoke output
above the summary line for the failing assertion.

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/04-staging-smoke.md` —
full stdout/stderr including the summary block.

---

## Step 8 — Run the backup/restore drill

The drill (verified by reading `backend/scripts/backup-restore-drill.mjs`)
requires:

1. A disposable target Postgres whose URL contains one of `disposable`,
   `drill`, `scratch`, `throwaway`, `tmp`, `temp`, or `test`.
2. The target URL must **not** match `projtrack-prod`, `projtrack_prod`,
   `prod.projtrack`, `production.projtrack`, `production-host`, or
   `.projtrack.codes`.
3. `BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND`.

The drill runs `pg_dump --no-owner --no-privileges --clean --if-exists`,
restores via `psql --single-transaction -v ON_ERROR_STOP=1`, then verifies
that `User`, `StudentProfile`, `TeacherProfile`, `Submission`,
`SubjectSection`, `EmailJob`, `BackupRun` exist and are non-empty (override
with `BACKUP_DRILL_ALLOW_EMPTY=true`).

**Operator commands.**

```bash
# Provision a disposable target DB on the same staging Postgres cluster.
doctl databases db create $DB_ID projtrack_drill_target

DRILL_TARGET_URL=$(doctl databases connection $DB_ID --format URI --no-header \
                   | sed 's@/[^/]*$@/projtrack_drill_target@')

# Confirm guards will accept the target.
echo "$DRILL_TARGET_URL" | grep -E '(disposable|drill|scratch|throwaway|tmp|temp|test)'

apt-get install -y postgresql-client     # provides pg_dump + psql

cd /opt/projtrack/repo
BACKUP_DRILL_SOURCE_DATABASE_URL='<staging URI>' \
BACKUP_DRILL_TARGET_DATABASE_URL="$DRILL_TARGET_URL" \
BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND \
node backend/scripts/backup-restore-drill.mjs
```

Expected final line: `backup-restore-drill PASSED`.

After the drill, drop the disposable database:

```bash
doctl databases db delete $DB_ID projtrack_drill_target --force
```

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/05-backup-drill.md` —
full script output including the dump byte count, every per-table row count,
and the final PASSED line.

---

## Step 9 — Configure DigitalOcean monitoring

Follow `MONITORING_RUNBOOK.md` (§ "Probe targets" and § "Alert policies")
exactly. Minimum to mark monitoring complete:

- 5 Uptime probes created and reporting OK:
  - `https://projtrack.codes/` (will only resolve after Stage 3 — set up but
    leave silenced until cutover; **do not flip `@` DNS** to test it now)
  - `https://api.projtrack.codes/health/live` (Stage 2 only)
  - `https://api.projtrack.codes/health/ready` (Stage 2 only)
  - `https://staging.projtrack.codes/`
  - `https://api-staging.projtrack.codes/health/ready`
- Droplet alerts for CPU > 85% (10 min), memory > 90% (5 min), disk > 80%
  (warning) and > 90% (page).
- Container restart count > 3× / 10 min — page.
- Synthetic-check alert on `/health/ready` JSON: `mail.oldestPendingMs >
  MAIL_PROCESSING_STALE_MS` and `backup.lastRunAgoMs > 25h`.
- Each alert policy must be **test-fired** at least once (force a failing
  condition, confirm notification arrives, restore).

**Evidence.** `docs/release-evidence/<YYYY-MM-DD>/08-monitoring.md` —
list of every alert-policy ID/name + a screenshot per category showing the
test-fire notification that arrived.

---

## Step 10 — Update evidence directory and checklist

Per `docs/release-evidence/README.md` (Phase D contract), each evidence
file is numbered, contains real captured output, and never contains
secrets.

```bash
# After every step above PASSED:
mkdir -p docs/release-evidence/$(date -u +%Y-%m-%d)
cd docs/release-evidence/$(date -u +%Y-%m-%d)
# Paste outputs into the files named in each step above.
# Add 12-npm-audit.md (run npm audit --audit-level=high --omit=dev on the Droplet).
# Add 13-production-smoke.md ONLY if Stage 2 cutover ran (out of scope for Phase F).
# Sign off LAST in 14-go-no-go-signoff.md.
```

Then update `FINAL_READINESS_CHECKLIST.md` — only tick boxes whose evidence
file is committed and contains a real PASS.

---

## Step 11 — Verdict update rules

| Outcome | New verdict |
|---|---|
| Steps 0-9 all green, evidence committed, sign-off recorded | `CONDITIONAL GO` → can proceed to Stage 2 cutover (`VERCEL_CUTOVER_PLAN.md`) |
| Any step blocked or failing | `CONDITIONAL GO` (unchanged) — record blocker in audit |
| Stages 2 + 3 of cutover plan complete with 7-day healthy watch | only then can `FULL GO` be considered |

**Phase F itself does not change the verdict.** It documents the operator
path. The verdict transition happens when the operator commits real
evidence files.
