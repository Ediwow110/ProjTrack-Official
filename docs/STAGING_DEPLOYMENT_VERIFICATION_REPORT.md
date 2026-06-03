# Staging Deployment Verification Report

**Date:** 2026-06-03
**Repository:** Ediwow110/ProjTrack-Official
**Latest main SHA:** `e4d40900fc31cf5fca792281da252154ec985c36`
**Report Type:** NOT EXECUTED — missing credentials/environment

---

## 1. Executive Summary

| Field | Value |
|-------|-------|
| Date/Time | 2026-06-03 ~22:50 UTC+8 |
| Operator | User (self-service provisioning required) |
| Repo SHA | `e4d40900fc31cf5fca792281da252154ec985c36` |
| Local preflight | ✅ All 521 tests passing |
| Staging deployment | 🔴 NOT EXECUTED |
| **Verdict** | **D — NOT EXECUTED — missing credentials/environment** |

No staging environment has been provisioned. All local baseline checks pass (typecheck, build, 521 tests, Prisma validate). The codebase is ready. The infrastructure is not.

---

## 2. Environment

| Component | Status | Notes |
|-----------|--------|-------|
| Staging server | 🔴 MISSING | No DigitalOcean Droplet or equivalent VM |
| Staging domain(s) | 🔴 MISSING | No DNS records created |
| SSH access | 🔴 MISSING | No server to connect to |
| Database | 🔴 MISSING | No staging PostgreSQL instance |
| Object storage (S3/Spaces) | 🔴 MISSING | No staging bucket configured |
| Mail provider | 🔴 MISSING | No Mailrelay staging API key (or stub acceptable for initial verification) |
| ClamAV | 🔴 NOT STARTED | Will be provisioned via Docker compose sidecar |
| Frontend host | 🔴 MISSING | Vercel preview or Caddy static hosting not set up |
| Docker / compose | 🔴 NOT INSTALLED | No server to install on |
| Caddy / TLS | 🔴 NOT CONFIGURED | No server or domain to bind |

---

## 3. Deployment Steps Status

| Step | Status | Details |
|------|--------|---------|
| Local baseline checks | ✅ PASS | typecheck, build, 521 tests, Prisma validate |
| Server bootstrap | 🔴 NOT RUN | Requires server |
| Env file validation | 🔴 NOT RUN | Requires server + secrets |
| Prisma migrate deploy | 🔴 NOT RUN | Requires staging DB URL |
| Docker compose build | 🔴 NOT RUN | Requires server |
| Docker compose up | 🔴 NOT RUN | Requires server |
| Frontend deploy | 🔴 NOT RUN | Requires Vercel or Caddy static host |
| Health checks | 🔴 NOT RUN | Requires running stack |
| Smoke tests | 🔴 NOT RUN | Requires running stack |
| Mail verification | 🔴 NOT RUN | Requires mail provider config |
| Backup verification | 🔴 NOT RUN | Requires storage config + worker running |
| Rollback verification | 🔴 NOT RUN | Requires live environment |

---

## 4. Exact Provisioning Steps Required

The following guide walks through provisioning a staging environment for ProjTrack. Each section is a prerequisite for the next.

### 4.1 Provision a Staging Server

**Option A — DigitalOcean Droplet (recommended, matches infra scripts):**

1. Create a Ubuntu 22.04 Droplet (minimum: 2 GB RAM, 2 vCPUs, $12–24/month).
2. Add your SSH public key.
3. Note the Droplet IP address.
4. Run the bootstrap script:
   ```bash
   ssh root@<droplet-ip>
   curl -fsSL https://raw.githubusercontent.com/Ediwow110/ProjTrack-Official/main/infra/digitalocean-bootstrap.sh | sudo bash
   ```
   This installs Docker, Caddy, firewall, clones the repo, and copies compose/Caddy templates.

**Option B — Any Ubuntu 22.04 VM:**

Manually install Docker CE, docker compose plugin, Caddy, and git. Then:
```bash
git clone https://github.com/Ediwow110/ProjTrack-Official.git /opt/projtrack/repo
mkdir -p /opt/projtrack/data/{backups,uploads-fallback,release-evidence}
cp /opt/projtrack/repo/infra/docker-compose.production.yml /opt/projtrack/docker-compose.yml
```

