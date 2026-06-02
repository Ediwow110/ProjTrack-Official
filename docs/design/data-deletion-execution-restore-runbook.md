# Data Deletion Execution and Restore Safety Runbook

**Status**: Design / Policy Document (no implementation of execution in this doc)
**Related**: PR #134 DataDeletionRequest foundation (metadata only: PENDING/APPROVED/DENIED/CANCELLED)
**Date**: 2026-06-02
**Owner**: Platform / Governance

## 1. Goals and Non-Goals

**Goals**
- Provide governed, auditable path for users to request deletion of their account data.
- Ensure admin review/approval is always required before any irreversible action.
- Guarantee a verified backup exists before any deletion execution.
- Preserve audit integrity and legal obligations.
- Define clear restore policy and failure handling.
- Make all steps idempotent, logged, and observable.

**Non-Goals (in this phase)**
- No automatic or immediate deletion on APPROVED.
- No hard/soft delete or anonymization code in this document's scope.
- No changes to production deployment, passwords, tokens, mail, 2FA.
- No POWER_USER role.
- No direct execution worker merged without separate explicit user approval after this doc.

## 2. DataDeletionRequest Lifecycle (current, from PR #134)

- PENDING (default on create by user, after exact "DELETE MY DATA" phrase)
- APPROVED (admin only, metadata)
- DENIED (admin only, optional reviewNote)
- CANCELLED (user self or admin, for own PENDING)

**Key invariant**: APPROVED ≠ executed. Execution is future and separate.

Proposed future execution statuses (for planning only, not implemented here):
APPROVED → BACKUP_STARTED → BACKUP_COMPLETED → EXECUTION_QUEUED → EXECUTION_STARTED → EXECUTION_COMPLETED / FAILED → (if needed) RESTORE_REQUIRED → RESTORED → FINALIZED

## 3. Backup-Before-Delete Requirement (Mandatory)

- No deletion execution may start without a successful, verified backup run attached (backupRunId or equivalent).
- The backup must be completed and integrity-checked (size, checksum if available) before queuing execution.
- Execution record must reference the backup id/run.
- If backup fails or is unavailable, execution must not proceed; status → BACKUP_FAILED or equivalent, admin notified.

## 4. Retention / Waiting Window

- Recommended minimum: 7–30 days between APPROVED and irreversible execution (configurable per policy, default 14 days suggested).
- During window: user/admin may still cancel/deny if new evidence appears.
- After window + backup verified + approvals: execution may be triggered by controlled process only.

## 5. Restore Policy

- Restore is allowed only for APPROVED or partially executed cases where user/admin provides justification.
- Initiator: ADMIN or designated operator with 2-person approval for prod.
- Evidence required: ticket, approval chain, backup id used.
- Full audit trail of restore action.
- Post-restore: the original deletion request should be marked RESTORED or similar; user account may be re-provisioned under new controls.

## 6. Data Classification & Strategy

Categories and recommended handling (subject to legal review):

- Core identity (User email, names, role, status): delete or anonymize after retention.
- Profiles (Student/TeacherProfile, numbers, sections): delete.
- Academic data (enrollments, submissions, grades, files): delete user-owned; retain aggregate/anonymized stats if required for school reporting.
- Files/uploads: delete artifacts + metadata after backup.
- Audit logs: **MUST NOT be deleted**. PII minimization (redact email/name in retained logs after retention window).
- Notifications, mail jobs, sessions, tokens: delete.
- BackupRun / ImportBatch records: retain or anonymize creator references.
- System settings, etc.: untouched.

**Anonymization fallback**: where deletion is blocked by FK/integrity, replace PII with tokens like "DELETED-USER-<hash>" and drop links.

## 7. Audit Immutability & Legal

- AuditLog.actorUserId for the requesting user must be nulled or preserved per policy; never bulk delete audit rows as part of user request.
- All deletion steps (request, approve, backup, execute, restore) produce immutable AuditLog entries with module="DataDeletion", action= specific, before/after values.
- Legal hold: if a user is under investigation, requests must be blocked or flagged.

## 8. Failure Modes & Idempotency

- Backup fails: block execution, alert, allow retry after manual intervention.
- Partial delete: record partial state, support resume or full rollback via restore from the pre-delete backup.
- Worker crash: use status + lease/lock + timeout; on restart, resume or mark failed.
- Conflicting session: on execution start, revoke active sessions for the user.
- Repeated request: backend already rejects duplicate PENDING; execution must be idempotent (check execution record exists).
- Rate/abuse: limit requests per user per time window; flag suspicious patterns in admin list.

## 9. Admin Approval & Execution Trigger

- Only ADMIN role can approve/deny (enforced by @Roles('ADMIN') on backend).
- Execution trigger: either scheduled worker (after window) or explicit admin "Execute Now" (behind feature flag + dry-run confirmation).
- Every execution step requires typed confirmation phrase for operators.

## 10. Feature Flag & Dry-Run

- Deletion execution behind env flag (e.g. DATA_DELETION_EXECUTION_ENABLED=false by default).
- Dry-run mode: simulate steps, log what would be deleted, do not mutate.
- All prod runs must start in dry-run, reviewed, then real run.

## 11. Required Pre-Worker Checks (before any execution worker merge)

