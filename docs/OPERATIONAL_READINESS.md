# Operational Readiness

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

Not operationally ready for production or school-scale claims.

The branch has important operational foundations, but live evidence and drills are still missing.

## Implemented foundations

- Request context with request IDs exists.
- Health checks are present.
- Runtime safety checks are strong.
- Production-check failure issue creation exists in `.github/workflows/production-checks.yml`.
- School-scale and load-validation workflows exist.
- Evidence ledgers exist for school-scale validation and load results.

## Required operational evidence

| Area | Required evidence | Status |
|---|---|---|
| CI health | Latest `ci.yml` run URL and result | Not recorded |
| Production checks | Latest `production-checks.yml` run URL and result | Not recorded |
| Failure escalation | Confirm failed production gate creates/updates GitHub issue | Not live-verified |
| School-scale validation | Tier `1k` workflow result | Not recorded |
| Load validation | Smoke load result | Not recorded |
| Security gate | `test:security`, secret scan, audit results | Not recorded |
| Migration deployment | `prisma:migrate:deploy` result | Not recorded |
| Query-plan check | `check:query-plans` result on seeded data | Not recorded |
| Backup/restore | Backup-restore drill result | Not recorded |
| Incident response | Incident tabletop/drill result | Not recorded |

## Incident drill checklist

Run at least one tabletop or controlled drill before production readiness is claimed.

Required scenarios:

- [ ] Production-check failure triage.
- [ ] Suspected secret leak.
- [ ] Database migration failure.
- [ ] File/object-storage outage.
- [ ] Mail/provider outage.
- [ ] Elevated 5xx/error-rate incident.
- [ ] Slow query or database saturation incident.
- [ ] Backup restore verification.

Each drill must record:

```text
Date:
Scenario:
Facilitator:
Participants:
Systems involved:
Detection path:
Escalation path:
Actions taken:
Time to identify:
Time to mitigate:
Gaps found:
Follow-up issues:
Owner:
```

## Monitoring and alerting requirements

Before production readiness:

- [ ] API error-rate alert exists.
- [ ] API latency alert exists.
- [ ] Database connection saturation alert exists.
- [ ] Database CPU/storage alert exists.
- [ ] Worker failure/retry alert exists.
- [ ] File upload/storage failure alert exists.
- [ ] Mail queue/provider failure alert exists.
- [ ] Production-check failure issue path is live-verified.

## Logging requirements

- [x] Request ID context exists.
- [ ] Correlation/request ID appears consistently in application logs.
- [ ] Representative incident logs are easy to trace by request ID.
- [ ] Sensitive values are redacted from logs.
- [ ] Failed auth/authorization events are auditable without leaking secrets.

## School-scale operations requirements

Before any 20k-50k registered-user claim:

- [ ] `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` contains passing tier evidence.
- [ ] `docs/LOAD_TEST_RESULTS.md` contains load evidence for the claimed runtime behavior.
- [ ] Database connection and memory trends are recorded.
- [ ] Query-plan warnings are resolved or risk-accepted.
- [ ] Export strategy is accepted: hard cap, queue, or streaming.
- [ ] Object storage mode is production-appropriate.
- [ ] Backup/restore procedure is verified.

## Current blockers

1. No latest CI run evidence is recorded.
2. No production-check run evidence is recorded.
3. Production-check failure issue creation is implemented but not live-verified.
4. No incident drill evidence is recorded.
5. No backup-restore drill evidence is recorded.
6. No school-scale validation evidence is recorded.
7. No load-validation evidence is recorded.
8. Correlation ID logging still needs verification.

## Next improvement

Add or verify correlation ID logging end-to-end, then run and record the production-check workflow and incident drill evidence.
