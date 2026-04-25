# Phase 1 Official-mode reachability audit

| Surface | Official mode behavior | Prototype gate | Notes |
| --- | --- | --- | --- |
| Frontend runtime (`src/app/lib/api/runtime.ts`) | Backend is default; non-backend use now requires explicit `VITE_ALLOW_PROTOTYPE=true` | `assertPrototypeModeAllowed()` | Shared runtime guard now provides one source of truth. |
| Frontend services (`src/app/lib/api/services.ts`) | Backend calls stay authoritative and fail through HTTP errors | `delay()` and `ensurePrototypeModeAllowed()` now hard-fail when prototype is not explicitly allowed | Removes silent mock reachability from auth/profile/submission/admin flows when backend mode is off without opt-in. |
| Frontend mock dataset (`src/app/lib/api/mockServer.ts`) | Passive data only; no official-mode path should consume it | Protected by runtime/service prototype assertions | Mock data remains available only for explicit prototype runs. |
| Backend persistence selection (`backend/src/config/persistence-mode.ts`) | Prisma remains default | `ALLOW_PROTOTYPE=true` required when `PERSISTENCE_MODE=prototype` | Prevents silent fallback to store-backed persistence. |
| Backend auth guards/modules | JWT auth is the active guard path | No `PrototypeAuthGuard` present | Audit confirmed no active controller depends on `PrototypeAuthGuard`. |
| Login / activate / forgot / reset / `/auth/me` | Backend-only in official mode | Frontend prototype access blocked unless explicit allow | Backend auth service remains source of truth. |
| Profile writes / password changes | Backend-only in official mode | Frontend prototype access blocked unless explicit allow | No official-mode mock write path remains reachable. |
| Student submit / teacher review / admin writes / group tools / system tools | Backend-only in official mode | Frontend prototype access blocked unless explicit allow | Official mode now fails loudly when backend calls fail. |
