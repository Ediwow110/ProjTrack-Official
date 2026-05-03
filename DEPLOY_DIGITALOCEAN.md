# DigitalOcean Deployment Guide (DNS at Name.com)

This is the canonical guide for deploying ProjTrack to DigitalOcean while
keeping DNS at Name.com. It covers a **Droplet + Caddy** topology because it
is the simplest deployment that meets every production-readiness requirement
already enforced by `runtime-safety.ts`. An App Platform variant is documented
at the end.

> **Hard rules** (also enforced in code by `backend/src/config/runtime-safety.ts`):
> - HTTPS only for `APP_URL`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`.
> - No `localhost` / `127.0.0.1` anywhere in production env.
> - JWT access and refresh secrets must differ and each ≥ 48 characters.
> - `TRUST_PROXY=true` (we are behind Caddy).
> - `OBJECT_STORAGE_MODE=s3`, bucket NOT public.
> - `FILE_MALWARE_SCAN_MODE=fail-closed` with `clamav`.
> - `MAIL_PROVIDER=mailrelay` (no `stub` in production).
> - `HTTP_RATE_LIMIT_STORE=database`.

---

## 1. DigitalOcean services to create

| Service | Purpose | Notes |
| --- | --- | --- |
| **Droplet** (Ubuntu 22.04, 2 vCPU / 4 GB / 80 GB) | Runs backend, mail worker, backup worker, frontend static, ClamAV, Caddy | Enable backups in DO; assign reserved IP |
| **Managed PostgreSQL 16** (basic, 1 vCPU / 1 GB / 10 GB to start) | Production DB | Restrict trusted source = the Droplet's reserved IP |
| **Managed PostgreSQL 16** (smallest tier) | Staging DB | Same project; separate cluster |
| **Spaces bucket** `projtrack-prod-uploads` | Production private uploads | **NOT** public; create access key with read+write |
| **Spaces bucket** `projtrack-staging-uploads` | Staging private uploads | Same |
| **Spaces bucket** `projtrack-prod-backups` | Production DB backups | Lifecycle: keep 30 days |
| **Project: ProjTrack** | Logical grouping | All resources tagged `env:prod` or `env:staging` |

A second small Droplet for staging is recommended but not required; if you
share one Droplet, run two compose stacks on different internal ports.

## 2. Domain layout

| Domain | Points to | Role |
| --- | --- | --- |
| `projtrack.codes` | Droplet IP | Production frontend (Caddy serves built `dist/`) |
| `www.projtrack.codes` | Droplet IP | Production frontend alias |
| `api.projtrack.codes` | Droplet IP | Production backend API |
| `staging.projtrack.codes` | Droplet IP (or staging Droplet IP) | Staging frontend |
| `api-staging.projtrack.codes` | Droplet IP (or staging Droplet IP) | Staging backend API |

## 3. Name.com DNS records

Keep DNS at Name.com. **Add** the records below. **Do NOT remove** existing
`MX`, `SPF`, `DKIM`, `DMARC`, or any TXT verification records currently in
place for Mailrelay/Vercel/email/SSO.

Replace `DROPLET_IP` with your DO reserved IP (e.g. `203.0.113.42`).

| Host | Type | Value | TTL |
| --- | --- | --- | --- |
| `@` | A | `DROPLET_IP` | 300 |
| `www` | A | `DROPLET_IP` | 300 |
| `api` | A | `DROPLET_IP` | 300 |
| `staging` | A | `DROPLET_IP` | 300 |
| `api-staging` | A | `DROPLET_IP` | 300 |

**Cutover safety:** to test the Droplet without flipping `@` away from Vercel,
populate `api`, `staging`, `api-staging` first; leave `@` and `www` on Vercel
until backend cutover is verified end-to-end. Then update `@` and `www` last.

Verify before each cutover step:

```bash
dig +short projtrack.codes
dig +short www.projtrack.codes
dig +short api.projtrack.codes
dig +short staging.projtrack.codes
dig +short api-staging.projtrack.codes
```

## 4. Production environment variables

See `docs/env/production.env.example` for the full template. The values you
must compute / paste in:

| Variable | Source |
| --- | --- |
| `DATABASE_URL` | DO Managed Postgres → "Connection details" → Connection string (use connection pool URL with `sslmode=require`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 60` (run twice, keep distinct) |
| `ACCOUNT_ACTION_TOKEN_ENC_KEY` | `openssl rand -base64 32` |
| `S3_ENDPOINT` | DO Spaces region endpoint, e.g. `https://sgp1.digitaloceanspaces.com` |
| `S3_REGION` | Region slug, e.g. `sgp1` |
| `S3_BUCKET` | `projtrack-prod-uploads` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Spaces access key |
| `MAILRELAY_API_KEY` | Mailrelay dashboard |
| `CLAMAV_HOST` | `clamav` (compose service name) |

Production identity values:

```bash
NODE_ENV=production
APP_ENV=production
APP_URL=https://projtrack.codes
FRONTEND_URL=https://projtrack.codes
BACKEND_URL=https://api.projtrack.codes
CORS_ORIGINS=https://projtrack.codes,https://www.projtrack.codes
COOKIE_DOMAIN=projtrack.codes
TRUST_PROXY=true
TRUST_PROXY_HOPS=1
```

Staging identity values (`docs/env/staging.env.example`):

```bash
NODE_ENV=production            # staging runs production code paths
APP_ENV=staging
APP_URL=https://staging.projtrack.codes
FRONTEND_URL=https://staging.projtrack.codes
BACKEND_URL=https://api-staging.projtrack.codes
CORS_ORIGINS=https://staging.projtrack.codes
COOKIE_DOMAIN=projtrack.codes
TRUST_PROXY=true
TRUST_PROXY_HOPS=1
```

