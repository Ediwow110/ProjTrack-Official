# Performance Acceptance Gate

Branch: `2nd-main`  
Last updated: 2026-05-15

## Gate verdict

Not passed.

This gate defines the minimum performance and scalability evidence required before production-readiness, 300-500 concurrent-user claims, 1000+ concurrent-user claims, or 20k-50k registered-user school-scale claims are made.

## Capacity tracking

- Issue #34 tracks the bounded submission list/export blocker.
- Issue #35 tracks the 1000+ capacity evidence gate.
- Issue #36 tracks the 20k-50k registered-user school-scale gate.
- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` records tiered validation evidence.

Required distinction:

- 20k-50k registered users requires synthetic data, bounded database queries, indexes, and data-volume evidence.
- 1000+ concurrent users requires load-test evidence, database connection headroom, memory stability, and slow-query review.
- 20k-50k concurrent users is not currently claimed and would require a separate architecture program.

## Current mitigation status

Implemented:

- Student submission list active service path uses bounded Prisma query with `take: 100`.
- Teacher submission list active service path uses bounded Prisma query with `take: 100`.
- Teacher export active service path uses bounded Prisma query with `take: 1001`, returns up to 1000 rows, and reports truncation metadata.
- Teacher list/export active path uses relational teacher filtering instead of the old unbounded task-ID pre-query.
- Legacy submission repository list helpers now enforce default/hard caps and skip bounds.
- Legacy teacher repository helper no longer preloads all teacher task IDs before querying submissions.
- User repository list helpers now enforce default/hard caps and skip bounds.
- Audit-log repository list helper now enforces default/hard caps and skip bounds.
- Subject, subject-activity, subject-group, student-subject, and teacher-subject repository list helpers now enforce default/hard caps and skip bounds.
- Notification feed repository list helper now enforces default/hard caps and skip bounds.
- File metadata listing now enforces default/hard caps and skip bounds.
- Admin storage object listing now caps local directory walks and S3 pagination.
- Subject activity reads use submission counts instead of loading full submission arrays.
- Dashboard summary paths now use database `count()` queries instead of loading subject/submission/user arrays into application memory.
- Dashboard upcoming-deadline path is capped with `DASHBOARD_DEADLINE_LIMIT = 50`.
- Dashboard audit-activity path now requests only `DASHBOARD_ACTIVITY_LIMIT = 10` rows at the repository/database layer.
- Static regression tests assert active service paths do not call legacy list helpers, assert legacy/user/audit/subject/notification helpers remain bounded, block file metadata/storage listing regressions, and block dashboard summary/activity regressions.
- Additive school-scale index migration exists at `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`.
- Query-plan checker exists at `backend/scripts/check-school-scale-query-plans.cjs` and is wired as `npm --prefix backend run check:query-plans`.
- Manual school-scale validation workflow exists at `.github/workflows/school-scale-validation.yml`.
- Validation result template exists at `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.

Still open:

- Security/performance test run evidence is not recorded after the repository/dashboard/file bounds cleanup.
- Index migration must be deployed and validated with query-plan evidence.
- Tiered school-scale workflow results are not recorded.
- Broader query audit remains incomplete.
- Load evidence is not recorded.

## Required command evidence

```bash
grep -R "findMany({\|findMany()" backend/src
grep -R "for .*await\|forEach(async\|map(async" backend/src
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run check:query-plans
npm --prefix backend run build
npm --prefix backend run test:security
```

## Required documents

- [x] `docs/CODE_AUDIT.md`
- [x] `docs/LOAD_TEST_PLAN.md`
- [x] `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- [x] `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- [x] Initial query audit findings recorded in this document
- [x] School-scale index migration added
- [x] Query-plan checker added
- [x] Manual school-scale validation workflow added
- [x] Legacy submission repository list helpers bounded
- [x] User and audit-log repository list helpers bounded
- [x] Subject repository list helpers bounded
- [x] Notification feed repository list helper bounded
- [x] File metadata and storage object listing bounded
- [x] Dashboard summary/deadline/activity paths bounded
- [ ] Tier 1 workflow result recorded
- [ ] Tier 2 workflow result recorded
- [ ] Tier 3 workflow result recorded
- [ ] Load test results recorded in `docs/LOAD_TEST_RESULTS.md`

## Query audit findings

