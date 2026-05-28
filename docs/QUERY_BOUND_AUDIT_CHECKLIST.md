# Query Bound Audit Checklist

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This checklist tracks database-query risks that matter for school-scale data volume. It complements `docs/PERFORMANCE_ACCEPTANCE_GATE.md` and must be completed before 20k-50k registered-user support is claimed.

## Audit rule

A route is not scale-reviewed until it has:

- explicit owner/scope filtering,
- backend-enforced bounds or documented small cardinality,
- deterministic ordering for paginated lists,
- supporting indexes or accepted query-plan evidence,
- tests or a documented reason tests are not feasible.

## High-volume route checklist

| Area | Risk | Status | Required evidence |
|---|---|---|---|
| Student submission list | Unbounded owner list | Mitigated active path | Bounded Prisma query, test, query-plan evidence |
| Teacher submission list | Unbounded teacher-scoped queue | Mitigated active path | Bounded Prisma query, test, query-plan evidence |
| Teacher export | Large scoped export | Mitigated active path | 1000-row cap, truncation metadata, test |
| Admin report exports | Large report generation | Open | Bound/cap/queue/stream, tests |
| Dashboard summaries | Many aggregate queries | Open | Query audit and indexes |
| Notifications list | Large user notification history | Open | Pagination/bounds, index evidence |
| File download/signing | Per-file auth queries | Open | Bounded lookup and owner/scope tests |
| Search/filter routes | Broad scans/sort abuse | Open | Allowlisted filters/sorts and indexes |
| Group membership queries | Large group/subject membership | Open | Index evidence and bounded includes |
| Audit log views | Large chronological logs | Open | Pagination and actor/module/time indexes |
| Health checks | Dependency-heavy checks | Partially reviewed | Cheap live check, bounded ready check |
| Webhook handlers | Retry storms / duplicate work | Partially reviewed | Idempotency, timeout, bounded side effects |

## Repository helper risks

Legacy submission repository list helpers still need cleanup:

- `SubmissionRepository.listSubmissions`
- `SubmissionRepository.listStudentSubmissions`
- `SubmissionRepository.listTeacherSubmissions`

Active service paths avoid these helpers, but the helpers should be bounded or removed in a future cleanup.

## Export strategy decision needed

Teacher export is currently capped at 1000 rows. For school-scale use, decide one:

1. Keep hard cap and require UI filtering.
2. Add queued export job with async download.
3. Add streaming export with strict rate limits and audit logging.

Do not remove the cap without replacing it with queueing or streaming.

## Query-plan validation

Use:

```bash
npm --prefix backend run check:query-plans
```

Record output in:

- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`

## Current blockers

1. Admin/report export bounds are not reviewed.
2. Dashboard aggregate query bounds are not reviewed.
3. Notification list bounds are not reviewed.
4. File download/signing query bounds are not reviewed.
5. Search/filter allowlists are not reviewed.
6. Legacy repository helpers are not cleaned up.
7. Query-plan results are not recorded against seeded data.
