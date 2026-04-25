@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

if not defined PLAYWRIGHT_FRONTEND_PORT set "PLAYWRIGHT_FRONTEND_PORT=4173"
if not defined VITE_USE_BACKEND set "VITE_USE_BACKEND=true"
if not defined VITE_API_BASE_URL set "VITE_API_BASE_URL=http://127.0.0.1:3101"

node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port %PLAYWRIGHT_FRONTEND_PORT%
