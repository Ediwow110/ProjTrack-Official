@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set "VITE_USE_BACKEND=true"
set "VITE_API_BASE_URL=http://127.0.0.1:3001"
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173