### PERF-FINDING-001: active student submission list is now database-bounded

Status: Mitigated on active service path and legacy repository helper  
Severity: High  
Affected active method: `SubmissionsService.studentList`

Evidence:

- `backend/src/submissions/submissions.service.ts` uses bounded Prisma query with `take: 100`.
- `backend/test/security/submission-list-response-bounds.spec.ts` asserts the bounded query and verifies the legacy repository list method is not called by `studentList`.
- `backend/src/repositories/submission.repository.ts::listStudentSubmissions` now clamps `take` and `skip` with a hard maximum of 500 rows.
- `backend/test/security/submission-service-static-bounds.spec.ts` asserts legacy repository list helper bounds.
- Index migration adds `Submission_studentId_createdAt_idx` and `Submission_groupId_createdAt_idx`.
- Query-plan checker probes the student submission list path.

Remaining cleanup:

- Validate index usage against seeded data.

### PERF-FINDING-002: active teacher submission list no longer uses unbounded task pre-query

Status: Mitigated on active service path and legacy repository helper  
Severity: High  
Affected active method: `SubmissionsService.teacherList`

Evidence:

- `backend/src/submissions/submissions.service.ts` uses relational filtering through `task.subject.teacherId` and bounded Prisma query with `take: 100`.
- `backend/src/repositories/submission.repository.ts::listTeacherSubmissions` now uses relational teacher filtering, clamps `take`/`skip`, and no longer preloads all teacher task IDs.
- `backend/test/security/teacher-export-scope.spec.ts` asserts bounded teacher list DB query behavior.
- `backend/test/security/submission-service-static-bounds.spec.ts` asserts the legacy task-ID pre-query does not return.
- Index migration adds task, subject, submission, enrollment, section, and group-member support indexes.
- Query-plan checker probes teacher-owned subject submission listing.

Remaining cleanup:

- Validate query plans against 1k/20k/50k seeded tiers.

### PERF-FINDING-003: active teacher export is now database-bounded

Status: Mitigated on active service path  
Severity: High  
Affected active method: `SubmissionsService.teacherExport`

Evidence:

- `backend/src/submissions/submissions.service.ts` queries `MAX_TEACHER_EXPORT_ROWS + 1` rows to detect truncation.
- Export returns up to 1000 rows with `truncated` and `maxRows` metadata.
- `backend/test/security/teacher-export-scope.spec.ts` asserts bounded teacher export DB query behavior and verifies the legacy repository list method is not used.

Remaining cleanup:

- Replace service-layer export cap with queued/streaming exports if school-scale UX requires large full exports.

### PERF-FINDING-004: dashboard summary paths are database-count based

Status: Mitigated pending test evidence  
Severity: High  
Affected active methods: `DashboardService.studentSummary`, `DashboardService.studentCharts`, `DashboardService.upcomingDeadlines`, `DashboardService.teacherSummary`, `DashboardService.adminSummary`, `DashboardService.adminActivity`

Evidence:

- `backend/src/dashboard/dashboard.service.ts` now uses Prisma `count()` queries for student, teacher, and admin summary counts.
- `backend/src/dashboard/dashboard.service.ts` caps upcoming deadlines with `take: DASHBOARD_DEADLINE_LIMIT`.
- `backend/src/dashboard/dashboard.service.ts` caps admin audit activity at the repository query layer with `DASHBOARD_ACTIVITY_LIMIT`.
- `backend/test/security/dashboard-static-bounds.spec.ts` blocks regressions to repository list helpers for dashboard summaries and blocks fetch-then-slice audit activity.

Remaining cleanup:

- Record `npm --prefix backend run test:security` evidence after this change.
- Validate representative dashboard query plans against seeded data.

### PERF-FINDING-005: user and audit-log repository list helpers are bounded

Status: Mitigated pending test evidence  
Severity: High  
Affected methods: `UserRepository.listAll`, `UserRepository.listByRole`, `UserRepository.listStudents`, `AuditLogRepository.listAuditLogs`

Evidence:

- `backend/src/repositories/user.repository.ts` clamps `take` and `skip` with a hard maximum of 500 rows.
- `backend/src/repositories/audit-log.repository.ts` clamps `take` and `skip` with a hard maximum of 500 rows.
- `backend/test/security/repository-list-bounds.spec.ts` asserts user and audit repository list bounds.