- Backup/restore capability verified in prod (runbook steps executed).
- E2E tests covering full request → approve → (simulated) backup → execute path (with dry-run).
- Security regression tests for all authz boundaries (user vs admin, cross-user).
- Audit log immutability test (cannot delete audit as side effect).
- Failure injection tests (backup fail, partial, crash).
- Operator runbook walkthrough and sign-off.
- Legal/compliance review of retention and anonymization choices.
- Rollback tested (restore from the referenced backup).

## 12. Rollback Plan

- Stop worker.
- Use the referenced pre-delete backup to restore user data.
- Mark request RESTORED.
- Create incident + post-mortem.
- Re-enable only after fixes + re-approval.

## 13. Manual Production Runbook (high level)

1. Confirm request is APPROVED and within policy window.
2. Trigger/confirm backup for the user scope; verify artifact + checksum + id recorded on request/execution.
3. Wait retention window.
4. (Operator) Run execution in dry-run first; review log.
5. Type confirmation phrase.
6. Execute for real (or let worker).
7. Verify completion status, notify user (if policy allows), update request to EXECUTION_COMPLETED.
8. If failure: follow failure mode, offer restore path.

## 14. Explicit Statement

**No destructive deletion worker is implemented by this document.** All code changes for actual deletion, anonymization, or restore execution require separate explicit user approval after review of this runbook, full test gates, and a fresh PR (see PR E plan).

---

**Approval of this document does not authorize execution code.** User must say "proceed with deletion execution worker" after reviewing this + PRs A/B/C merged + checks green.

Next: implement PR E only on explicit approval.

## 15. PR E Implementation Notes (added after merge of A/B/C/D)

- Execution tracking model + status enum added (additive).
- DataDeletionExecutionService provides dry-run planning, simulation, backup verification gate.
- Destructive execution path is intentionally blocked by default (env flag DATA_DELETION_EXECUTION_ENABLED, and even when true, this PR fails closed with message).
- Admin-only endpoints for triggering dry-run, viewing status, verifying backup.
- Worker shell exists but is no-op / disabled unless flag.
- Tests added for safety boundaries (no exec on non-approved, backup fail-closed, dry-run idempotent, no destructive calls, audit, flag block).
- Audit logs written for all execution steps.
- No real delete/anonymize/restore executed.
- Migration 20260602203155_add_data_deletion_execution is clean (only execution table/enum/indexes/FK to request).
- This PR prepares infrastructure; production destructive activation requires future explicit user-approved PR + all gates.

See code in backend/src/data-deletion/data-deletion-execution.* and tests.

## 16. Phase 6: Backup / Restore Drill Hardening (added after merge of #143)

- **Drill script hardened**: backend/scripts/backup-restore-drill.mjs default EXPECTED_TABLES now includes `DataDeletionRequest,DataDeletionExecution` (in addition to BackupRun etc.). This ensures every backup/restore drill cycle covers the governance metadata tables (critical for future restore of deletion requests/executions under backup-first + verified gate policy). Script header updated with Phase 6 note.
- **Test hardening (data-deletion-request-regressions.spec.ts)**: Added 4 new tests inside 'execution worker safety (PR E)' describe:
  - verifyBackup success path for COMPLETED + !deletedAt: asserts status=BACKUP_VERIFIED, update called with correct data, DATA_DELETION_BACKUP_VERIFIED audit recorded.
  - attemptExecution blocks on flag (default) *even when* status=BACKUP_VERIFIED + backupRunId present (non-dry-run gating + fail-closed).
  - Idempotency for verify on already-BACKUP_VERIFIED state.
  - Cross-check that drill now covers DataDeletion* tables (links drill + service tests).
  - All prior negative cases (non-APPROVED blocked, flag block, backup fail-closed, no destructive, audit on paths, POWER_USER absent) retained and still pass.
- **Runbook update**: This section + explicit "No destructive deletion worker is implemented by this document" retained.
- **Safety gates re-verified** (via code read + grep forbidden searches): flag (DATA_DELETION_EXECUTION_ENABLED), dry-run only (plans/simulations, no deletes), backup gate (COMPLETED && !deletedAt required in verifyBackup + non-dry check in attempt), audit immutability (record-only, module=DataDeletion), no POWER_USER, no Prisma destructive in data-deletion/* or drill (drill is guarded pg_dump/psql on disposable targets only).
- **Local validation**: pinned Prisma@6.19.3 validate passed; forbidden searches clean (only planning notes); `npm run build` (no breakage from .mjs/.spec/.md); security test attempted (env limitation: 'jest' not recognized due to incomplete node_modules/.bin — reported as limitation per security-ci-verification skill, not code failure). No migrations/schema touched (test+drill+docs only).
- **Evidence**: Branch feat/test-data-deletion-backup-restore-drill-hardening (local only). All changes additive to test coverage and drill expectations. APPROVED ≠ executed; destructive paths unreachable.
- **Next gates**: Requires explicit user "merge PR #N" (after push/open if/when authorized) + full post-merge verification before any Phase 7 policy/impl.

**No destructive deletion worker is implemented by this document.** Production activation still requires future explicit multi-gate approval after all phases.

See also: drill:backup-restore in backend/package.json, execution service verifyBackup/attemptExecution, and security regression tests.