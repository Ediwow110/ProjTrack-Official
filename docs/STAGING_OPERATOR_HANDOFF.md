# Staging Operator Handoff

**Date:** 2026-06-04
**Repository:** Ediwow110/ProjTrack-Official
**Latest main SHA:** `e724a1c884196b6a080f6e23f146089175c28b79`
**RC Tag:** Not created (operator may tag after verification)
**RC Verdict:** A. RELEASE CANDIDATE READY FOR STAGING

---

## 1. Executive Summary

The codebase has completed all local/code/documentation hardening tracks: audit, security round 2, frontend test expansion, performance round 2, PERF2-004, full ops observability hardening, OPS2 low-severity triage, and final RC readiness review.

**What is ready:**
- 552 tests passing (32 frontend + 287 backend unit + 233 backend security)
- CI green (both CI and Production Candidate Verification workflows)
- All 10 hardening PRs (#160-#169) merged on main
- Production Docker compose with log rotation, resource limits, ClamAV persistence
- Health endpoints (9 endpoints: live, ready, api-ready, storage, mail, etc.)
- Audit requestId correlation merged
- Backup/restore runbook consolidated
- Monitoring wiring runbook documented (provider-neutral)
- Security: robust auth, authorization, file upload, rate limiting, CSP/CORS

**What is not ready (operator tasks):**
- Staging deployment not executed
- No staging server, database, DNS, or env file
- No monitoring provider configured
- No restore drill executed
- No backup storage credentials/bucket
- No smoke secrets configured in GitHub

---

## 2. Required Infrastructure Inputs

The operator must provide or create each of these before deployment:

| Input | Required | Notes |
|-------|----------|-------|
| Server IP / SSH user | ✅ Required | Prefer Ubuntu 22.04+ VM or Droplet |
| Domain/DNS | ✅ Required | e.g., staging.projtrack.codes, api.staging.projtrack.codes |
| Database URL | ✅ Required | PostgreSQL 15+ instance (e.g., managed DB or Docker Postgres) |
| Backend env file | ✅ Required | See `docs/env/staging.env.example` for template |
| JWT access secret | ✅ Required | Generate with `openssl rand -base64 48` |
| JWT refresh secret | ✅ Required | Same generation method, different value |
| Account action token key | ✅ Required | Encryption key for reset/activation tokens |
| Mail provider credentials | 🔶 Required or stub | Mailrelay/Resend credentials; or set `MAIL_MODE=stub` for testing |
| S3/Spaces credentials | 🔶 Required for backup | DigitalOcean Spaces or S3-compatible storage |
| Frontend deployment target | ✅ Required | Vercel, Netlify, or static host |
| Monitoring provider | 🔶 Recommended | UptimeRobot, Checkly, Grafana, or similar |

---

## 3. Pre-Deployment Checklist

- [ ] Server provisioned (Ubuntu 22.04+)
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 22, 80, 443, 3001 API)
- [ ] DNS A records pointed to server IP
- [ ] Reverse proxy (Caddy/Nginx) configured for TLS
- [ ] Backend env file created from template
- [ ] Database provisioned and connection verified
- [ ] JWT secrets generated and in env file
- [ ] Storage bucket created (e.g., DO Spaces)
- [ ] Backup destination verified (writable)
- [ ] Mail provider configured or stub mode set
- [ ] Frontend deployed (Vercel/Netlify) with API URL env var

---

## 4. Deployment Sequence

### 4.1 Prerequisites
```bash
# Install Docker + Compose on server
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

### 4.2 Pull Code
```bash
git clone https://github.com/Ediwow110/ProjTrack-Official.git
cd ProjTrack-Official
git checkout main
# Or if RC tag exists:
# git checkout rc-staging-YYYYMMDD
```

### 4.3 Configure Environment
```bash
cp docs/env/staging.env.example backend/.env
# Edit backend/.env with real values (database URL, secrets, etc.)
```

### 4.4 Deploy Database Migrations
```bash
cd backend
npx prisma migrate deploy
cd ..
```

### 4.5 Build and Start
```bash
# Build and start all services
docker compose -f infra/docker-compose.production.yml up -d --build
```

### 4.6 Verify Health
```bash
# Basic health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/health/api-ready

