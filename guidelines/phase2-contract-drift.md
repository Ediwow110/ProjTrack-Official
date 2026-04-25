# Phase 2 — Contract drift list

## Stabilized fields
- ids: prefer `id`, `subjectId`, `activityId`, `submissionId` only
- dates: UI labels should come from shared date normalization helpers
- statuses: use shared submission status normalization helpers
- notification types: use shared normalization instead of page-level coercion

## Remaining drift
- several service mappers still infer subject labels from ids when backend names are absent
- some calendar and admin records still depend on page-local shape assumptions
- mail/report/admin tool payloads are not yet normalized through a shared model layer
