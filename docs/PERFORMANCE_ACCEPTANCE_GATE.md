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
- Issue #44 tracks subject/submission route-boundary pagination and seeded query-plan safety.
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
- Teacher students controller now exposes bounded `take`/`skip` response pagination with default `take = 100` and max `take = 500`.
- Teacher sections controller now exposes bounded `take`/`skip` response pagination with default `take = 100` and max `take = 500`.
- Notification feed repository list helper now enforces default/hard caps and skip bounds.
- Notification feed controller and service now pass explicit bounded `take`/`skip` pagination to the repository.
- File metadata listing now enforces default/hard caps and skip bounds.
- File listing controller now passes explicit bounded `take`/`skip` pagination to the service.
- Admin storage object listing now caps local directory walks and S3 pagination.
- Subject activity reads use submission counts instead of loading full submission arrays.
- Dashboard summary paths now use database `count()` queries instead of loading subject/submission/user arrays into application memory.
- Dashboard upcoming-deadline path is capped with `DASHBOARD_DEADLINE_LIMIT = 50`.
- Dashboard audit-activity path now requests only `DASHBOARD_ACTIVITY_LIMIT = 10` rows at the repository/database layer.
- Static regression tests assert active service paths do not call legacy list helpers, assert legacy/user/audit/subject/notification helpers remain bounded, block file metadata/storage listing regressions, guard API pagination boundaries, and block dashboard summary/activity regressions.
- Additive school-scale index migration exists at `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`.
- Query-plan checker exists at `backend/scripts/check-school-scale-query-plans.cjs` and is wired as `npm --prefix backend run check:query-plans`.
- Manual school-scale validation workflow exists at `.github/workflows/school-scale-validation.yml`.
- Validation result template exists at `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.

Still open:

- Security/performance test run evidence is not recorded after the repository/dashboard/file bounds cleanup.
- Issue #44 route-boundary and query-plan evidence is not recorded.
- `SubjectsService.teacherStudents` is controller-level response-capped but still requires DB-level cap/query-plan evidence because it aggregates enrollments in memory and performs a submission progress `findMany` without an explicit `take` before slicing.
- `SubjectsService.teacherSections` is controller-level response-capped but still requires DB-level cap/query-plan evidence because the service performs direct `section.findMany` with included students/enrollments before slicing.
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
- [x] Teacher students controller response pagination guarded
- [x] Teacher sections controller response pagination guarded
- [x] Notification feed repository list helper bounded
- [x] Notification feed API pagination boundary guarded
- [x] File metadata and storage object listing bounded
- [x] File listing API pagination boundary guarded
- [x] Dashboard summary/deadline/activity paths bounded
- [ ] Issue #44 route-boundary review recorded
- [ ] Issue #44 subject/submission seeded query-plan evidence recorded
- [ ] Tier 1 workflow result recorded
- [ ] Tier 2 workflow result recorded
- [ ] Tier 3 workflow result recorded
- [ ] Load test results recorded in `docs/LOAD_TEST_RESULTS.md`

## Query audit findings

### PERF-FINDING-009: subject/submission route-boundary and query-plan safety remains open

Status: Open / tracked by issue #44  
Severity: Critical for 20k-50k registered-user claims  
Affected areas: subject list/detail/catalog/calendar endpoints, teacher student/section/master-list endpoints, student/teacher submission list endpoints

Evidence required:

- Route-boundary review showing which endpoints expose `take`/`skip`, which intentionally use fixed defaults, and why.
- `npm --prefix backend run test:security` evidence after route-boundary changes.
- Seeded query-plan validation for subject, submission, section, calendar, and teacher-student list paths.
- Documentation of any endpoint that remains default-only, including the maximum bound and rationale.

Current highest-risk unresolved paths:

- `SubjectsService.teacherStudents`: teacher students route is controller-level response-capped but still requires DB-level cap/query-plan evidence because the service aggregates enrollments in memory and performs a submission progress `findMany` without explicit `take` before slicing.
- `SubjectsService.teacherSections`: controller-level response-capped but still requires DB-level cap/query-plan evidence because the service performs direct `section.findMany` with included students/enrollments before slicing.

Remaining cleanup:

- Resolve issue #44 before any 20k-50k registered-user claim.
- Add DB-level cap/query-plan evidence for `teacherStudents` before treating it as fully mitigated.
- Add DB-level cap/query-plan evidence for `teacherSections` before treating it as fully mitigated.

## Executable regression evidence

Current security/performance tests include:

- `backend/test/security/performance-bounds.spec.ts`
- `backend/test/security/teacher-export-scope.spec.ts`
- `backend/test/security/submission-list-response-bounds.spec.ts`
- `backend/test/security/submission-service-static-bounds.spec.ts`
- `backend/test/security/dashboard-static-bounds.spec.ts`
- `backend/test/security/repository-list-bounds.spec.ts`
- `backend/test/security/file-list-bounds.spec.ts`
- `backend/test/security/route-boundary-evidence.spec.ts`

Active service-path tests prove bounded DB reads for student list, teacher list, and teacher export. Static bounds tests assert active paths do not route through legacy list helpers, legacy/user/audit/subject/notification repository list helpers remain hard bounded, notification and file-list API pagination boundaries remain explicit, dashboard summaries/activity do not regress to full-array counting or fetch-then-slice behavior, subject activity listing does not load full submission arrays, file metadata/storage listing remains bounded, and issue #44 high-risk route-boundary evidence stays visible.

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
- [x] Teacher students route response pagination is controller-bounded.
- [x] Teacher sections route response pagination is controller-bounded.
- [x] Notification feed list method is bounded.
- [x] File metadata listing is bounded.
- [x] Dashboard queries are bounded.
- [ ] Issue #44 route-boundary and query-plan evidence is recorded.
- [ ] `SubjectsService.teacherStudents` has DB-level cap/query-plan evidence recorded.
- [ ] `SubjectsService.teacherSections` has DB-level cap/query-plan evidence recorded.
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
- [x] Teacher students API response is capped with bounded `take`/`skip` parsing.
- [x] Teacher sections API response is capped with bounded `take`/`skip` parsing.
- [x] Notification feed response is capped at repository layer.
- [x] Notification feed API pagination boundary is explicit.
- [x] File listing response is capped.
- [x] File listing API pagination boundary is explicit.
- [ ] Subject/submission route-boundary review is recorded in issue #44.
- [ ] External provider calls have timeouts.
- [ ] Expensive routes have rate limits or queueing.
- [ ] File upload limits are enforced.
- [ ] File download/signing does not trigger unbounded database work.
- [ ] Health endpoints are cheap and dependency-appropriate.

## Fail conditions

`PERF-GATE` fails if:

- Issue #35 or #36 has no recorded capacity evidence for the claimed tier.
- Issue #44 is unresolved for a 20k-50k registered-user claim.
- `SubjectsService.teacherStudents` lacks DB-level cap/query-plan evidence for a school-scale claim.
- `SubjectsService.teacherSections` lacks DB-level cap/query-plan evidence for a school-scale claim.
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
5. Issue #44 route-boundary/query-plan evidence is not recorded.
6. `SubjectsService.teacherStudents` has route response pagination but still needs DB-level cap/query-plan evidence.
7. `SubjectsService.teacherSections` has route response pagination but still needs DB-level cap/query-plan evidence.
8. Broader query audit is incomplete.
9. No 300-user, 500-user, 1000-user, or 2000-user evidence exists.
10. No database connection/memory trend is recorded.
11. Large teacher/admin export UX still needs queued/streaming strategy if full exports above 1000 rows are required.
12. Dashboard query-plan validation against seeded data remains open.
13. Subject/activity/group query-plan validation against seeded data remains open.
14. Notification feed query-plan validation against seeded data remains open.
15. File metadata/storage listing validation against large datasets remains open.

## Current acceptance decision

Not accepted. High-volume submission list/export active service paths are database-bounded, teacher students and teacher sections route responses are capped, legacy/user/audit/subject/notification repository list helpers are bounded, notification and file listing API pagination boundaries are explicit, file metadata/storage listing is bounded, dashboard summaries/activity are count-based and bounded, indexes exist, query-plan validation is executable, and a manual school-scale workflow exists. School-scale claims remain blocked until tiered workflow results, load-test evidence, issue #44 route-boundary/query-plan evidence, and DB-level cap/query-plan evidence for `teacherStudents` and `teacherSections` are recorded.
