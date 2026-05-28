#!/usr/bin/env bash
# =============================================================================
# scripts/verify-deploy.sh
#
# Deployment drift verification gate for ProjTrack.
#
# Usage:
#   EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh staging
#   EXPECTED_COMMIT=<sha> bash scripts/verify-deploy.sh production
#
# Required environment variables:
#   EXPECTED_COMMIT  — full or abbreviated Git SHA that must be present on the
#                      server (printed and compared against repo HEAD).
#
# Optional environment variables:
#   COMPOSE_FILE     — override the docker-compose file path
#                      (default: inferred from target)
#   BACKEND_SERVICE  — override the compose service name
#                      (default: backend)
#   SKIP_DOCKER      — set to 1 to skip Docker checks (CI-only mode)
#
# Exit codes:
#   0  — all checks passed
#   1  — one or more checks failed; details printed to stderr
#
# Safe: this script is read-only. It never writes to env files, secrets,
#       deployment state, firewall rules, or the running containers.
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
  echo "  Example: EXPECTED_COMMIT=0229547 bash scripts/verify-deploy.sh ${TARGET}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Target configuration
# ---------------------------------------------------------------------------

case "${TARGET}" in
  staging)
    API_BASE="https://api-staging.projtrack.codes"
    EXPECTED_HOST_PATTERN="staging"
    DEFAULT_COMPOSE_FILE="infra/docker-compose.production.yml"
    ;;
  production)
    API_BASE="https://api.projtrack.codes"
    EXPECTED_HOST_PATTERN="prod"
    DEFAULT_COMPOSE_FILE="infra/docker-compose.production.yml"
    ;;
esac

COMPOSE_FILE="${COMPOSE_FILE:-${DEFAULT_COMPOSE_FILE}}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"

# ---------------------------------------------------------------------------
# Section 1: Identity
# ---------------------------------------------------------------------------

sep
echo -e "${BOLD}DEPLOY VERIFICATION — Target: ${TARGET}${RESET}"
echo -e "Started: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
sep

info "Section 1: Repository Identity"

REPO_HEAD="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
REPO_HEAD_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
REPO_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
GIT_STATUS="$(git status --short 2>/dev/null || echo 'unknown')"

info "Repo HEAD:        ${REPO_HEAD}"
info "Repo HEAD short:  ${REPO_HEAD_SHORT}"
info "Repo branch:      ${REPO_BRANCH}"
info "Expected commit:  ${EXPECTED_COMMIT}"

if [[ -n "${GIT_STATUS}" ]]; then
  warn "Working tree is not clean:"
  echo "${GIT_STATUS}"
else
  info "Working tree: clean"
fi

# Prefix-match: EXPECTED_COMMIT may be short or full
if [[ "${REPO_HEAD}" == "${EXPECTED_COMMIT}"* || "${REPO_HEAD}" == *"${EXPECTED_COMMIT}"* ]]; then
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
  warn "SKIP_DOCKER=1 — skipping Docker checks"
elif ! command -v docker &>/dev/null; then
  warn "docker not found on PATH — skipping Docker checks"
else
  # 2a: Compose file presence
  if [[ -f "${COMPOSE_FILE}" ]]; then
    pass "Compose file found: ${COMPOSE_FILE}"
  else
    fail "Compose file not found: ${COMPOSE_FILE}"
  fi

  # 2b: Build context in compose file
  COMPOSE_CONTEXT="$(grep -E 'context:' "${COMPOSE_FILE}" 2>/dev/null | head -1 | awk '{print $2}' || true)"
  info "Compose build context (first match): ${COMPOSE_CONTEXT:-<not found>}"
  if [[ "${COMPOSE_CONTEXT}" == "./repo" || "${COMPOSE_CONTEXT}" == "repo" ]]; then
    pass "Build context points to ./repo (not stale local backend)"
  elif [[ -z "${COMPOSE_CONTEXT}" ]]; then
    warn "No build context found in compose file — manual inspection required"
  else
    warn "Build context is '${COMPOSE_CONTEXT}' — verify it references the correct repo clone"
  fi

  # 2c: Container running check
  CONTAINER_STATUS="$(docker inspect --format '{{.State.Status}}' "projtrack-backend" 2>/dev/null || echo 'not_found')"
  CONTAINER_HEALTH="$(docker inspect --format '{{.State.Health.Status}}' "projtrack-backend" 2>/dev/null || echo 'unknown')"

  info "Container projtrack-backend status: ${CONTAINER_STATUS}"
  info "Container projtrack-backend health: ${CONTAINER_HEALTH}"

  if [[ "${CONTAINER_STATUS}" == "running" ]]; then
    pass "Backend container is running"
  else
    fail "Backend container is NOT running (status: ${CONTAINER_STATUS})"
  fi

  if [[ "${CONTAINER_HEALTH}" == "healthy" ]]; then
    pass "Backend container Docker health: healthy"
  elif [[ "${CONTAINER_HEALTH}" == "unknown" || "${CONTAINER_HEALTH}" == "none" ]]; then
    warn "Backend container Docker health: ${CONTAINER_HEALTH} (no healthcheck configured or not yet ready)"
  else
    fail "Backend container Docker health: ${CONTAINER_HEALTH}"
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

  # Helper: check an endpoint and assert expected HTTP status
  check_endpoint() {
    local label="$1"
    local url="$2"
    local expected_status="$3"
    local fail_on_status="${4:-}"  # optional: status code that causes hard fail

    local http_status
    http_status="$(curl -s -o /dev/null -w '%{http_code}' \
      --max-time 15 \
      --retry 2 \
      --retry-delay 2 \
      "${url}" 2>/dev/null || echo '000')"

    info "${label}: HTTP ${http_status} (expected ${expected_status}) — ${url}"

    if [[ "${http_status}" == "${expected_status}" ]]; then
      pass "${label}: ${http_status}"
    elif [[ -n "${fail_on_status}" && "${http_status}" == "${fail_on_status}" ]]; then
      fail "${label}: got ${http_status} (hard-fail status: ${fail_on_status})"
    elif [[ "${http_status}" == "000" ]]; then
      fail "${label}: connection failed or timed out"
    else
      fail "${label}: got ${http_status}, expected ${expected_status}"
    fi
  }

  check_endpoint "/health"           "${API_BASE}/health"           "200"
  check_endpoint "/health/api-ready" "${API_BASE}/health/api-ready" "200"
  check_endpoint "/health/ready"     "${API_BASE}/health/ready"     "200"

  # /branding: must NOT return 500
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
    # 204, 404, etc. are acceptable (non-500, non-connection-failure)
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
echo -e "API base:          ${API_BASE}"
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
