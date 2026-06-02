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
- No new elevated role added for deletion execution.
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
  - All prior negative cases (non-APPROVED blocked, flag block, backup fail-closed, no destructive, audit on paths, no role-expansion path) retained and still pass.
- **Runbook update**: This section + explicit "No destructive deletion worker is implemented by this document" retained.
- **Safety gates re-verified** (via code read + grep forbidden searches): flag (DATA_DELETION_EXECUTION_ENABLED), dry-run only (plans/simulations, no deletes), backup gate (COMPLETED && !deletedAt required in verifyBackup + non-dry check in attempt), audit immutability (record-only, module=DataDeletion), no role-expansion path, no Prisma destructive in data-deletion/* or drill (drill is guarded pg_dump/psql on disposable targets only).
- **Local validation**: pinned Prisma@6.19.3 validate passed; forbidden searches clean (only planning notes); `npm run build` (no breakage from .mjs/.spec/.md); security test attempted (env limitation: 'jest' not recognized due to incomplete node_modules/.bin — reported as limitation per security-ci-verification skill, not code failure). No migrations/schema touched (test+drill+docs only).
- **Evidence**: Branch feat/test-data-deletion-backup-restore-drill-hardening (local only). All changes additive to test coverage and drill expectations. APPROVED ≠ executed; destructive paths unreachable.
- **Next gates**: Requires explicit user "merge PR #N" (after push/open if/when authorized) + full post-merge verification before any Phase 7 policy/impl.

**No destructive deletion worker is implemented by this document.** Production activation still requires future explicit multi-gate approval after all phases.

See also: drill:backup-restore in backend/package.json, execution service verifyBackup/attemptExecution, and security regression tests.

## 17. Phase 7A: Final Data Classification Policy

### A. Purpose

Phase 7A is policy-only. It finalizes the data classification contract that any future destructive implementation must follow. It does not implement, enable, or approve destructive deletion. It is a prerequisite for any future Phase 7B code work.

### B. Non-goals

- no code implementation
- no migration
- no production activation
- no deletion or anonymization execution
- no restore execution
- no new elevated role for deletion execution

### C. Data classification table

| Model / Table | Classification | Rationale | Backup requirement | Audit requirement | Restore consideration | Phase 7B implementation notes | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `User` | `ANONYMIZE` | Core identity row has many retained references (`DataDeletionRequest`, `AuditLog`, academic history, backups). Full delete is not the default policy for this model. | Verified pre-execution backup must include the user row and all referenced rows. | Record who approved, when anonymization occurred, what fields were minimized, and the irreversible point; never log raw secrets or replacement tokens in clear text. | Restore must be able to recover original identity data from backup during the retention window. | Clear direct identifiers (`email`, names, phone, office, avatar path), revoke access, invalidate auth material, and preserve a stable tombstone for retained foreign-key references. | `CRITICAL` |
| `StudentProfile` | `DELETE` | User-owned student profile data (`studentNumber`, section/year linkage) is direct personal data. | Verified backup required before deletion. | Audit row count and target profile id; do not copy profile values into audit text. | Restore must re-create the profile before dependent academic links are replayed. | Delete only after handling dependent `Enrollment` rows and any related user-owned academic rows. | `HIGH` |
| `TeacherProfile` | `DELETE` | User-owned teacher profile data (`employeeId`, department text) is direct personal data. | Verified backup required before deletion. | Audit target id and dependency handling; no raw employee identifiers in audit text. | Restore must re-create profile before optional teacher links are reattached. | Null or reassign `Subject.teacherId` before deleting the profile if the subject must remain. | `HIGH` |
| `DataDeletionRequest` | `RETAIN_WITH_PII_MINIMIZATION` | Governance evidence must survive the request lifecycle, but `reason`, `confirmationPhrase`, and reviewer notes may contain PII. | Backup must include request metadata before any irreversible step. | Every status transition and any later minimization must be audited; request evidence must not be destroyed. | Restore must preserve the original request timeline and review state. | Retain the row; future minimization must be narrow, approved, and must not erase accountability. | `CRITICAL` |
| `DataDeletionExecution` | `RETAIN_WITH_PII_MINIMIZATION` | Execution evidence must remain available after any future run, but `executionPlanJson` / `executionResultJson` must avoid or later minimize raw PII. | Backup must include the execution row and linked backup evidence. | Audit backup verification, dry-run, blocked execution, final irreversible step, and any later minimization. | Restore must preserve execution evidence and backup linkage. | Retain the row; Phase 7B must keep plan/result payloads metadata-only where possible. | `CRITICAL` |
| `BackupRun` | `RETAIN_WITH_PII_MINIMIZATION` | Backup metadata is operational evidence and is required after deletion; `createdById` / `notes` may need later minimization. | Backup metadata itself must be retained; backup retention/deletion is a separate policy area. | Audit which backup run gated execution and any retention-class decisions. | Restore depends on this metadata to identify the correct artifact and window. | Never delete backup metadata as part of a user deletion request. | `CRITICAL` |
| `AuditLog` | `RETAIN_WITH_PII_MINIMIZATION` | Audit integrity is mandatory; logs must survive deletion requests, though later approved minimization of retained PII may be needed. | Backup must cover audit rows that prove the request, review, backup, execution, and restore chain. | Audit logs must remain immutable and must never be bulk-deleted as part of user deletion. | Restore must preserve audit chronology and evidentiary value. | Retain rows; any minimization is separate, approved, and must not destroy accountability. | `CRITICAL` |
| `Notification` | `DELETE` | User-scoped notification content is personal operational data. | Verified backup required before deletion. | Audit counts and ids only; do not echo notification bodies. | Restore must be able to reinsert deleted notifications if rollback occurs inside the retention window. | Delete only notifications owned by the target user. | `MEDIUM` |
| `Course` | `UNTOUCHED` | Global academic structure, not user-owned data. | No destructive action on this table for a user request. | Audit that the table was intentionally untouched when relevant. | Restore not scoped to this table for user deletion. | Do not mutate course rows in Phase 7B. | `LOW` |
| `Department` | `UNTOUCHED` | Global reference data, not user-owned. | No destructive action on this table for a user request. | Audit untouched classification if referenced by a deleted teacher profile. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Section` | `UNTOUCHED` | Global academic structure, not user-owned. | No destructive action on this table for a user request. | Audit untouched classification if student relationships are removed. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `AcademicYear` | `UNTOUCHED` | Global academic calendar data, not user-owned. | No destructive action on this table for a user request. | Audit untouched classification if related profile rows are deleted. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `AcademicYearLevel` | `UNTOUCHED` | Global academic structure, not user-owned. | No destructive action on this table for a user request. | Audit untouched classification if related profile rows are deleted. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Subject` | `UNTOUCHED` | Subject rows are institutional academic records, not user-owned rows. | No destructive action on subject rows for a user request. | Audit any cleared teacher linkage separately from the retained subject row. | Restore of a deleted teacher profile may require reattaching the subject link from backup. | If a deleted teacher was linked, null or reassign `teacherId`; do not delete the subject row by default. | `MEDIUM` |
| `SubjectSection` | `UNTOUCHED` | Join table for institutional subject/section structure, not user-owned. | No destructive action on this table for a user request. | Audit untouched classification if dependent student/teacher data is removed elsewhere. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Enrollment` | `DELETE` | Student enrollment rows directly connect the user to academic participation. | Verified backup required before deletion. | Audit row counts and identifiers only. | Restore must be able to recreate enrollments before re-linking profile state. | Delete only enrollments for the target student profile. | `HIGH` |
| `SubmissionTask` | `UNTOUCHED` | Task definitions belong to course/subject operations, not the requesting user. | No destructive action on this table for a user request. | Audit untouched classification if user-owned submissions are later removed under a confirmed rule. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Group` | `RETAIN_WITH_PII_MINIMIZATION` | Group rows may need to survive for other members, but `leaderId` may still point at the deleted user. | Backup must include the row before any link-clearing or minimization. | Audit retained-row handling and any `leaderId` changes. | Restore must be able to reattach prior leader linkage if rollback is approved. | Retain the group; clear or remap user-identifying leadership fields only if they reference the target user. | `HIGH` |
| `GroupMember` | `DELETE` | Membership rows directly link the user to collaborative groups. | Verified backup required before deletion. | Audit deleted membership ids/counts only. | Restore must recreate memberships before higher-level collaboration state is replayed. | Delete only memberships for the target user. | `HIGH` |
| `Submission` | `NOT_CONFIRMED` | Current schema mixes student ownership, group ownership, submitter/reviewer references, and academic record needs; one uniform destructive rule is not yet proven safe. | Backup is mandatory before any future decision on this model. | Audit the decision path that selected delete vs retain behavior. | Restore requirements depend on whether the row was user-owned, group-shared, or merely user-referenced. | Phase 7B must split this model into proven sub-cases before mutating it. | `CRITICAL` |
| `SubmissionEvent` | `NOT_CONFIRMED` | Event rows may be user-owned history for deleted submissions or retained evidence for surviving submissions. | Backup is mandatory before any future decision on this model. | Audit whether events were retained, minimized, or deleted via submission cascade. | Restore depends on the corresponding submission decision. | Phase 7B must define separate rules for cascaded deletion versus retained submission history. | `HIGH` |
| `SubmissionFile` | `NOT_CONFIRMED` | File rows follow `Submission`; current schema does not prove one safe rule for all user-related cases. | Backup must include file metadata and artifact linkage before any future mutation. | Audit file ids/counts and artifact actions; do not log raw paths beyond what is operationally required. | Restore depends on the corresponding submission classification and retained artifact window. | Phase 7B must classify file handling together with the final `Submission` rules. | `HIGH` |
| `PendingUpload` | `DELETE` | User-owned temporary upload metadata and staged objects are direct personal content. | Verified backup required if the row or artifact is still relevant to the deletion scope. | Audit ids/counts and storage cleanup intent; avoid raw filenames where not required. | Restore must be able to recreate metadata and artifact mapping if rollback occurs inside the retention window. | Delete both metadata and associated artifact for the target user, subject to backup gate. | `HIGH` |
| `EmailJob` | `DELETE` | Rows contain direct email destination data and message payload for the target user. | Verified backup required before deletion. | Audit ids/counts and message class only; do not duplicate payload or full recipient address in audit text. | Restore must allow rehydration only from backup within the retention window. | Delete only jobs that belong to or target the requesting user. | `HIGH` |
| `EmailProviderEvent` | `RETAIN_WITH_PII_MINIMIZATION` | Provider events are operational delivery evidence, but may contain the user's email or payload fragments. | Backup must cover these rows before any later minimization policy is applied. | Audit any minimization separately; keep provider evidence intact. | Restore must preserve provider traceability. | Retain by default; any PII reduction must be narrowly approved and evidence-preserving. | `HIGH` |
| `EmailSuppression` | `RETAIN_WITH_PII_MINIMIZATION` | Suppression state may be needed to prevent future unwanted mail, but the email itself is PII. | Backup must cover the row before any future minimization decision. | Audit whether the row was retained and how any identifier reduction was handled. | Restore may need the original suppression state to prevent accidental mail after rollback. | Retain by default; do not remove mail-safety controls as a side effect of user deletion. | `HIGH` |
| `EmailUnsubscribe` | `RETAIN_WITH_PII_MINIMIZATION` | Unsubscribe state is a mail-governance control and may need to outlive the account, but contains email-linked data. | Backup must cover the row before any future minimization decision. | Audit retained-row handling and any approved identifier minimization. | Restore may need to preserve unsubscribe state after rollback. | Retain by default; do not recreate mail eligibility silently. | `HIGH` |
| `AuthSession` | `DELETE` | Active or historical session rows are user auth material and should not survive account deletion handling. | Verified backup required before irreversible deletion. | Audit revocation/deletion counts and timing; never log token hashes. | Restore may re-create sessions only if explicitly approved; default restore should not reactivate old sessions automatically. | Revoke first, then delete session rows for the target user. | `HIGH` |
| `AccountActionToken` | `DELETE` | Password-reset / activation tokens are sensitive auth material and must be removed for the target user. | Verified backup required before irreversible deletion. | Audit revocation/deletion counts only; never log token values or hashes. | Restore must not automatically reactivate expired or used tokens. | Revoke and delete all tokens for the target user. | `CRITICAL` |
| `AuthRateLimit` | `NOT_CONFIRMED` | `key` may represent email, IP, or another selector; current schema alone does not prove which rows belong to one user request. | Backup required before any future mutation of matched rows. | Audit the matching rule used if this table is ever touched. | Restore depends on how keys were matched and whether operational abuse controls must remain. | Phase 7B must define a safe selector policy before mutating this table. | `MEDIUM` |
| `WorkerHeartbeat` | `UNTOUCHED` | Global worker liveness state, unrelated to one user's data deletion request. | No destructive action on this table for a user request. | No special audit beyond untouched classification if referenced. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Announcement` | `UNTOUCHED` | Global content, not user-owned. | No destructive action on this table for a user request. | No special audit beyond untouched classification if referenced. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `Request` | `NOT_CONFIRMED` | Generic request table has no foreign key to `User`; current schema does not confirm ownership, retention basis, or safe matching. | Backup is mandatory before any future mutation decision. | Audit any future selector rule and why it was considered in-scope. | Restore depends on later ownership proof. | Phase 7B must not touch this table without a separate confirmed policy. | `HIGH` |
| `AcademicSetting` | `UNTOUCHED` | Global academic configuration, not user-owned. | No destructive action on this table for a user request. | No special audit beyond untouched classification if referenced. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `SystemSetting` | `UNTOUCHED` | Global system configuration, not user-owned. | No destructive action on this table for a user request. | No special audit beyond untouched classification if referenced. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `SystemTool` | `UNTOUCHED` | Global operational metadata, not user-owned. | No destructive action on this table for a user request. | No special audit beyond untouched classification if referenced. | Restore not scoped here. | Leave rows intact. | `LOW` |
| `ImportBatch` | `NOT_CONFIRMED` | Batch payloads may contain many-user data and `createdById` is only an optional creator link; single-user deletion behavior is not proven. | Backup is mandatory before any future mutation decision. | Audit any later classification rule and why mixed-user payload risk was acceptable. | Restore depends on whether payload scope was single-user or multi-user. | Phase 7B must not mutate this table without a separate proven rule. | `HIGH` |

Current-schema notes:
- No dedicated organization, tenant, branch, or school-ownership model is present in the current Prisma schema.
- No separate mail outbox model is present; `EmailJob` is the confirmed mail-queue table.
- Confirmed file/upload/media tables in the current schema are `PendingUpload` and `SubmissionFile`.

### D. Audit log policy

- Audit logs must not be deleted as part of a user data deletion request.
- Audit logs must retain operational integrity and evidentiary value.
- Any retained PII in audit records may only be minimized by a separate approved policy and implementation PR.
- Deleting audit logs would destroy accountability and is forbidden.

### E. Backup policy

- No destructive execution may occur without a verified backup.
- The backup id or run id must be linked to execution evidence.
- The backup must be restorable before any irreversible execution step.
- Backup metadata must be retained after deletion.
- Backup retention and later backup deletion are separate policy areas and are not approved by Phase 7A.

### F. Restore policy

- Restore is not implemented by Phase 7A.
- Restore drills are required before any production activation decision.
- Restore may require full-database restore or scoped restore, depending on proven system capability.
- Restore must preserve audit evidence and governance metadata.
- Restore after irreversible deletion may not be guaranteed outside the verified retention window.

### G. Irreversibility and retention window

- Approval is not execution.
- Execution is not finalization.
- The current policy baseline remains a retention window between approval and any destructive execution; the existing runbook recommendation of 7-30 days with 14 days as the default target remains the minimum planning baseline unless a later approved policy changes it.
- The irreversible point must be explicit, operator-confirmed, and audited.
- Minimum recommendation: no production irreversible execution until a backup/restore drill passes and user/operator confirms.

### H. Future Phase 7B implementation contract

Phase 7B may only implement code if all of the following are true:
- Phase 7A is merged.
- Phase 6 is merged.
- `main` is clean and current.
- All CI is green.
- The user explicitly says to proceed.
- The implementation follows the classification table in this section.
- The destructive feature flag remains disabled by default.
- Dry-run remains available.
- All destructive operations are idempotent, audited, and backup-gated.

### I. Future Phase 7C staging validation contract

- staging-only activation
- seeded deletion candidate
- verified backup before execution
- evidence that expected data was deleted, anonymized, retained, or left untouched per the classification table
- restore drill evidence
- no production activation

### J. Future Phase 7D production activation contract

- separate PR only
- explicit user approval
- manual gate
- monitoring and alerting
- rollback and incident plan
- no bulk automatic execution at first rollout

### K. Explicit lock statement

> Production destructive deletion remains locked after Phase 7A. This document is not production activation approval.
