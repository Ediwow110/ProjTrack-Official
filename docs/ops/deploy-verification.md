# Deploy Verification Runbook

> **Scope:** This runbook covers how to run `scripts/verify-deploy.sh`, interpret its output, triage failures, and roll back safely.
> It was introduced after Issue #63 (branding 500) revealed that repo state, Docker build context, and runtime state can silently diverge.

---

## Why This Exists

Issue #63 demonstrated a specific failure class: a fix commit was merged into the repository, but the live runtime on staging and production was still serving stale code because the Docker Compose build context pointed to a different directory than the repo clone. The failure was invisible until manual verification proved the images were built from the wrong path.

This script and runbook exist so that **every deploy is self-verifying** and drift cannot accumulate silently.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| `bash` ≥ 4.x | Available on all Linux droplets |
| `curl` | Required for HTTP endpoint checks |
| `git` | Required for repo HEAD checks |
| `docker` | Required for container state checks; set `SKIP_DOCKER=1` if not available |
| `EXPECTED_COMMIT` env var | The full or abbreviated Git SHA that should be live |

**Do not run this script as root.** Use the deploy operator user that has Docker socket access.

**This script is read-only.** It does not SSH into servers, modify containers, change env files, rotate secrets, or alter firewall rules.

---

## Usage

### Staging

```bash
EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh staging
```

**Example:**

```bash
EXPECTED_COMMIT=0229547 bash scripts/verify-deploy.sh staging
```

### Production

```bash
EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
```

**Example:**

```bash
EXPECTED_COMMIT=f8243bb bash scripts/verify-deploy.sh production
```

### CI-only mode (no Docker socket)

```bash
SKIP_DOCKER=1 EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
```

### Override compose file path

```bash
COMPOSE_FILE=/opt/projtrack/docker-compose.yml \
  EXPECTED_COMMIT=<sha> \
  bash scripts/verify-deploy.sh production
```

---

## What the Script Checks

| Section | Check | Hard fail? |
|---|---|---|
| **1. Identity** | Repo HEAD matches `EXPECTED_COMMIT` | Yes |
| **1. Identity** | Working tree clean warning | Warn only |
| **2. Docker** | Compose file present at expected path | Yes |
| **2. Docker** | Compose `context:` is `./repo` (not stale local path) | Warn if unexpected |
| **2. Docker** | `projtrack-backend` container is running | Yes |
| **2. Docker** | `projtrack-backend` Docker healthcheck is `healthy` | Yes (warn if `unknown`) |
| **3. HTTP** | `GET /health` → HTTP 200 | Yes |
| **3. HTTP** | `GET /health/api-ready` → HTTP 200 | Yes |
| **3. HTTP** | `GET /health/ready` → HTTP 200 | Yes |
| **3. HTTP** | `GET /branding` → not 500 | Yes (500 = hard fail) |

A non-200 /branding (e.g. 404, 204) is treated as a warning only — the script passes. A 500 is a hard failure because it proves the backend is in an error state for that endpoint.

---

## Interpreting Output

```
[INFO] ...     — Informational, no action needed
[PASS] ...     — Check succeeded
[WARN] ...     — Non-blocking; review manually
[FAIL] ...     — Hard failure; deploy is not verified
```

**Exit 0:** All checks passed. The deploy is verified.

**Exit 1:** One or more `[FAIL]` lines exist. Do not mark the deploy complete until all failures are resolved.

---

## Triage Guide

### FAIL: Repo HEAD does not match EXPECTED_COMMIT

**Cause:** The local checkout or the server is not on the expected commit.

**Steps:**
1. Run `git log --oneline -5` to confirm local HEAD.
2. If running on a server, run `cd /opt/projtrack/repo && git log --oneline -3`.
3. If the server is behind: `git pull origin main` then rebuild and redeploy.
4. If running locally against a remote API, verify the expected commit was actually pushed and deployed.

---

### FAIL: Build context is not `./repo`

**Cause:** The `docker-compose.yml` on the server has a stale `context: .` pointing to the old `/opt/projtrack/backend` directory instead of `/opt/projtrack/repo`.

**This was the root cause of the Issue #63 drift.**

**Steps:**
1. On the server: `cat /opt/projtrack/docker-compose.yml | grep context`
2. If `context: .` — update to `context: ./repo` in the compose file on disk.
3. Rebuild: `docker compose up -d --build --no-cache backend`
4. Re-run this script to verify.

---

### FAIL: Backend container is NOT running

**Cause:** Container crashed, was stopped, or never started.

