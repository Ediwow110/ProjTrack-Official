# DESIGN: Power User Data Deletion & Restore Center

**Date:** 2026-06-02  
**Status:** Proposed (docs-only)  
**PR:** TBD  
**Related:** silent-bug roadmap, PRs #118-#130, status-lifecycle-regressions.spec.ts, BACKUP_RESTORE_EVIDENCE.md, SECURITY_HARDENING_BACKLOG.md

## Context

The silent-bug hardening phases have locked down auth, isolation, token expiry, file ownership, mail workers, audit logs, and status lifecycles. User feedback highlighted desire for "Restore Center" and power users to manage their own data deletion.

Current state (read-only inventory):
- Restore/backup lives in **/admin/backups** (`src/app/pages/admin/Backups.tsx` + `backend/src/backups/backups.service.ts`).
- Comprehensive admin-only features: run backup, list history, protect/unprotect, delete (typed confirmation), restore (typed confirmation "RESTORE BACKUP"), settings, manifest, validation, download.
- High friction: backup confirmation for destructive actions, typed phrases, audit logging.
- **No standalone "Restore Center"**.
- **No POWER_USER role** (only ADMIN/TEACHER/STUDENT).
- **No user-facing self-service deletion**.
- Data model has rich ownership (User → Profile/Submission/File/Notification) but shared academic data (subjects, enrollments, audits, groups) and immutable logs.
- Strong audit via `auditLogs.record(actorUserId, action, result, metadata)`.
- Status lifecycle tests already guard PENDING/EXPIRED/QUEUED/FAILED/SENT transitions and invalid values.

Direct self-deletion by power users is unsafe due to blast radius, FKs, audit gaps, and restore needs. A structured request/approval + backup-before-delete model is required.

## Recommended Feature Model

**Feature Name:** Power User Data Deletion & Restore Center

**User Story**
- Trusted/power users can submit a deletion request for *their own data only*.
- Request triggers mandatory fresh backup + audit.
- ADMIN reviews, approves/denies with reason.
- On approval: system takes/verifies backup, performs selective soft-delete/anonymization of personal data, hard-deletes non-shared personal artifacts, logs every step.
- Restore available only to ADMIN via existing Backups flow or dedicated Restore Center page.
- All actions immutable in audit trail with full context (actor, targetUserId, reason, backupRef, status transitions).

**Recommended Permission Model**
- **Capability flag on User** (`canRequestDataDeletion: boolean`, default false for students/teachers; opt-in for power users). Avoid new `POWER_USER` role to minimize permission explosion.
- Request endpoint guarded by `requireUserCanRequestDeletion()` (own data only).
- Approval/execution strictly ADMIN-only.
- Justification: granular, auditable, no role bloat, easy to revoke. Aligns with existing per-user flags (e.g. backupSettings).

