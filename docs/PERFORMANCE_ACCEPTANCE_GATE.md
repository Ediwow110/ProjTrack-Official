# Performance Acceptance Gate

Branch: `2nd-main`  
Last updated: 2026-05-14

## Gate verdict

Not passed.

This gate defines the minimum performance and scalability evidence required before production-readiness, 300-500 concurrent-user claims, 1000+ concurrent-user claims, or 20k-50k registered-user school-scale claims are made.

## Capacity tracking

- Issue #34 tracks the bounded submission list/export blocker.
- Issue #35 tracks the 1000+ capacity evidence gate.
- Issue #36 tracks the 20k-50k registered-user school-scale gate.

Required distinction:

- 20k-50k registered users requires synthetic data, bounded queries, indexes, and data-volume evidence.
- 1000+ concurrent users requires load-test evidence, database connection headroom, memory stability, and slow-query review.
- 20k-50k concurrent users is not currently claimed and would require a separate architecture program.

## Required command evidence

```bash
grep -R "findMany({\|findMany()" backend/src
grep -R "for .*await\|forEach(async\|map(async" backend/src
npm --prefix backend run prisma:validate
npm --prefix backend run build
npm --prefix backend run test:security
```

## Required documents

- [x] `docs/CODE_AUDIT.md`
- [x] `docs/LOAD_TEST_PLAN.md`
- [x] `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- [x] Initial query audit findings recorded in this document
- [ ] Load test results recorded in `docs/LOAD_TEST_PLAN.md` or a dedicated results document

## Initial query audit findings

### PERF-FINDING-001: student submission list is unbounded

Status: Open  
Severity: High  
Affected file: `backend/src/repositories/submission.repository.ts`  
Affected method: `listStudentSubmissions`

Risk: student submission list can return every matching submission and relation graph without pagination.

Required fix:

- Add bounded pagination contract.
- Add maximum page size.
- Keep ownership filter.
- Add regression test requiring `take`/limit behavior.

### PERF-FINDING-002: teacher submission task pre-query is unbounded

Status: Open  
Severity: High  
Affected file: `backend/src/repositories/submission.repository.ts`  
Affected method: `listTeacherSubmissions`

Risk: the method fetches all task IDs for a teacher before querying submissions. Large teachers/classes can produce a large `IN (...)` query and memory pressure.

Required fix:

- Avoid unbounded task ID pre-fetch where possible.
- Prefer relational filtering directly in the submission query or bounded pagination.
- Review supporting indexes.

### PERF-FINDING-003: teacher submission list/export path is unbounded

Status: Open  
Severity: High  
Affected file: `backend/src/repositories/submission.repository.ts`  
Affected method: `listTeacherSubmissions`  
Related path: `teacherExport`

Risk: teacher submissions and exports are scoped, but not bounded. Scoped does not mean scalable.

Required fix:

- Add page/limit for normal list routes.
- Add explicit export cap, queue, or streaming strategy for exports.
- Add tests for max export bounds.

## School-scale registered-user acceptance requirements

### Tier 1 baseline

- [ ] Synthetic dataset has at least 1,000 registered student users.
- [ ] 300 VU target run is recorded.
- [ ] 500 VU stretch run is recorded.
- [ ] 1000 VU capacity exploration is recorded before any 1000-concurrent-user claim.

### Tier 2 school-scale

- [ ] Synthetic dataset has at least 20,000 registered student users.
- [ ] Matching teacher/admin/section/subject/submission/file/notification volume exists.
- [ ] All high-volume list routes are bounded.
- [ ] Submission list/export blocker #34 is resolved.
- [ ] Slow-query/index evidence is recorded.
- [ ] Database connection and memory trends are recorded.

### Tier 3 upper school-scale

- [ ] Synthetic dataset has at least 50,000 registered student users.
- [ ] Matching teacher/admin/section/subject/submission/file/notification volume exists.
- [ ] 50k seed completion time and resource usage are recorded.
- [ ] Load-test evidence is recorded against the 50k dataset.
- [ ] Any architecture bottlenecks are documented with mitigation or rejection of the claim.

## Executable regression evidence

The following test file documents current open blockers:

- `backend/test/security/performance-bounds.spec.ts`

These tests are not a pass for `PERF-GATE`; they intentionally capture current unbounded behavior so it cannot be ignored.

## Required performance checks

### Database/query checks

- [ ] No unbounded user-facing `findMany()` list routes.
- [ ] List routes use pagination or bounded limits.
- [ ] Teacher/admin exports are scoped and bounded.
- [ ] Dashboard queries are bounded and indexed.
- [ ] Search/filter routes have allowlisted fields.
- [ ] No database queries inside large loops without batching or documented bounds.
- [ ] Common filters have supporting indexes or explicit acceptance.

### API behavior checks

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

- Issue #34 remains unresolved.
- Issue #35 or #36 has no recorded capacity evidence for the claimed tier.
- Any critical route has unbounded list queries.
- Any high-volume route performs database queries inside unbounded loops.
- Teacher/admin exports are unbounded.
- Expensive routes have no rate limit, bound, timeout, or queue.
- Load tests are not run but capacity claims are made.
- Load tests fail thresholds without documented mitigation.

## Current blockers

1. Student submission list needs pagination.
2. Teacher task pre-query needs redesign or bounds.
3. Teacher submission list/export path needs pagination/export cap/queue/streaming plan.
4. Broader query audit is incomplete.
5. No 300-user, 500-user, 1000-user, or 2000-user evidence exists.
6. No slow-query/index review is recorded.
7. No database connection/memory trend is recorded.
8. Synthetic load seeder exists but has no recorded 1k, 20k, or 50k run evidence.

## Current acceptance decision

Not accepted. Performance/readiness claims must remain conservative until query audit, bounded list fixes, synthetic 20k/50k data evidence, and load-test evidence exist.
