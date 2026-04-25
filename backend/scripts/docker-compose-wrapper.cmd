@echo off
setlocal EnableExtensions

where docker-compose >nul 2>nul
if not errorlevel 1 (
  docker-compose %*
  exit /b %errorlevel%
)

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker CLI is not installed or not on PATH.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose is not available. Install docker-compose or enable the Docker Compose plugin.
  exit /b 1
)

docker compose %*
exit /b %errorlevel%
