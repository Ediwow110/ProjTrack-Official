$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$env:MAIL_WORKER_ENABLED = "true"
$env:BACKUP_WORKER_ENABLED = "true"
$env:MAIL_PROVIDER = "mailrelay"
$env:TESTMAIL_ENABLED = "false"

Write-Host "[start-worker-local] Starting dedicated ProjTrack worker."
Write-Host "[start-worker-local] MAIL_PROVIDER=$($env:MAIL_PROVIDER)"
Write-Host "[start-worker-local] MAIL_WORKER_ENABLED=$($env:MAIL_WORKER_ENABLED)"
Write-Host "[start-worker-local] BACKUP_WORKER_ENABLED=$($env:BACKUP_WORKER_ENABLED)"
Write-Host "[start-worker-local] TESTMAIL_ENABLED=$($env:TESTMAIL_ENABLED)"
Write-Host "[start-worker-local] Secrets are loaded from the existing backend environment; this script does not set or print API keys."

Push-Location (Join-Path $root "backend")
try {
  npm run worker
} finally {
  Pop-Location
}
