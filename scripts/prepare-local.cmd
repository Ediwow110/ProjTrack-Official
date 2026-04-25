@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "BACKEND_RUNNING="
for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":3001" ^| findstr LISTENING') do set "BACKEND_RUNNING=1"
if defined BACKEND_RUNNING (
  echo [prepare-local] Backend already running on port 3001.
  echo [prepare-local] Skipping Prisma preparation to avoid file-lock conflicts. Run `npm run stop:local` for a full reset.
  exit /b 0
)

pushd "%ROOT%\backend"

echo [prepare-local] Starting PostgreSQL and MinIO...
call npm.cmd run infra:up
if errorlevel 1 exit /b %errorlevel%

set "FORCE_PRISMA_GENERATE=%FORCE_PRISMA_GENERATE%"
if /I "%FORCE_PRISMA_GENERATE%"=="true" goto generate_prisma
if not exist "%ROOT%\backend\node_modules\.prisma\client\index.js" goto generate_prisma

echo [prepare-local] Reusing existing Prisma client for a faster local start.
echo [prepare-local] Set FORCE_PRISMA_GENERATE=true if you changed the Prisma schema and need a fresh client.
goto apply_migrations

:generate_prisma
echo [prepare-local] Generating Prisma client...
call npm.cmd run prisma:generate
if errorlevel 1 exit /b %errorlevel%

:apply_migrations
echo [prepare-local] Applying Prisma migrations...
call npm.cmd run prisma:migrate:deploy
if errorlevel 1 exit /b %errorlevel%

echo [prepare-local] Seeding local data...
call npm.cmd run seed:local
if errorlevel 1 exit /b %errorlevel%

popd
echo [prepare-local] Local infrastructure and database are ready.