### 4.2 Configure DNS

Create DNS records for your staging domains (via your DNS provider, e.g., Name.com):

| Record | Type | Value | TTL |
|--------|------|-------|-----|
| `staging.projtrack.codes` | A | `<droplet-ip>` | 300 |
| `api-staging.projtrack.codes` | A | `<droplet-ip>` | 300 |

Wait for propagation (usually 1–5 minutes for low TTL).

### 4.3 Create a Staging Database

**Option A — DigitalOcean Managed PostgreSQL (recommended):**

1. Create a PostgreSQL 16 database in the same DO region as your Droplet.
2. Add a trusted source allowing the Droplet IP.
3. Copy the connection pool URL.

**Option B — PostgreSQL on the same Droplet (simpler, less production-like):**

```bash
docker run -d \
  --name projtrack-staging-db \
  -e POSTGRES_DB=projtrack_staging \
  -e POSTGRES_USER=projtrack \
  -e POSTGRES_PASSWORD=<strong-password> \
  -p 5432:5432 \
  postgres:16
```

### 4.4 Create the Staging Env File

On the server at `/opt/projtrack/backend.env.staging`:

```ini
# Environment
NODE_ENV=production
APP_ENV=staging
PORT=3001

# URLs
APP_URL=https://staging.projtrack.codes
FRONTEND_URL=https://staging.projtrack.codes
BACKEND_URL=https://api-staging.projtrack.codes
CORS_ORIGINS=https://staging.projtrack.codes,https://api-staging.projtrack.codes
TRUST_PROXY=true
TRUST_PROXY_HOPS=1

# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/projtrack_staging?schema=public

# JWT (generate distinct secrets with: openssl rand -base64 60)
JWT_ACCESS_SECRET=<generate-strong-random-secret>
JWT_REFRESH_SECRET=<generate-different-strong-random-secret>
JWT_ISSUER=projtrack-api-staging
JWT_AUDIENCE=projtrack-web-staging
JWT_KEY_ID=staging-1
ACCOUNT_ACTION_TOKEN_ENC_KEY=<openssl-rand-base64-32>

# Auth cookies
AUTH_REFRESH_COOKIE_NAME=projtrack_staging_refresh
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_SECURE=true

# Mail — use stub for initial staging; switch to mailrelay for mail testing
MAIL_PROVIDER=stub
MAIL_FROM=noreply@staging.projtrack.codes
MAIL_WORKER_ENABLED=false

# Object storage — use local for initial staging; switch to S3 for full testing
OBJECT_STORAGE_MODE=local
FILE_STORAGE_MODE=local

# File upload
FILE_UPLOAD_MAX_MB=50
FILE_MALWARE_SCAN_MODE=fail-open    # stub mode until ClamAV is verified
FILE_MALWARE_SCANNER=clamav
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# Rate limiting — database store when DB is available
HTTP_RATE_LIMIT_STORE=database

# Rate limit values (staging can be slightly more generous)
RATE_LIMIT_LOGIN_MAX=100
RATE_LIMIT_REFRESH_MAX=200

# Backups — local only for staging
BACKUP_LOCAL_DIR=data/system-tools/backups
BACKUP_WORKER_ENABLED=false
BACKUP_SCHEDULE_ENABLED=false

# Safety
ALLOW_DEMO_SEED=false
ALLOW_SEED_DATA_CLEANUP=false
ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=false
```

### 4.5 Configure Caddy

Edit `/etc/caddy/Caddyfile` on the server:

```
staging.projtrack.codes {
    root * /var/www/projtrack
    file_server
    try_files {path} /index.html
    header {
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api-staging.projtrack.codes; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        Referrer-Policy no-referrer
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}

api-staging.projtrack.codes {
    reverse_proxy 127.0.0.1:3001
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
}
```

Then: `sudo systemctl reload caddy`

### 4.6 Apply Database Migrations

```bash
cd /opt/projtrack/repo/backend
export DATABASE_URL=postgresql://<user>:<password>@<host>:5432/projtrack_staging?schema=public
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status    # confirm "database schema is up to date"
```