Remaining cleanup:

- Record `npm --prefix backend run test:security` evidence after this change.

### PERF-FINDING-006: subject repository list helpers are bounded

Status: Mitigated pending test evidence  
Severity: High  
Affected methods: `SubjectRepository.listSubjects`, `SubjectRepository.listActivitiesBySubject`, `SubjectRepository.listGroupsBySubject`, `SubjectRepository.listSubjectsForStudent`, `SubjectRepository.listSubjectsForTeacher`

Evidence:

- `backend/src/repositories/subject.repository.ts` clamps `take` and `skip` with hard maximums of 500 rows for subject, activity, and group list helpers.
- `backend/src/repositories/subject.repository.ts` uses `_count` for activity submissions instead of loading full submission arrays.
- `backend/test/security/repository-list-bounds.spec.ts` asserts subject repository list bounds and blocks full submission array loading for subject activity listing.

Remaining cleanup:

- Record `npm --prefix backend run test:security` evidence after this change.
- Validate representative subject/activity/group query plans against seeded data.

### PERF-FINDING-007: notification feed list helper is bounded

Status: Mitigated pending test evidence  
Severity: High  
Affected method: `NotificationRepository.listForUser`

Evidence:

- `backend/src/repositories/notification.repository.ts` clamps `take` and `skip` with a hard maximum of 200 rows and a default of 50 rows.
- `backend/test/security/repository-list-bounds.spec.ts` asserts notification feed repository list bounds.

Remaining cleanup:

- Record `npm --prefix backend run test:security` evidence after this change.
- Review notification route/controller query parameters if feed pagination is exposed to the frontend.

### PERF-FINDING-008: file metadata and storage object listing are bounded

Status: Mitigated pending test evidence  
Severity: High  
Affected methods: `FilesService.list`, `FilesService.listLocalObjects`, `FilesService.listS3Objects`

Evidence:

- `backend/src/files/files.service.ts` clamps file metadata `take` and `skip` with a hard maximum of 500 rows and a default of 100 rows.
- `backend/src/files/files.service.ts` caps admin local storage directory walking.
- `backend/src/files/files.service.ts` caps S3 listing with `MaxKeys` and stops pagination when the cap is reached.
- `backend/test/security/file-list-bounds.spec.ts` asserts file metadata, local storage, S3 object listing, and final response caps.

Remaining cleanup:

- Record `npm --prefix backend run test:security` evidence after this change.
- Validate file metadata and storage listing behavior against seeded/large-file datasets.

## School-scale registered-user acceptance requirements

### Tier 1 baseline

- [ ] `School Scale Validation` workflow passes for tier `1k`.
- [ ] Result is recorded in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- [ ] 300 VU target run is recorded.
- [ ] 500 VU stretch run is recorded.
- [ ] 1000 VU capacity exploration is recorded before any 1000-concurrent-user claim.

### Tier 2 school-scale

- [ ] `School Scale Validation` workflow passes for tier `20k`.
- [ ] Result is recorded in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- [ ] Query-plan checker result is recorded against the 20k tier.
- [ ] Database connection and memory trends are recorded.

### Tier 3 upper school-scale

- [ ] `School Scale Validation` workflow passes for tier `50k`.
- [ ] Result is recorded in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- [ ] 50k seed completion time and resource usage are recorded.
- [ ] Query-plan checker result is recorded against the 50k tier.
- [ ] Load-test evidence is recorded against the 50k dataset.
- [ ] Any architecture bottlenecks are documented with mitigation or rejection of the claim.

## Executable regression evidence

Current security/performance tests include:

- `backend/test/security/performance-bounds.spec.ts`
- `backend/test/security/teacher-export-scope.spec.ts`
- `backend/test/security/submission-list-response-bounds.spec.ts`
- `backend/test/security/submission-service-static-bounds.spec.ts`
- `backend/test/security/dashboard-static-bounds.spec.ts`
- `backend/test/security/repository-list-bounds.spec.ts`
- `backend/test/security/file-list-bounds.spec.ts`

Active service-path tests prove bounded DB reads for student list, teacher list, and teacher export. Static bounds tests assert active paths do not route through legacy list helpers, legacy/user/audit/subject/notification repository list helpers remain hard bounded, dashboard summaries/activity do not regress to full-array counting or fetch-then-slice behavior, subject activity listing does not load full submission arrays, and file metadata/storage listing remains bounded.

