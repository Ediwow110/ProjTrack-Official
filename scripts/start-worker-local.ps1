$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $root "backend"

$env:NODE_ENV = "development"
$env:APP_ENV = "development"
$env:PORT = "3001"
$env:DATABASE_URL = "postgresql://projtrack:projtrack@127.0.0.1:5432/projtrack?schema=public"
$env:APP_URL = "http://127.0.0.1:5173"
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:JWT_ACCESS_SECRET = "local-dev-access-secret-change-before-production-1234567890"
$env:JWT_REFRESH_SECRET = "local-dev-refresh-secret-change-before-production-1234567890"
$env:MAIL_WORKER_ENABLED = "true"
$env:BACKUP_WORKER_ENABLED = "false"
$env:MAIL_PROVIDER = if ($env:PROJTRACK_WORKER_MAIL_PROVIDER) { $env:PROJTRACK_WORKER_MAIL_PROVIDER } else { "stub" }
$env:TESTMAIL_ENABLED = "false"
$env:MAIL_FROM_NAME = "ProjTrack"
$env:MAIL_FROM_ADMIN = "admin@projtrack.codes"
$env:MAIL_FROM_NOREPLY = "support@projtrack.codes"
$env:MAIL_FROM_INVITE = "support@projtrack.codes"
$env:MAIL_FROM_NOTIFY = "notification@projtrack.codes"
$env:MAIL_FROM_SUPPORT = "support@projtrack.codes"
$env:OBJECT_STORAGE_MODE = "local"
$env:FILE_STORAGE_MODE = "local"

Write-Host "[start-worker-local] Starting dedicated ProjTrack worker with local development settings."
Write-Host "[start-worker-local] DATABASE_URL targets local Docker PostgreSQL on 127.0.0.1:5432."
Write-Host "[start-worker-local] MAIL_PROVIDER=$($env:MAIL_PROVIDER)"
Write-Host "[start-worker-local] MAIL_WORKER_ENABLED=$($env:MAIL_WORKER_ENABLED)"
Write-Host "[start-worker-local] BACKUP_WORKER_ENABLED=$($env:BACKUP_WORKER_ENABLED)"
Write-Host "[start-worker-local] To use Mailrelay locally, set PROJTRACK_WORKER_MAIL_PROVIDER=mailrelay and provide provider secrets in your shell."
Write-Host "[start-worker-local] Secrets are never printed by this script."

Push-Location $backendDir
try {
  npm run dev:worker
} finally {
  Pop-Location
}
