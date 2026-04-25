@echo off
setlocal EnableExtensions

for %%P in (3001 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P" ^| findstr LISTENING') do (
    taskkill /PID %%A /F >nul 2>&1
  )
)

echo [stop-local] Requested shutdown for listeners on ports 3001 and 5173.