## Required performance checks

### Database/query checks

- [x] Student submission active list path uses database-level bound.
- [x] Teacher submission active list path uses database-level bound.
- [x] Teacher export active path is scoped and database-bounded.
- [x] Initial school-scale index migration exists.
- [x] Query-plan checker exists.
- [x] Manual school-scale validation workflow exists.
- [x] Legacy repository list methods are bounded.
- [x] User repository list methods are bounded.
- [x] Audit-log repository list methods are bounded.
- [x] Subject repository list methods are bounded.
- [x] Notification feed list method is bounded.
- [x] File metadata listing is bounded.
- [x] Dashboard queries are bounded.
- [ ] Tiered workflow results are recorded.
- [ ] Dashboard query plans are validated against seeded data.
- [ ] Subject/activity/group query plans are validated against seeded data.
- [ ] Notification feed query plan is validated against seeded data.
- [ ] File metadata/storage listing is validated against large datasets.
- [ ] Search/filter routes have allowlisted fields.
- [ ] No database queries inside large loops without batching or documented bounds.
- [ ] Common filters have supporting indexes or explicit acceptance.

### API behavior checks

- [x] Student submission list API response is capped.
- [x] Teacher submission list API response is capped.
- [x] Teacher export response is capped and reports truncation.
- [x] Notification feed response is capped at repository layer.
- [x] File listing response is capped.
- [ ] External provider calls have timeouts.
- [ ] Expensive routes have rate limits or queueing.
- [ ] File upload limits are enforced.
- [ ] File download/signing does not trigger unbounded database work.
- [ ] Health endpoints are cheap and dependency-appropriate.

### Load checks

- [ ] Smoke load run completed.
- [ ] Baseline 50-user run completed.
- [ ] Target 300-user run completed.
- [ ] Stretch 500-user run attempted and documented.
- [ ] 1000-user capacity exploration attempted and documented if claiming 1000 concurrent users.
- [ ] 2000-user school-scale exploration attempted only after 1000 VU passes.
- [ ] Soak run completed or explicitly deferred with owner/date.
- [ ] p95/error/memory/database-connection results recorded.

## Initial thresholds

| Metric | Gate |
|---|---|
| HTTP error rate | < 1% excluding expected negative tests |
| p95 read route latency | < 800 ms |
| p95 write route latency | < 1500 ms |
| p95 accepted upload latency | < 5000 ms |
| p95 bounded export response/start | < 5000 ms |
| Memory during soak | No unbounded growth |
| Database connection usage | Below pool limit with headroom |
| Worker retries | No retry storm |

## Fail conditions

`PERF-GATE` fails if:

- Issue #35 or #36 has no recorded capacity evidence for the claimed tier.
- Any critical active service path has unbounded database list queries.
- Any high-volume route performs database queries inside unbounded loops.
- Teacher/admin exports are unbounded at the active database path.
- Expensive routes have no rate limit, bound, timeout, or queue.
- School-scale workflow results are missing for the claimed tier.
- Load tests are not run but capacity claims are made.
- Load tests fail thresholds without documented mitigation.

## Current blockers

1. Tier 1 school-scale validation workflow result is not recorded.
2. Tier 2 school-scale validation workflow result is not recorded.
3. Tier 3 school-scale validation workflow result is not recorded.
4. Security/performance test evidence is not recorded after repository/dashboard/file bounds cleanup.
5. Broader query audit is incomplete.
6. No 300-user, 500-user, 1000-user, or 2000-user evidence exists.
7. No database connection/memory trend is recorded.
8. Large teacher/admin export UX still needs queued/streaming strategy if full exports above 1000 rows are required.
9. Dashboard query-plan validation against seeded data remains open.
10. Subject/activity/group query-plan validation against seeded data remains open.
11. Notification feed query-plan validation against seeded data remains open.
12. File metadata/storage listing validation against large datasets remains open.

## Current acceptance decision

Not accepted. High-volume submission list/export active service paths are database-bounded, legacy/user/audit/subject/notification repository list helpers are bounded, file metadata/storage listing is bounded, dashboard summaries/activity are count-based and bounded, indexes exist, query-plan validation is executable, and a manual school-scale workflow exists. School-scale claims remain blocked until tiered workflow results and load-test evidence are recorded.
