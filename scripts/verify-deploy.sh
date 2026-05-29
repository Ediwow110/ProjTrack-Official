#!/usr/bin/env bash
# =============================================================================
# scripts/verify-deploy.sh  (v2 — hardened per issue #65)
#
# Deployment drift verification gate for ProjTrack.
#
# Usage:
#   EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh staging
#   EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
#
# Required environment variables:
#   EXPECTED_COMMIT  — full or abbreviated Git SHA that must be present in repo
#                      HEAD AND in the running container image label.
#
# Optional environment variables:
#   COMPOSE_FILE              — override compose file path.
#                               Default: /opt/projtrack/docker-compose.yml if
#                               it exists; else infra/docker-compose.production.yml.
#   BACKEND_SERVICE           — compose service name (default: backend)
#   BACKEND_CONTAINER         — container name to inspect (default: projtrack-backend)
#   SKIP_DOCKER               — set to 1 to skip all Docker checks (HTTP-only mode;
#                               does NOT prove image/runtime alignment)
#   ALLOW_UNKNOWN_IMAGE_REVISION — set to 1 to downgrade missing/unknown image
#                               revision label from FAIL to WARN. Use only for
#                               images built before #65 added the label. Must not
#                               become the default. Prints a prominent warning.
#
# Exit codes:
#   0  — all checks passed
#   1  — one or more checks failed; details printed to stderr
#
# Safe: this script is read-only. It never writes to env files, secrets,
#       deployment state, firewall rules, or the running containers.
#
# IMPORTANT — SKIP_DOCKER=1 only proves HTTP reachability.
# It does NOT verify Docker container state, compose build context,
# or running image commit label. Always run without SKIP_DOCKER=1
# on the actual droplet to get full drift protection.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}[PASS]${RESET}"
FAIL="${RED}[FAIL]${RESET}"
INFO="${CYAN}[INFO]${RESET}"
WARN="${YELLOW}[WARN]${RESET}"

FAILURES=0

pass()  { echo -e "${PASS} $*"; }
fail()  { echo -e "${FAIL} $*" >&2; (( FAILURES++ )); }
info()  { echo -e "${INFO} $*"; }
warn()  { echo -e "${WARN} $*"; }
sep()   { echo -e "${BOLD}──────────────────────────────────────────${RESET}"; }

# Prefix-match for commit SHAs: full vs short (either direction)
commits_match() {
  local a="$1" b="$2"
  [[ "${a}" == "${b}"* || "${b}" == "${a}"* ]]
}

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------

TARGET="${1:-}"

if [[ -z "${TARGET}" ]]; then
  echo "Usage: EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh <staging|production>" >&2
  exit 1
fi

if [[ "${TARGET}" != "staging" && "${TARGET}" != "production" ]]; then
  echo "Error: target must be 'staging' or 'production' — got '${TARGET}'" >&2
  exit 1
fi

if [[ -z "${EXPECTED_COMMIT:-}" ]]; then
  echo "Error: EXPECTED_COMMIT must be set." >&2
  echo "  Example: EXPECTED_COMMIT=\$(git rev-parse HEAD) bash scripts/verify-deploy.sh ${TARGET}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Target configuration
# ---------------------------------------------------------------------------

case "${TARGET}" in
  staging)
    API_BASE="https://api-staging.projtrack.codes"
    ;;
  production)
    API_BASE="https://api.projtrack.codes"
    ;;
esac

# Compose file: prefer the live droplet path if it exists.
DROPLET_COMPOSE_FILE="/opt/projtrack/docker-compose.yml"
REPO_COMPOSE_FILE="infra/docker-compose.production.yml"

if [[ -n "${COMPOSE_FILE:-}" ]]; then
  # Explicit override always wins.
  : # already set
elif [[ -f "${DROPLET_COMPOSE_FILE}" ]]; then
  COMPOSE_FILE="${DROPLET_COMPOSE_FILE}"
else
  COMPOSE_FILE="${REPO_COMPOSE_FILE}"
fi

BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-projtrack-backend}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"
ALLOW_UNKNOWN_IMAGE_REVISION="${ALLOW_UNKNOWN_IMAGE_REVISION:-0}"

# ---------------------------------------------------------------------------
# Section 0: Configuration summary
# ---------------------------------------------------------------------------

sep
echo -e "${BOLD}DEPLOY VERIFICATION — Target: ${TARGET}${RESET}"
echo -e "Started:           $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo -e "API base:          ${API_BASE}"
echo -e "Compose file:      ${COMPOSE_FILE}"
echo -e "Backend container: ${BACKEND_CONTAINER}"
echo -e "SKIP_DOCKER:       ${SKIP_DOCKER}"
if [[ "${ALLOW_UNKNOWN_IMAGE_REVISION}" == "1" ]]; then
  echo -e "${YELLOW}${BOLD}WARNING: ALLOW_UNKNOWN_IMAGE_REVISION=1 — image label check is downgraded to warn.${RESET}"
fi
sep

# ---------------------------------------------------------------------------
# Section 1: Repository Identity
# ---------------------------------------------------------------------------