> Note: `runtime-safety.ts` accepts `APP_ENV=staging` as a production-grade
> environment. All security checks remain active.

## 5. Droplet bootstrap

A reusable script is checked in at `infra/digitalocean-bootstrap.sh`. It is
idempotent — re-running it on an existing Droplet only changes what is needed.

```bash
ssh root@DROPLET_IP
curl -fsSL https://raw.githubusercontent.com/Ediwow110/ProjTrack-Official/main/infra/digitalocean-bootstrap.sh | bash
```

What it does:

1. `apt update`, install `ca-certificates`, `curl`, `git`, `ufw`, `unattended-upgrades`.
2. Install Docker CE + the Compose v2 plugin from the official Docker apt repo.
3. Install Caddy from the official Caddy apt repo.
4. Open `ufw` for `22`, `80`, `443` only.
5. Create `/opt/projtrack` and `/opt/projtrack/data`.
6. Clone the repo to `/opt/projtrack/repo` (or pull if already cloned).
7. Copy `infra/Caddyfile.example` to `/etc/caddy/Caddyfile` (edit afterwards).
8. Copy `infra/docker-compose.production.yml` to `/opt/projtrack/docker-compose.yml`.
9. Print the next-step checklist (env files, secrets, prisma migrate).

After the script:

```bash
cd /opt/projtrack
sudo cp repo/docs/env/production.env.example backend.env.production
sudo $EDITOR backend.env.production           # paste real secrets

# Build, migrate, start
sudo docker compose --env-file backend.env.production pull
sudo docker compose --env-file backend.env.production build
sudo docker compose --env-file backend.env.production run --rm backend npx prisma migrate deploy
sudo docker compose --env-file backend.env.production up -d

# Reload Caddy after editing /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will auto-issue Let's Encrypt certs via HTTP-01 once DNS resolves to
the Droplet IP. Verify:

```bash
curl -sS https://api.projtrack.codes/health
curl -sS https://api.projtrack.codes/health/ready
curl -I https://projtrack.codes
```

## 6. Reverse proxy (Caddy)

`infra/Caddyfile.example` already covers all 5 hostnames with automatic HTTPS,
HSTS, gzip+zstd compression, and proper forwarding. Edit only the upstream
hosts/ports if you change the compose layout.

## 7. Workers

`infra/docker-compose.production.yml` runs three backend processes:

- `backend` — HTTP API (`MAIL_WORKER_ENABLED=false`, `BACKUP_WORKER_ENABLED=false`)
- `mail-worker` — `MAIL_WORKER_ENABLED=true` (only one instance)
- `backup-worker` — `BACKUP_WORKER_ENABLED=true`, `BACKUP_SCHEDULE_ENABLED=true`

All three use the **same image** built from `Dockerfile.backend` and the same
env file. Only the `MAIL_WORKER_ENABLED` / `BACKUP_WORKER_ENABLED` flags differ.

Ensure ClamAV is reachable as `clamav:3310` from the backend network, and that
DO Spaces is reachable on outbound 443.

## 8. Frontend deployment

Two options:

**Option A (recommended)** — Caddy serves the built static SPA from the Droplet:

```bash
cd /opt/projtrack/repo
npm ci
VITE_API_BASE_URL=https://api.projtrack.codes npm run build
sudo rm -rf /var/www/projtrack && sudo mkdir -p /var/www/projtrack
sudo cp -r dist/* /var/www/projtrack/
```

`Caddyfile.example` already routes `projtrack.codes` and `www.projtrack.codes`
to `/var/www/projtrack`.

**Option B** — keep the frontend on Vercel temporarily; only the backend moves
to DO. Set Vercel env `VITE_API_BASE_URL=https://api.projtrack.codes` and
re-deploy. Use this during the cutover window; see `VERCEL_CUTOVER_PLAN.md`.

## 9. Verification gate (must pass before flipping `@` and `www`)

Run on the Droplet:

```bash
cd /opt/projtrack/repo/backend
npm run check:runtime:prod         # full prod-env boot probe
npm run smoke:worker               # mail+backup worker boot
DATABASE_URL=$STAGING_DB \
  SMOKE_ADMIN_EMAIL=... \
  SMOKE_ADMIN_PASSWORD=... \
  npm run smoke:staging:summary    # against api-staging.projtrack.codes
```

Expected: every script prints `PASSED` or its equivalent. Capture output to
`/opt/projtrack/data/release-evidence/<date>.log`.

## 10. App Platform variant (alternative)

If you prefer App Platform over a Droplet:

| Component | App Platform mapping |
| --- | --- |
| `backend` | "Web Service", Dockerfile = `Dockerfile.backend`, port 3001, route `/api` |
| `mail-worker` | "Worker", same Dockerfile, override `MAIL_WORKER_ENABLED=true` |
| `backup-worker` | "Worker", same Dockerfile, override `BACKUP_WORKER_ENABLED=true` |
| Frontend | "Static Site", source = repo root, build = `npm ci && VITE_API_BASE_URL=https://api.projtrack.codes npm run build`, output dir = `dist` |
| ClamAV | App Platform does not host ClamAV; either run a tiny ClamAV Droplet at `clamav.internal.projtrack.codes` over TLS, or use a managed scanner. **Without ClamAV, runtime-safety blocks boot.** |

DNS records change to CNAME-style, e.g.:

| Host | Type | Value |
| --- | --- | --- |
| `api` | CNAME | `<app-name>-<id>.ondigitalocean.app.` |
| `@` | A or ALIAS | depends on Name.com support; A records to App Platform IPs work |

The Droplet path is recommended because ClamAV co-location is straightforward.
