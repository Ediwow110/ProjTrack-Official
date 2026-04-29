@echo off
setlocal EnableExtensions
cd /d "%~dp0..\backend"

if not defined PORT set "PORT=3101"
if not defined DATABASE_URL (
  echo DATABASE_URL must be set before running this local helper.
  exit /b 1
)
if not defined JWT_ACCESS_SECRET (
  echo JWT_ACCESS_SECRET must be set before running this local helper.
  exit /b 1
)
if not defined JWT_REFRESH_SECRET (
  echo JWT_REFRESH_SECRET must be set before running this local helper.
  exit /b 1
)
if not defined APP_URL set "APP_URL=http://127.0.0.1:4173"
if not defined FRONTEND_URL set "FRONTEND_URL=http://127.0.0.1:4173"
if not defined CORS_ORIGINS set "CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173"
if not defined MAIL_PROVIDER set "MAIL_PROVIDER=stub"
if not defined MAIL_FROM_NAME set "MAIL_FROM_NAME=ProjTrack"
if not defined MAIL_FROM_ADMIN set "MAIL_FROM_ADMIN=admin@projtrack.codes"
if not defined MAIL_FROM_NOREPLY set "MAIL_FROM_NOREPLY=support@projtrack.codes"
if not defined MAIL_FROM_INVITE set "MAIL_FROM_INVITE=support@projtrack.codes"
if not defined MAIL_FROM_NOTIFY set "MAIL_FROM_NOTIFY=notification@projtrack.codes"
if not defined MAIL_FROM_SUPPORT set "MAIL_FROM_SUPPORT=support@projtrack.codes"
if not defined MAIL_FROM set "MAIL_FROM=support@projtrack.codes"
if not defined FILE_STORAGE_MODE set "FILE_STORAGE_MODE=local"
if not defined OBJECT_STORAGE_MODE set "OBJECT_STORAGE_MODE=local"

node -r ts-node/register src/main.ts
