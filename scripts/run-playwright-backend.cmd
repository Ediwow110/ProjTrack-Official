@echo off
setlocal EnableExtensions
cd /d "%~dp0..\backend"

if not defined PORT set "PORT=3101"
if not defined DATABASE_URL set "DATABASE_URL=postgresql://projtrack:projtrack@localhost:5432/projtrack"
if not defined JWT_ACCESS_SECRET set "JWT_ACCESS_SECRET=playwright-access-secret"
if not defined JWT_REFRESH_SECRET set "JWT_REFRESH_SECRET=playwright-refresh-secret"
if not defined APP_URL set "APP_URL=http://127.0.0.1:4173"
if not defined FRONTEND_URL set "FRONTEND_URL=http://127.0.0.1:4173"
if not defined CORS_ORIGINS set "CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173"
if not defined MAIL_PROVIDER set "MAIL_PROVIDER=stub"
if not defined MAIL_FROM set "MAIL_FROM=noreply@projtrack.local"
if not defined FILE_STORAGE_MODE set "FILE_STORAGE_MODE=local"
if not defined OBJECT_STORAGE_MODE set "OBJECT_STORAGE_MODE=local"

node -r ts-node/register src/main.ts
