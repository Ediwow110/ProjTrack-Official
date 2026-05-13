# Performance Acceptance Gate

Branch: `2nd-main`  
Last updated: 2026-05-14

## Gate verdict

Not passed.

This gate defines the minimum performance and scalability evidence required before production-readiness or 300-500 online-user claims are made.

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
- [ ] Query audit results recorded in this document
- [ ] Load test results recorded in `docs/LOAD_TEST_PLAN.md` or a dedicated results document

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

- Any critical route has unbounded list queries.
- Any high-volume route performs database queries inside unbounded loops.
- Teacher/admin exports are unbounded.
- Expensive routes have no rate limit, bound, timeout, or queue.
- Load tests are not run but capacity claims are made.
- Load tests fail thresholds without documented mitigation.

## Required result entry template

```text
Date:
Commit SHA:
Command:
Environment:
Finding:
Severity:
Affected files/routes:
Fix or mitigation:
Owner:
Status:
```

## Current blockers

1. Query audit command results are not recorded.
2. Unbounded query review is incomplete.
3. No load scripts exist.
4. No 300-user or 500-user evidence exists.
5. No slow-query/index review is recorded.
6. No database connection/memory trend is recorded.

## Current acceptance decision

Not accepted. Performance/readiness claims must remain conservative until query audit and load-test evidence exist.
