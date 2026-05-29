# Deploy Verification Runbook (v2)

> **Scope:** How to run `scripts/verify-deploy.sh`, interpret its output, triage failures, and roll back safely.
> Hardened in Issue #65 after Issue #64 runtime stress testing showed the v1 script only partially protected against the drift that caused #63.

---

## Why This Exists

Issue #63 demonstrated a specific failure class: a fix commit was merged into the repository, but the live runtime was still serving stale code because the Docker Compose build context pointed to a different directory than the repo clone. The failure was invisible until manual verification.

Issue #64 added an initial version of this script. Issue #65 hardened it after stress testing showed:
- Build-context mismatch was a warning, not a failure.
- The default compose file path did not match live droplets.
- The script verified repo HEAD but not the running container's image commit.
- `SKIP_DOCKER=1` mode was misleadingly presented as equivalent to a full run.

This script and runbook exist so that **every deploy is self-verifying** and drift between repo state, Docker image, and runtime cannot accumulate silently.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| `bash` ≥ 4.x | Available on all Linux droplets |
| `curl` | Required for HTTP endpoint checks |
| `git` | Required for repo HEAD checks |
| `docker` | Required for Docker section; set `SKIP_DOCKER=1` only in CI with no Docker socket |
| `EXPECTED_COMMIT` env var | The full or abbreviated Git SHA that should be live |

### Root vs. Non-Root Operators

> [!NOTE]
> Current ProjTrack droplet operations are **root-based** (`root@projtrack-prod-01`, `root@projtrack-staging-01`). This script runs correctly as root.
>
> The preferred future state is a dedicated non-root `deploy` user with Docker socket access (via `docker` group membership). Running as root is currently tolerated but should be migrated. A separate issue should be created to track the deploy-user migration when the project is ready.
>
> **TODO:** Create a follow-up issue: "Create non-root deploy operator user on DigitalOcean droplets."

**This script is read-only.** It does not modify containers, env files, secrets, firewall rules, or deployment state.

---

## Usage

### Staging — full verification (on the staging droplet)

```bash
cd /opt/projtrack/repo
EXPECTED_COMMIT=$(git rev-parse HEAD) bash scripts/verify-deploy.sh staging
```

### Production — full verification (on the production droplet)

```bash
cd /opt/projtrack/repo
EXPECTED_COMMIT=$(git rev-parse HEAD) bash scripts/verify-deploy.sh production
```

### CI-only / HTTP-only mode (no Docker socket available)

```bash
SKIP_DOCKER=1 EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh staging
SKIP_DOCKER=1 EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
```