info "Section 1: Repository Identity"

REPO_HEAD="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
REPO_HEAD_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
REPO_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

info "Repo HEAD:        ${REPO_HEAD}"
info "Repo HEAD short:  ${REPO_HEAD_SHORT}"
info "Repo branch:      ${REPO_BRANCH}"
info "Expected commit:  ${EXPECTED_COMMIT}"

# Dirty-tree check: show count + first 20 lines max, not the full dump.
GIT_STATUS_RAW="$(git status --short 2>/dev/null || echo '')"
if [[ -n "${GIT_STATUS_RAW}" ]]; then
  GIT_CHANGED_COUNT="$(echo "${GIT_STATUS_RAW}" | wc -l | tr -d ' ')"
  warn "Working tree is not clean (${GIT_CHANGED_COUNT} modified file(s)):"
  echo "${GIT_STATUS_RAW}" | head -20
  if (( GIT_CHANGED_COUNT > 20 )); then
    echo "  ... truncated; run git status --short for full details"
  fi
else
  info "Working tree: clean"
fi

if commits_match "${REPO_HEAD}" "${EXPECTED_COMMIT}"; then
  pass "Repo HEAD matches EXPECTED_COMMIT (${EXPECTED_COMMIT})"
else
  fail "Repo HEAD (${REPO_HEAD}) does NOT match EXPECTED_COMMIT (${EXPECTED_COMMIT})"
fi

# ---------------------------------------------------------------------------
# Section 2: Docker / Compose state (skippable in CI-only mode)
# ---------------------------------------------------------------------------

sep
info "Section 2: Docker Compose State"

if [[ "${SKIP_DOCKER}" == "1" ]]; then
  warn "SKIP_DOCKER=1 — skipping all Docker checks."
  warn "This mode only proves HTTP reachability. It does NOT verify:"
  warn "  - compose build context"
  warn "  - backend container state or health"
  warn "  - running image commit label"
  warn "Run on the actual droplet without SKIP_DOCKER=1 for full drift verification."
elif ! command -v docker &>/dev/null; then
  warn "docker not found on PATH — skipping Docker checks"
  warn "Run on the actual droplet where docker is available for full drift verification."
else

  # 2a: Compose file presence
  info "Compose file path: ${COMPOSE_FILE}"
  if [[ -f "${COMPOSE_FILE}" ]]; then
    pass "Compose file found: ${COMPOSE_FILE}"
  else
    fail "Compose file not found: ${COMPOSE_FILE} — set COMPOSE_FILE=/path/to/docker-compose.yml"
  fi

  # 2b: Backend service build context — hard fail if not ./repo or repo
  # Use awk to locate the backend service block and extract its context,
  # avoiding false matches from other services that have no build block.
  COMPOSE_CONTEXT=""
  if [[ -f "${COMPOSE_FILE}" ]]; then
    # Extract context from the backend service block only.
    # Strategy: find "backend:" service line, then scan forward for "context:"
    # until the next top-level service or end of file.
    COMPOSE_CONTEXT="$(awk '
      /^  backend:/{in_backend=1; next}
      in_backend && /^  [a-zA-Z]/{in_backend=0}
      in_backend && /context:/{
        match($0, /context:[[:space:]]+(.*)/, arr)
        print arr[1]
        exit
      }
    ' "${COMPOSE_FILE}" 2>/dev/null || true)"
  fi

  info "Backend service build context: ${COMPOSE_CONTEXT:-<not found>}"

  if [[ "${COMPOSE_CONTEXT}" == "./repo" || "${COMPOSE_CONTEXT}" == "repo" ]]; then
    pass "Build context points to ./repo (not stale local path)"
  elif [[ -z "${COMPOSE_CONTEXT}" ]]; then
    fail "No build context found for backend service in ${COMPOSE_FILE} — manual inspection required"
  else
    fail "Build context is '${COMPOSE_CONTEXT}' — expected './repo' or 'repo'. This is the failure mode that caused Issue #63."
  fi

  # 2c: Container running check
  CONTAINER_STATUS="$(docker inspect --format '{{.State.Status}}' "${BACKEND_CONTAINER}" 2>/dev/null || echo 'not_found')"
  CONTAINER_HEALTH="$(docker inspect --format '{{.State.Health.Status}}' "${BACKEND_CONTAINER}" 2>/dev/null || echo 'unknown')"

  info "Container ${BACKEND_CONTAINER} status: ${CONTAINER_STATUS}"
  info "Container ${BACKEND_CONTAINER} health: ${CONTAINER_HEALTH}"

  if [[ "${CONTAINER_STATUS}" == "running" ]]; then
    pass "Backend container is running"
  else
    fail "Backend container is NOT running (status: ${CONTAINER_STATUS})"
  fi

  if [[ "${CONTAINER_HEALTH}" == "healthy" ]]; then
    pass "Backend container Docker health: healthy"
  elif [[ "${CONTAINER_HEALTH}" == "unknown" || "${CONTAINER_HEALTH}" == "none" ]]; then
    warn "Backend container Docker health: ${CONTAINER_HEALTH} (no healthcheck or not yet ready)"
  else
    fail "Backend container Docker health: ${CONTAINER_HEALTH}"
  fi

  # 2d: Running image commit label vs EXPECTED_COMMIT (new in #65)
  sep
  info "Section 2d: Running Image Commit Label"

  IMAGE_REVISION="$(docker inspect "${BACKEND_CONTAINER}" \
    --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    2>/dev/null || echo '')"

  info "Running image org.opencontainers.image.revision: ${IMAGE_REVISION:-<not set>}"

  if [[ -z "${IMAGE_REVISION}" || "${IMAGE_REVISION}" == "unknown" ]]; then
    if [[ "${ALLOW_UNKNOWN_IMAGE_REVISION}" == "1" ]]; then
      warn "Image revision label is '${IMAGE_REVISION:-<not set>}'. ALLOW_UNKNOWN_IMAGE_REVISION=1 — downgrading to warn."
      warn "This image was likely built before #65 added the VCS_REF label."
      warn "Rebuild with: VCS_REF=\$(git rev-parse HEAD) docker compose build --no-cache backend"
    else
      fail "Image revision label is missing or 'unknown'. This image was built without --build-arg VCS_REF."
      fail "Rebuild: VCS_REF=\$(git rev-parse HEAD) docker compose build --no-cache backend"
      fail "Or set ALLOW_UNKNOWN_IMAGE_REVISION=1 to skip this check for pre-#65 images (not recommended)."
    fi
  elif commits_match "${IMAGE_REVISION}" "${EXPECTED_COMMIT}"; then
    pass "Running image commit (${IMAGE_REVISION}) matches EXPECTED_COMMIT (${EXPECTED_COMMIT})"
  else
    fail "Running image commit (${IMAGE_REVISION}) does NOT match EXPECTED_COMMIT (${EXPECTED_COMMIT})"
    fail "The container is running a stale image. Rebuild: VCS_REF=\$(git rev-parse HEAD) docker compose build --no-cache backend"
  fi