**Required Backend Entities** (new, in separate PR)
- `DataDeletionRequest` (id, userId, status, reason, requestedAt, approvedAt, backupId, completedAt, metadata Json)
- Leverage/extend existing `BackupRun` for restore points.
- Status lifecycle enforced via `submission-lifecycle` style normalizer + `canTransition*` guards (reuses PR #128 patterns).

**Required Statuses** (align to existing lifecycle tests)
- REQUESTED → APPROVED → BACKUP_CREATED → DELETION_RUNNING → COMPLETED/FAILED
- DENIED, CANCELLED, RESTORED
- Invalid transitions rejected with BadRequest + audit (extend status-lifecycle-regressions.spec.ts).

**Recommended API Endpoints** (scoped, test-first)
- `POST /me/data-deletion-requests` (user request with confirmation phrase)
- `GET /me/data-deletion-requests`
- Admin: `GET /admin/data-deletion-requests`, `POST /admin/data-deletion-requests/:id/approve`, `/deny`, `/run` (executes after backup), `/restore`
- All guarded, audited, idempotent where possible.

**Recommended UI Pages/Components**
- User portal: "My Data" or "Account Settings" → "Request Data Deletion" (modal with exact phrase "DELETE MY DATA", warning of irreversibility, backup note).
- Admin: Expand `/admin/backups` or new `/admin/restore-center` with tabs for Backup History + Deletion Requests queue.
- Detail modals with audit trail, manifest diff, restore button (typed confirmation).
- Heavy use of existing `AppModal`, confirmation patterns from Backups.tsx.

**Required Tests** (test-first per silent-bug pattern)
- `test(deletion): add deletion-request authorization regressions` (cannot target other users, non-power users blocked).
- Status lifecycle for deletion requests (invalid statuses, terminal states not reprocessed).
- Backup-before-delete enforcement + audit completeness regressions.
- Restore integrity (existing backup drill extended).
- Isolation (shared data not deleted).
- Idempotency, partial failure rollback, confirmation phrase enforcement.
- No production code changed until tests prove gaps.

**Rollout Plan (phased, test-first, docs-first)**
1. **docs/design:** this document + update SECURITY_HARDENING_BACKLOG.md (current PR).
2. test(deletion): authorization + lifecycle regressions (new spec or extend status-lifecycle).
3. feat(backend): DataDeletionRequest model, service, approval workflow + tests (no schema change until approved).
4. test(backup): before-delete enforcement, audit regressions.
5. feat(backend): guarded deletion worker + status machine.
6. test(restore): integrity regressions.
7. feat(ui): user request UI + admin Deletion Center.
8. chore: production runbook/drill for deletion/restore.
9. Monitor with existing query-plan/audit tools.

**Non-Goals**
- No immediate hard-delete or direct power-user deletion.
- No schema/migrations without explicit approval + backup drill.
- No new ROLE enum value in first PRs.
- No touching TOTP, password policy, mail constants, Restore Center production code until design approved.
- No implementation in this design doc.

## Risk Register

| Risk | Severity | Failure Mode | Required Guardrail | Required Test | Owner |
|------|----------|--------------|--------------------|---------------|-------|
| Deleting another user's data | Critical | Bypassed ownership check | Strict userId matching + approval gate | Authorization regressions (extend data-isolation) | AccessModule |
| Shared academic records deleted | Critical | FK violations, broken references | Selective anonymize only personal data; never delete subjects/enrollments | Blast-radius + lifecycle tests | Submissions/Files |
| Incomplete deletion / partial state | High | Silent corruption | Transactional steps + status machine + rollback on failure | Status-lifecycle-regressions + new deletion tests | BackupsService |
| Missing/corrupt restore point | High | Data loss on restore | Mandatory validated backup before deletion; manifest + SHA check | Backup integrity drill + validate endpoint | BackupsModule |
| Audit gap | High | No trace of action | `auditLogs.record` on every transition with full metadata | Audit-log-regressions extension | AuditLogsModule |
| Malicious power user abuse | Medium | Spam requests | Rate limiting + admin review queue + cooldown | Request idempotency test | DeletionService |
| Accidental admin approval | Medium | Wrong user deleted | Typed confirmation + preview of impact + 2nd approver if possible | UI confirmation + admin test | Admin UI |
| Deletion during active review/submission | Medium | Data inconsistency | Block if active submissions; status checks | Pre-deletion guard tests | SubmissionsService |
| Mail/notification leakage | Low | Deleted identity in old emails | Anonymize PII in notifications on delete | Mail-worker + deletion test | MailModule |

## Recommended Next PR Sequence

1. **docs/design: power-user data deletion and restore center plan** (this doc, allowed: docs/*.md; forbidden: all src/, backend/src except tests if needed, schema, env).
2. **test(deletion): add deletion request authorization + lifecycle regressions** (backend/test/security/*-regressions.spec.ts only).
3. **feat(deletion): add DataDeletionRequest model + admin approval workflow** (backend/src/* with tests; schema change only after approval).
4. **test(backup): add backup-before-delete + audit regressions**.
5. **feat(deletion): guarded deletion worker + status lifecycle integration**.
6. **test(restore): add restore-point integrity regressions**.
7. **feat(ui): Power User data deletion request UI**.
8. **feat(admin): Restore/Data Deletion Center UI** (expand Backups.tsx).
9. **chore(runbook):** production deletion/restore drill + evidence.

Each PR must be test-first where possible, docs-only where specified, no production behavior change until tests prove necessity, explicit user approval for any schema/production changes.

## Approval Gate

This design is docs-only. Implementation requires separate explicit approval per PR, starting with test regressions.

**Final Status:** Discovery and design complete. Ready for docs PR.

---
**References**
- backend/test/security/status-lifecycle-regressions.spec.ts:1 (existing coverage reused)
- src/app/pages/admin/Backups.tsx:25 (confirmation patterns)
- backend/src/backups/backups.service.ts (existing backup/restore)
- docs/BACKUP_RESTORE_EVIDENCE.md
- docs/SECURITY_HARDENING_BACKLOG.md (to be updated)