> [!IMPORTANT]
> `SKIP_DOCKER=1` **only proves HTTP reachability.** It does NOT verify:
> - Docker container state or health
> - Compose build context (the #63 failure mode)
> - Running image commit label (whether the container was built from `EXPECTED_COMMIT`)
>
> A deploy is not fully verified until the script runs on the actual droplet without `SKIP_DOCKER=1`.

### Override compose file path

The script auto-detects `/opt/projtrack/docker-compose.yml` if it exists. Manual override:

```bash
COMPOSE_FILE=/some/other/docker-compose.yml \
  EXPECTED_COMMIT=<sha> \
  bash scripts/verify-deploy.sh production
```

### Pre-#65 images (missing revision label)

If the running image was built before Issue #65 added the `org.opencontainers.image.revision` label, you may see:

```
[FAIL] Image revision label is missing or 'unknown'.
```

To temporarily bypass this check while the image is rebuilt:

```bash
ALLOW_UNKNOWN_IMAGE_REVISION=1 EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
```

> [!WARNING]
> `ALLOW_UNKNOWN_IMAGE_REVISION=1` downgrades the image label check to a warning. It must not be used permanently. Rebuild the image with the label to remove this escape hatch.

### Build the image with the commit label

```bash
# On the droplet or CI:
VCS_REF=$(git rev-parse HEAD) docker compose build --no-cache backend

# Then verify:
EXPECTED_COMMIT=$(git rev-parse HEAD) bash scripts/verify-deploy.sh production
```

---

## What the Script Checks

| Section | Check | Hard fail? |
|---|---|---|
| **0. Config** | Print compose file path, container name, SKIP_DOCKER | Info only |
| **1. Identity** | Repo HEAD matches `EXPECTED_COMMIT` | Yes |
| **1. Identity** | Working tree dirty (capped at 20 lines) | Warn only |
| **2. Docker** | Compose file present at resolved path | Yes |
| **2. Docker** | Backend service build context is `./repo` or `repo` | **Yes (hard fail)** |
| **2. Docker** | `BACKEND_CONTAINER` container is running | Yes |
| **2. Docker** | Docker healthcheck is `healthy` | Yes (warn if `unknown`) |
| **2d. Image** | `org.opencontainers.image.revision` label matches `EXPECTED_COMMIT` | **Yes (hard fail)** |
| **3. HTTP** | `GET /health` → 200 | Yes |
| **3. HTTP** | `GET /health/api-ready` → 200 | Yes |
| **3. HTTP** | `GET /health/ready` → 200 | Yes |
| **3. HTTP** | `GET /branding` → not 500 | Yes (500 = hard fail) |

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

## Required Evidence Format

When posting deploy verification evidence to a GitHub issue, include:

```
Host:                <droplet hostname>
Repo HEAD:           <full SHA>
EXPECTED_COMMIT:     <full SHA>
Compose file:        <path used>
Backend build ctx:   <./repo | other>  [PASS/FAIL]
Container status:    <running/other>   [PASS/FAIL]
Container health:    <healthy/other>   [PASS/FAIL]
Image revision:      <label value>     [PASS/FAIL]
/health:             <HTTP status>     [PASS/FAIL]
/health/api-ready:   <HTTP status>     [PASS/FAIL]
/health/ready:       <HTTP status>     [PASS/FAIL]
/branding:           <HTTP status>     [PASS/FAIL]
Final exit code:     <0|1>
```

---

## Triage Guide

### FAIL: Repo HEAD does not match EXPECTED_COMMIT

**Cause:** The local checkout or the server is not on the expected commit.

**Steps:**
1. Run `git log --oneline -5` to confirm local HEAD.
2. On the server: `cd /opt/projtrack/repo && git log --oneline -3`.
3. If the server is behind: `git pull origin main` then rebuild and redeploy.

---

### FAIL: Build context is not `./repo`

**Cause:** The `docker-compose.yml` on the server has a stale `context: .` pointing to an old path.

**This was the root cause of Issue #63 drift.**

**Steps:**
1. On the server: `grep context /opt/projtrack/docker-compose.yml`
2. If it shows `context: .` — update to `context: ./repo`.
3. Rebuild: `VCS_REF=$(git rev-parse HEAD) docker compose -f /opt/projtrack/docker-compose.yml build --no-cache backend`
4. Re-run this script.

---

### FAIL: No build context found for backend service

**Cause:** The compose file does not have a `build:` block for the backend service (image-only mode), or parsing failed.

**Steps:**
1. `cat /opt/projtrack/docker-compose.yml | grep -A5 'backend:'`
2. If `build:` block is missing, add it. Refer to `infra/docker-compose.production.yml` in the repo.

---

### FAIL: Image revision label is missing or `unknown`

**Cause:** The running container was built from an image that predates the `VCS_REF` label (i.e., built before Issue #65 was merged), or was built without `--build-arg VCS_REF=<sha>`.

**Steps:**
1. Confirm the current image label: `docker inspect projtrack-backend --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
2. Rebuild with the label: `VCS_REF=$(git rev-parse HEAD) docker compose build --no-cache backend`
3. Restart: `docker compose up -d backend`
4. Re-run verify-deploy.sh.

---

### FAIL: Running image commit does not match EXPECTED_COMMIT

**Cause:** The container is running an image built from a different commit than expected. This is the failure mode that issue #64 was designed to catch.

**Steps:**
1. Check image label: `docker inspect projtrack-backend --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
2. Check repo HEAD: `cd /opt/projtrack/repo && git rev-parse HEAD`
3. Rebuild from repo HEAD: `cd /opt/projtrack && VCS_REF=$(git rev-parse repo/.git/HEAD || git -C repo rev-parse HEAD) docker compose build --no-cache backend && docker compose up -d backend`
4. Re-run verify-deploy.sh.

---

### FAIL: Backend container is NOT running

**Steps:**
1. `docker ps -a | grep projtrack-backend`
2. `docker logs projtrack-backend --tail=100`
3. Common causes: missing `backend.env.production`, ClamAV not healthy, port conflict on 3001.
4. Restart: `docker compose -f /opt/projtrack/docker-compose.yml up -d backend`

---

### FAIL: Docker health is not `healthy`

**Steps:**
1. `docker inspect projtrack-backend | grep -A5 Health`
2. `docker logs projtrack-backend --tail=50`
3. Check database connectivity — healthcheck tests `/health/api-ready` which requires DB.

---

### FAIL: /health or /health/api-ready or /health/ready returns non-200

**Steps:**
1. Confirm reverse proxy (Caddy) is running: `docker ps | grep caddy` or `systemctl status caddy`.
2. Check port binding: `ss -tlnp | grep 3001`.
3. Check `docker logs projtrack-backend --tail=100`.

---

### FAIL: /branding returns 500

**Cause:** Branding service threw an unhandled exception. Fixed in commit `0229547` but can regress if the wrong image is running.

**Steps:**
1. Check image revision label — stale image?
2. `docker logs projtrack-backend --tail=100 | grep -i branding`
3. Rebuild with `--no-cache` from correct commit.

---

## Rollback Procedure

> Only roll back if all triage steps fail and production is degraded.

### Step 1 — Identify the last known-good image

```bash
docker image ls projtrack/backend
```

### Step 2 — Pin the compose file to the previous image

Edit `/opt/projtrack/docker-compose.yml`:

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

### Step 5 — Open a GitHub issue

Document: what regressed, which commit rolled back from, rollback SHA, when executed.

---

## When to Run This Script

| Event | Mode required |
|---|---|
| After every `docker compose up -d --build` | Full (on droplet, no SKIP_DOCKER) |
| After `git pull` + rebuild on the server | Full (on droplet, no SKIP_DOCKER) |
| Post-release watch window | Full (on droplet, no SKIP_DOCKER) |
| After any incident recovery | Full (on droplet, no SKIP_DOCKER) |
| In CI (no Docker socket) | HTTP-only (`SKIP_DOCKER=1`) — partial only |
| Local dev check against remote API | HTTP-only (`SKIP_DOCKER=1`) — partial only |

---

## Related Documents

- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [docs/PRODUCTION_CUTOVER_RUNBOOK.md](../PRODUCTION_CUTOVER_RUNBOOK.md)
- [docs/PRODUCTION_ROLLBACK_RUNBOOK.md](../PRODUCTION_ROLLBACK_RUNBOOK.md)
- [docs/STAGING_VERIFICATION_RUNBOOK.md](../STAGING_VERIFICATION_RUNBOOK.md)
- [docs/INCIDENT_RESPONSE.md](../INCIDENT_RESPONSE.md)
- [scripts/post-deploy-smoke.mjs](../../scripts/post-deploy-smoke.mjs)

---

## Evidence Trail

| Issue | Change |
|---|---|
| #63 | Root cause: stale compose build context (`context: .` → wrong path) |
| #64 | Initial verification script + runbook |
| #65 | Hardened: build-context → hard fail; compose path auto-detection; image revision label check; container name configurable; dirty-tree output capped; root-user mismatch documented |
