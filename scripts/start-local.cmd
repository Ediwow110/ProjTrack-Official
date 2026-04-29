@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "BACKEND_RUNNING="
for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":3001" ^| findstr LISTENING') do set "BACKEND_RUNNING=1"
set "FRONTEND_RUNNING="
for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do set "FRONTEND_RUNNING=1"

if not defined BACKEND_RUNNING (
  call "%ROOT%\scripts\prepare-local.cmd"
  if errorlevel 1 exit /b %errorlevel%
)

echo [start-local] Launching local services...
echo [start-local] Frontend: http://127.0.0.1:5173/student/login
echo [start-local] Backend: http://127.0.0.1:3001/health/live
echo [start-local] Demo credentials:
echo   Admin: admin@projtrack.local / Admin123!ChangeMe
echo   Teacher: teacher@projtrack.local / Teacher123!ChangeMe
echo   Student: student@projtrack.local or STU-2024-00142 / Student123!ChangeMe

if defined BACKEND_RUNNING (
  echo [start-local] Reusing backend on port 3001.
) else (
  start "PROJTRACK Backend" cmd /k "\"%ROOT%\scripts\run-backend-local.cmd\""
  timeout /t 5 /nobreak >nul
)

if defined FRONTEND_RUNNING (
  echo [start-local] Reusing frontend on port 5173.
) else (
  start "PROJTRACK Frontend" cmd /k "\"%ROOT%\scripts\run-frontend-local.cmd\""
)

echo [start-local] Backend and frontend were launched in separate windows.
echo [start-local] Run `npm run doctor:local` if you want a quick health check.
