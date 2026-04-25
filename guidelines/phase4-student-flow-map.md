# Phase 4 — Student flow map

## Routing keys
Use `subjectId`, `activityId`, and `submissionId` as the active routing and workflow identifiers.

## Entry paths
- Dashboard deadline row -> submission detail when finalized, submit form when editable/open
- Calendar CTA -> submission detail when finalized, submit form otherwise
- Subject activities table -> submit form or submission detail based on canonical submission status
- Submission detail continue-edit -> submit form with submissionId, activityId, subjectId
- My submissions row -> submission detail only by submission id

## Removed drift
- title-based activity matching from active submit/detail flows
- title-based query fallback in my submissions and submission detail