### 4.7 Build and Start the Docker Stack

```bash
cd /opt/projtrack
docker compose --env-file backend.env.staging build
docker compose --env-file backend.env.staging up -d
docker compose ps            # verify all 4 services running
docker compose logs backend  # check for startup errors
```

### 4.8 Build and Deploy the Frontend

**Option A — Vercel (if Vercel is connected to the repo):**
- Create a Vercel preview/production deployment with env vars:
  - `VITE_API_BASE_URL=https://api-staging.projtrack.codes`
  - `VITE_PUBLIC_APP_URL=https://staging.projtrack.codes`
  - `VITE_USE_BACKEND=true`
- Vercel provides a preview URL automatically.

**Option B — Static files on the same server:**
```bash
cd /opt/projtrack/repo
npm ci
VITE_API_BASE_URL=https://api-staging.projtrack.codes VITE_PUBLIC_APP_URL=https://staging.projtrack.codes VITE_USE_BACKEND=true npm run build
sudo rm -rf /var/www/projtrack
sudo mkdir -p /var/www/projtrack
sudo cp -r dist/* /var/www/projtrack/
```

### 4.9 Verify Health Endpoints

```bash
curl -fsS https://api-staging.projtrack.codes/health/live
curl -fsS https://api-staging.projtrack.codes/health/api-ready
curl -fsS https://api-staging.projtrack.codes/health/ready
```

Expected: all return HTTP 200 with `"ok": true` (or clearly documented degraded components).

### 4.10 Run Smoke Tests

```bash
cd /opt/projtrack/repo
npm --prefix backend run smoke:local
npm run e2e:smoke
```

---

## 5. Estimated Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPUs | 2 vCPUs |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB |
| Database | PostgreSQL 16 (shared or containerized) | Managed PostgreSQL (DO) |
| Storage | Local disk | DigitalOcean Spaces ($5/month) |
| Domain | Not strictly required (can use IP directly) | 1–2 subdomains for TLS |
| Monthly cost | ~$12–24 (Droplet) + $15 (Managed DB) = **~$27–39/month** | |

---

## 6. Secrets Hygiene

✅ No secrets printed in this report.
✅ No `.env` files committed.
✅ No placeholder/default values used in this guide (all marked `<generate-...>`).
✅ Placeholder detection will be enforced by `inspectRuntimeConfiguration()` at backend startup.

---

## 7. Rollback / Recovery Plan

| Scenario | Recovery Action |
|----------|----------------|
| Migration failure | `prisma migrate deploy` is idempotent; fix schema and re-run |
| Container crash loop | `docker compose logs <service>` to diagnose; fix env or config |
| Frontend broken | Vercel rollback to previous deployment; or restore previous `dist/` |
| Data corruption | Restore from staging backup (if backup worker was configured) |
| DNS mistake | Point DNS back to previous target; wait for TTL expiry |
| Full reset | `docker compose down -v` (with caution — destroys volumes); re-create DB |

---

## 8. Final Verdict

> **D — NOT EXECUTED — missing credentials/environment**

All local checks pass (521 tests). The codebase is ready. The staging infrastructure has not been provisioned. No SSH access, no server, no database, no domain, no env file exist.

---

## 9. Recommended Next Steps

1. Provision a DigitalOcean Droplet (Ubuntu 22.04, 2 GB RAM minimum).
2. Provision a PostgreSQL database (Managed DB or containerized on the same droplet).
3. Run `infra/digitalocean-bootstrap.sh` on the Droplet.
4. Create the staging env file per Section 4.4 above.
5. Configure DNS for staging domains per Section 4.2.
6. Run `prisma migrate deploy`.
7. Run `docker compose up -d`.
8. Verify health endpoints.
9. Run smoke tests.
10. Re-run this staging verification track by re-prompting "continue with staging deployment" with your server IP and credentials.

**Estimated time to provision:** 1–2 hours for a person familiar with DigitalOcean and DNS management.

---

*Report generated 2026-06-03. No code, docs, environments, or secrets were modified during this verification.*
