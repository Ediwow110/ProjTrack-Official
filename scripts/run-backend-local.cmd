@echo off
setlocal EnableExtensions
cd /d "%~dp0..\backend"
node -r ts-node/register src/main.ts
