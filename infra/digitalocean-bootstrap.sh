#!/usr/bin/env bash
# DigitalOcean Droplet bootstrap for ProjTrack.
#
# Idempotent: safe to re-run. Each step checks before changing system state.
#
# Usage (on a fresh Ubuntu 22.04 Droplet):
#   curl -fsSL https://raw.githubusercontent.com/Ediwow110/ProjTrack-Official/main/infra/digitalocean-bootstrap.sh | sudo bash
#
# After this script finishes, see DEPLOY_DIGITALOCEAN.md § "After the script"
# for the env-file + prisma migrate + docker compose up steps.

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 2
fi

REPO_URL="https://github.com/Ediwow110/ProjTrack-Official.git"
APP_DIR="/opt/projtrack"
REPO_DIR="${APP_DIR}/repo"
DATA_DIR="${APP_DIR}/data"

echo "==> Updating apt"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades gnupg lsb-release jq

echo "==> Installing Docker CE + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Configuring ufw (22, 80, 443)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo "==> Preparing app directories"
mkdir -p "${APP_DIR}" "${DATA_DIR}/release-evidence" "${DATA_DIR}/backups" "${DATA_DIR}/uploads-fallback"
chmod 750 "${APP_DIR}"

echo "==> Cloning / updating repo"
if [[ -d "${REPO_DIR}/.git" ]]; then
  git -C "${REPO_DIR}" fetch --all --prune
  git -C "${REPO_DIR}" checkout main
  git -C "${REPO_DIR}" pull --ff-only
else
  git clone "${REPO_URL}" "${REPO_DIR}"
fi

echo "==> Installing Caddyfile (if not already customized)"
if [[ ! -f /etc/caddy/Caddyfile.bak ]]; then
  cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak 2>/dev/null || true
  cp "${REPO_DIR}/infra/Caddyfile.example" /etc/caddy/Caddyfile
  echo "Caddyfile installed at /etc/caddy/Caddyfile (backup at /etc/caddy/Caddyfile.bak)."
  echo "Edit it to point at your real upstreams, then: sudo systemctl reload caddy"
fi

echo "==> Installing docker-compose.yml (if not already present)"
if [[ ! -f "${APP_DIR}/docker-compose.yml" ]]; then
  cp "${REPO_DIR}/infra/docker-compose.production.yml" "${APP_DIR}/docker-compose.yml"
  echo "docker-compose.yml installed at ${APP_DIR}/docker-compose.yml"
fi

cat <<'NEXT'

==========================================================================
NEXT STEPS (manual, in order):
==========================================================================

1. Create the env file with real secrets:
     sudo cp /opt/projtrack/repo/docs/env/production.env.example \
             /opt/projtrack/backend.env.production
     sudo $EDITOR /opt/projtrack/backend.env.production

   Required values you must paste:
     - DATABASE_URL  (from DO Managed Postgres connection pool)
     - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (openssl rand -base64 60, distinct)
     - ACCOUNT_ACTION_TOKEN_ENC_KEY (openssl rand -base64 32)
     - S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
     - MAILRELAY_API_KEY

2. Pull, build, migrate, and start:
     cd /opt/projtrack
     sudo docker compose --env-file backend.env.production build
     sudo docker compose --env-file backend.env.production run --rm backend \
       npx prisma migrate deploy
     sudo docker compose --env-file backend.env.production up -d

3. Build and place the frontend bundle:
     cd /opt/projtrack/repo
     sudo npm ci
     sudo VITE_API_BASE_URL=https://api.projtrack.codes npm run build
     sudo rm -rf /var/www/projtrack && sudo mkdir -p /var/www/projtrack
     sudo cp -r dist/* /var/www/projtrack/

4. Reload Caddy:
     sudo systemctl reload caddy

5. Verify:
     curl -sS https://api.projtrack.codes/health
     curl -sS https://api.projtrack.codes/health/ready
     curl -I  https://projtrack.codes

6. Run the release verification gate:
     cd /opt/projtrack/repo/backend
     sudo npm run check:runtime:prod
     sudo npm run smoke:worker

7. Configure DigitalOcean Monitoring per docs/MONITORING_RUNBOOK.md.

8. Only AFTER 1-7 pass: flip Name.com DNS for @ and www to the Droplet IP.
   See DEPLOY_DIGITALOCEAN.md § "Name.com DNS records".

==========================================================================
NEXT