fi

# ---------------------------------------------------------------------------
# Section 3: HTTP endpoint checks
# ---------------------------------------------------------------------------

sep
info "Section 3: HTTP Endpoint Checks (${API_BASE})"

if ! command -v curl &>/dev/null; then
  fail "curl not found on PATH — cannot run HTTP checks"
else

  check_endpoint() {
    local label="$1"
    local url="$2"
    local expected_status="$3"

    local http_status
    http_status="$(curl -s -o /dev/null -w '%{http_code}' \
      --max-time 15 \
      --retry 2 \
      --retry-delay 2 \
      "${url}" 2>/dev/null || echo '000')"

    info "${label}: HTTP ${http_status} (expected ${expected_status}) — ${url}"

    if [[ "${http_status}" == "${expected_status}" ]]; then
      pass "${label}: ${http_status}"
    elif [[ "${http_status}" == "000" ]]; then
      fail "${label}: connection failed or timed out"
    else
      fail "${label}: got ${http_status}, expected ${expected_status}"
    fi
  }

  check_endpoint "/health"           "${API_BASE}/health"           "200"
  check_endpoint "/health/api-ready" "${API_BASE}/health/api-ready" "200"
  check_endpoint "/health/ready"     "${API_BASE}/health/ready"     "200"

  # /branding: hard fail only on 500; 404/204 are acceptable
  BRANDING_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 15 \
    --retry 2 \
    --retry-delay 2 \
    "${API_BASE}/branding" 2>/dev/null || echo '000')"

  info "/branding: HTTP ${BRANDING_STATUS} — ${API_BASE}/branding"

  if [[ "${BRANDING_STATUS}" == "500" ]]; then
    fail "/branding: returned 500 — backend is in error state for branding endpoint"
  elif [[ "${BRANDING_STATUS}" == "000" ]]; then
    fail "/branding: connection failed or timed out"
  elif [[ "${BRANDING_STATUS}" == "200" ]]; then
    pass "/branding: 200 OK"
  else
    warn "/branding: returned ${BRANDING_STATUS} — not a 500, treating as non-blocking"
    pass "/branding: non-500 (${BRANDING_STATUS})"
  fi

fi

# ---------------------------------------------------------------------------
# Section 4: Summary
# ---------------------------------------------------------------------------

sep
echo -e "${BOLD}SUMMARY — Target: ${TARGET}${RESET}"
echo -e "Repo HEAD:         ${REPO_HEAD}"
echo -e "Expected commit:   ${EXPECTED_COMMIT}"
echo -e "Compose file:      ${COMPOSE_FILE}"
echo -e "API base:          ${API_BASE}"
echo -e "Backend container: ${BACKEND_CONTAINER}"
echo -e "Completed:         $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
sep

if [[ "${FAILURES}" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}ALL CHECKS PASSED — ${TARGET} deploy is verified.${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}${FAILURES} CHECK(S) FAILED — ${TARGET} deploy has drift or errors.${RESET}" >&2
  echo -e "See FAIL lines above. Consult docs/ops/deploy-verification.md for triage steps." >&2
  exit 1
fi