# Admin health endpoints (requires auth token)
curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/health/storage
curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/health/mail
curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/health/backups
```

### 4.6b Post-Deploy Smoke Test
```bash
# Run the post-deploy smoke script
cd backend && npm run e2e:smoke
```

### 4.7 Configure Monitoring
Follow `MONITORING_RUNBOOK.md` to set up:
- Uptime checks for `/health/live`, `/health/ready`, `/health/api-ready`
- Alert policies (PagerDuty/Email/Slack)
- Dashboard for key metrics

### 4.8 Verify Backup
```bash
# Trigger manual backup via admin UI or API
# Verify backup appears in configured storage (DO Spaces/S3)
```

---

## 5. Required Verification

| Check | Expected Result | How to Verify |
|-------|----------------|---------------|
| `/health/live` | 200 OK | `curl -f http://localhost:3001/health/live` |
| `/health/ready` | 200 OK | `curl -f http://localhost:3001/health/ready` |
| `/health/api-ready` | 200 OK | `curl -f http://localhost:3001/health/api-ready` |
| Frontend loads | 200, no console errors | Open frontend URL in browser |
| Protected route rejects unauthenticated | Redirect to login | Open `/admin` without session |
| DB migration status | All migrations applied | `npx prisma migrate status` |
| ClamAV readiness | Scanner responds | Check `/health/api-ready` includes ClamAV |
| Backup job | Backup created in storage | Trigger via admin UI, verify file exists |
| Post-deploy smoke script | Passes | `cd backend && npm run e2e:smoke` |

---

## 6. Rollback / Stop Conditions

Stop deployment and roll back if any of these occur:

| Condition | Action |
|-----------|--------|
| Prisma migration fails | Roll back DB to last known good migration; investigate schema mismatch |
| Health endpoint returns non-200 | Check logs: `docker compose logs api` |
| Smoke test fails | Revert to previous commit; investigate test failure |
| Backup fails to write to storage | Check storage credentials and permissions |
| Suspicious error logs (secrets in output, stack traces to client) | Fix before proceeding |
| Monitoring provider not responding | Verify provider configuration; proceed manually if needed |

Rollback steps:
```bash
docker compose -f infra/docker-compose.production.yml down
# Restore previous DB backup if migration was applied
npx prisma migrate reset  # CAUTION: destructive
git checkout <previous-stable-commit>
docker compose -f infra/docker-compose.production.yml up -d --build
```

---

## 7. Explicit Non-Claims

| Claim | Status |
|-------|--------|
| Production readiness | ❌ NOT CLAIMED — this is a staging candidate only |
| Production deployment | ❌ NOT EXECUTED — no production environment exists |
| Staging deployment | ❌ NOT EXECUTED — staging environment not yet provisioned |
| Monitoring live | ❌ NOT LIVE — monitoring provider not configured |
| Restore drill performed | ❌ NOT EXECUTED — restore drill requires real environment |
| Backup storage configured | ❌ NOT CONFIGURED — no bucket or credentials provided |
| Load tested at scale | ❌ NOT PERFORMED — requires staging environment for realistic data |
| Incident drills conducted | ❌ NOT PERFORMED — blocked on staging availability |

---

## 8. Links

| Document | Purpose |
|----------|---------|
| `docs/RELEASE_CANDIDATE_FINAL_READINESS_REPORT.md` | Full RC readiness assessment |
| `docs/STAGING_DEPLOYMENT_VERIFICATION_REPORT.md` | Staging verification protocol (not executed) |
| `docs/PRODUCTION_READINESS_VERIFICATION_REPORT.md` | Production readiness assessment |
| `docs/BACKUP_RESTORE_RUNBOOK.md` | Consolidated backup and restore procedures |
| `docs/MONITORING_RUNBOOK.md` | Monitoring setup and alert configuration |
| `docs/OPS_OBSERVABILITY_TRACK_CLOSURE_REPORT.md` | Ops observability track completion summary |
| `docs/DEPLOYMENT_CHECKLIST.md` | Deployment step-by-step checklist |
| `docs/DEPLOYMENT.md` | Deployment architecture overview |
| `docs/env/staging.env.example` | Staging env file template |
| `infra/docker-compose.production.yml` | Production Docker Compose configuration |
| `scripts/post-deploy-smoke.mjs` | Post-deploy smoke test script |

---

*Generated 2026-06-04. No code, environments, or secrets were modified during this handoff. Staging deployment execution remains an operator task pending infrastructure provisioning.*
