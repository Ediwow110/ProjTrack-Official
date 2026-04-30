$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $root ".local-runtime"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend.pid"
$backendOutLog = Join-Path $runtimeDir "backend.out.log"
$backendErrLog = Join-Path $runtimeDir "backend.err.log"
$frontendOutLog = Join-Path $runtimeDir "frontend.out.log"
$frontendErrLog = Join-Path $runtimeDir "frontend.err.log"
$backendUrl = "http://127.0.0.1:3001/health/live"
$frontendUrl = "http://127.0.0.1:5173/student/login"

function Ensure-RuntimeDirectory {
  if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }
}

function Test-HttpOk([string] $Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-HttpOk([string] $Url, [int] $TimeoutSeconds, [string] $Name) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk $Url) {
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Get-ListeningPids([int] $Port) {
  try {
    return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    return @()
  }
}

function Stop-ProcessTreeByPid([int] $Pid) {
  try {
    Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", "$Pid", "/T", "/F" -WindowStyle Hidden -Wait | Out-Null
  } catch {
    try {
      Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
    } catch {
    }
  }
}

function Remove-IfExists([string] $Path) {
  if (Test-Path $Path) {
    Remove-Item $Path -Force -ErrorAction SilentlyContinue
  }
}

function Start-DetachedCommand([string] $Name, [string] $CommandFile, [string] $PidFile, [string] $StdOutLog, [string] $StdErrLog) {
  Remove-IfExists $StdOutLog
  Remove-IfExists $StdErrLog

  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/d", "/s", "/c", "`"$CommandFile`"" `
    -WorkingDirectory $root `
    -RedirectStandardOutput $StdOutLog `
    -RedirectStandardError $StdErrLog `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -Path $PidFile -Value $process.Id
  Write-Host "[start-local] Started $Name (PID $($process.Id))."
}

function Invoke-LocalPreparation {
  $prepareScript = Join-Path $root "scripts\prepare-local.cmd"
  for ($attempt = 1; $attempt -le 2; $attempt += 1) {
    & $prepareScript
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
      return
    }

    $isTransientWindowsCrash = $exitCode -eq -1073741819 -or $exitCode -eq 3221225477
    if ($attempt -lt 2 -and $isTransientWindowsCrash) {
      Write-Host "[start-local] Local preparation crashed with exit code $exitCode; retrying once..."
      Start-Sleep -Seconds 2
      continue
    }

    throw "Local preparation failed with exit code $exitCode."
  }
}

Ensure-RuntimeDirectory

$backendHealthy = Test-HttpOk $backendUrl
if (-not $backendHealthy) {
  Write-Host "[start-local] Preparing local infrastructure..."
  Invoke-LocalPreparation

  $backendScript = (Join-Path $root "scripts\run-backend-local.cmd")
  Start-DetachedCommand -Name "backend" -CommandFile $backendScript -PidFile $backendPidFile -StdOutLog $backendOutLog -StdErrLog $backendErrLog
  Wait-HttpOk -Url $backendUrl -TimeoutSeconds 60 -Name "Backend"
} else {
  Write-Host "[start-local] Reusing existing backend on http://127.0.0.1:3001."
}

$frontendHealthy = Test-HttpOk $frontendUrl
if (-not $frontendHealthy) {
  $frontendScript = (Join-Path $root "scripts\run-frontend-local.cmd")
  Start-DetachedCommand -Name "frontend" -CommandFile $frontendScript -PidFile $frontendPidFile -StdOutLog $frontendOutLog -StdErrLog $frontendErrLog
  Wait-HttpOk -Url $frontendUrl -TimeoutSeconds 60 -Name "Frontend"
} else {
  Write-Host "[start-local] Reusing existing frontend on http://127.0.0.1:5173."
}

Write-Host ""
Write-Host "[start-local] PROJTRACK is ready."
Write-Host "[start-local] Frontend: http://127.0.0.1:5173/student/login"
Write-Host "[start-local] Backend: http://127.0.0.1:3001/health/live"
Write-Host "[start-local] Logs: $runtimeDir"
Write-Host "[start-local] Demo account auto-seeding is disabled."