**Steps:**
1. `docker ps -a | grep projtrack-backend` — check last state.
2. `docker logs projtrack-backend --tail=100` — look for crash reason.
3. Common causes:
   - Missing or malformed `backend.env.production`
   - ClamAV not healthy (backend `depends_on: clamav: healthy`)
   - Port conflict on 3001
4. Restart: `docker compose -f /opt/projtrack/docker-compose.yml up -d backend`

---

### FAIL: Docker health is not `healthy`

**Cause:** Backend healthcheck (`GET /health/api-ready`) is failing inside the container.

**Steps:**
1. `docker inspect projtrack-backend | grep -A5 Health`
2. `docker logs projtrack-backend --tail=50`
3. Check database connectivity: healthcheck tests `/health/api-ready` which includes DB.
4. Check `DATABASE_URL` in the env file is correct and reachable from the container network.

---

### FAIL: /health or /health/api-ready or /health/ready returns non-200

**Cause:** Backend is unreachable, Caddy/reverse-proxy is misconfigured, or the backend process is in an error state.

**Steps:**
1. Confirm Caddy/reverse proxy is running: `docker ps | grep caddy` or `systemctl status caddy`.
2. Check that port 3001 is bound: `ss -tlnp | grep 3001` on the server.
3. Check `docker logs projtrack-backend --tail=100`.
4. If proxy is missing, restart Caddy: `systemctl restart caddy` or `docker compose up -d proxy`.

---

### FAIL: /branding returns 500

**Cause:** The branding service threw an unhandled exception. This should not occur after the fix in `backend/src/branding/branding.service.ts` (commit 0229547), which wraps metadata reads in `try/catch` and returns safe defaults.

**Steps:**
1. Check backend logs: `docker logs projtrack-backend --tail=100 | grep -i branding`.
2. Verify the correct image was built from the fixed commit:
   ```bash
   docker inspect projtrack-backend --format '{{.Config.Labels}}'
   ```
3. If stale image: rebuild from the correct commit.
   ```bash
   docker compose up -d --build --no-cache backend
   ```
4. Re-run this script to verify.

---

## Rollback Procedure

> Only roll back if all triage steps fail and production is degraded.

### Step 1 — Identify the last known-good image

```bash
docker image ls projtrack/backend
```

Tag the last good image SHA before proceeding.

### Step 2 — Pin the compose file to the previous image

Edit `/opt/projtrack/docker-compose.yml` (on the server):

```yaml
backend:
  image: projtrack/backend:<previous-sha>
  # comment out build: block temporarily
```

### Step 3 — Restart with pinned image

```bash
docker compose up -d --no-build backend
```

### Step 4 — Verify

```bash
EXPECTED_COMMIT=<previous-sha> bash scripts/verify-deploy.sh production
```

### Step 5 — Create a GitHub issue

Open a new issue documenting:
- What regressed
- Which commit was rolled back from
- What the rollback SHA is
- When rollback was executed

Do not merge a new fix until the regression root cause is confirmed.

---

## When to Run This Script

| Event | Run verify-deploy.sh? |
|---|---|
| After every `docker compose up -d --build` | **Yes — always** |
| After a `git pull` + rebuild on the server | **Yes** |
| During the post-release watch window checkpoints | **Yes** |
| After any incident recovery | **Yes** |
| After container restart without rebuild | Recommended |
| During routine monitoring | Optional (smoke is sufficient) |

---

## Related Documents

- [DEPLOYMENT.md](../../DEPLOYMENT.md) — deployment steps
- [docs/PRODUCTION_CUTOVER_RUNBOOK.md](../PRODUCTION_CUTOVER_RUNBOOK.md) — production cutover steps
- [docs/PRODUCTION_ROLLBACK_RUNBOOK.md](../PRODUCTION_ROLLBACK_RUNBOOK.md) — rollback procedure
- [docs/STAGING_VERIFICATION_RUNBOOK.md](../STAGING_VERIFICATION_RUNBOOK.md) — staging verification gate
- [docs/INCIDENT_RESPONSE.md](../INCIDENT_RESPONSE.md) — incident response steps
- [scripts/post-deploy-smoke.mjs](../../scripts/post-deploy-smoke.mjs) — browser-level login smoke

---

## Evidence Trail

This runbook was created as part of Issue #64 (Prevent runtime/repo deployment drift for backend Docker builds), which was opened after Issue #63 (branding 500 on live runtime despite fix commit existing in repo).

The specific root cause of Issue #63: `docker-compose.yml` on the server used `context: .` pointing to `/opt/projtrack/backend` (stale), not `context: ./repo` (correct). The fix was to update the context and rebuild with `--no-cache`. This runbook's Section 2 / "Build context" check catches that failure class automatically.
