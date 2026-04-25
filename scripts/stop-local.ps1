$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $root ".local-runtime"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend.pid"

function Stop-TrackedProcess([string] $PidFile) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $raw = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($raw -match '^\d+$') {
    try {
      Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $raw, "/T", "/F" -WindowStyle Hidden -Wait | Out-Null
    } catch {
      try {
        Stop-Process -Id ([int] $raw) -Force -ErrorAction SilentlyContinue
      } catch {
      }
    }
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-TrackedProcess $backendPidFile
Stop-TrackedProcess $frontendPidFile

foreach ($port in 3001, 5173) {
  try {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $listeners = @()
  }

  foreach ($listenerPid in $listeners) {
    try {
      Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", "$listenerPid", "/T", "/F" -WindowStyle Hidden -Wait | Out-Null
    } catch {
      try {
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
      } catch {
      }
    }
  }
}

Write-Host "[stop-local] Requested shutdown for listeners on ports 3001 and 5173."
