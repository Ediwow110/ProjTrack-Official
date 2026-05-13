# PROJTRACK

[![CI](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml/badge.svg?branch=2nd-main)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml)
[![Production Checks](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml/badge.svg)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml)

PROJTRACK uses a React frontend and a NestJS + Prisma backend backed by PostgreSQL.

## Local setup

1. Install frontend dependencies with `npm ci`
2. Install backend dependencies with `npm --prefix backend ci`
3. Copy and review the env files:
   - frontend local template: `.env.example`
   - backend local template: `backend/.env.local.example`
   - backend production template: `backend/.env.production.example`
4. Run `npm start`

Frontend only: `npm run dev`
Backend only: `npm --prefix backend run dev`
Direct backend console: `npm run backend:local`
Direct frontend console: `npm run frontend:local`
Backend one-shot server: `npm --prefix backend run serve:local`
Bootstrap infra only: `npm run prepare:local`
Health check your local stack: `npm run doctor:local`
Portable Node launcher: `npm run start:portable`
Stop local app servers: `npm run stop:local`

Production-like local infrastructure: `npm --prefix backend run infra:up`

On Windows, `npm start` now uses native `.cmd` launchers for a more reliable local boot sequence. It does the following:
- starts PostgreSQL and MinIO
- waits for both services to accept connections
- runs `prisma generate`
- runs `prisma migrate deploy`
- starts detached backend and frontend processes with logs in `.local-runtime/`
