@echo off
setlocal EnableExtensions
set "ROOT=%~dp0.."
call "%ROOT%\scripts\local-backend-env.cmd"
cd /d "%ROOT%\backend"
echo [run-backend-local] Starting backend with local development settings.
echo [run-backend-local] Mail worker disabled in this HTTP process. Use npm run start:worker for a dedicated worker.
node -r ts-node/register src/main.ts
