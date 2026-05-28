# ADR: Submission List Bounds and Legacy Repository Helpers

Date: 2026-05-14  
Status: Accepted for active service path; cleanup still required

## Context

ProjTrack is being hardened toward school-scale registered-user targets. Submission list and teacher export paths are high-volume paths. Earlier implementation routed student lists, teacher lists, and teacher exports through repository helper methods that could fetch unbounded result sets before service-layer filtering or response shaping.

For 20k-50k registered-user readiness, response caps are not enough. The database query itself must be bounded.

## Decision

The active service paths now use bounded Prisma queries directly in `SubmissionsService`:

- `studentList` uses a bounded query with `take: 100`.
- `teacherList` uses a bounded query with `take: 100`.
- `teacherExport` uses a bounded query with `take: 1001`, returns at most 1000 rows, and reports truncation.
- Teacher list/export filtering uses relational teacher-owned subject filtering instead of an unbounded task-ID pre-query.

Regression tests assert these active service paths do not call the legacy repository list helpers.

## Legacy helper status

The following repository helpers are legacy risk points:

- `SubmissionRepository.listStudentSubmissions`
- `SubmissionRepository.listTeacherSubmissions`
- `SubmissionRepository.listSubmissions`

They should be bounded, removed, or marked private/unusable in a future cleanup. They are not the active path for current student/teacher list/export flows.

## Why not fully clean the repository now?

The GitHub connector available in this environment only supports whole-file replacement for this file. Multiple attempts to replace the repository file were blocked by the connector safety layer. The accepted mitigation was to move active high-volume reads to bounded service-level Prisma queries and add regression tests preventing the service from returning to the legacy helpers.

## Consequences

Positive:

- Active high-volume submission paths are database-bounded.
- Teacher export has a hard cap and truncation metadata.
- Regression tests protect active service paths.
- School-scale query-plan checks can target representative active queries.

Negative:

- Legacy repository helper methods still exist.
- Future developers could accidentally reuse them if tests/docs are ignored.
- A future cleanup should make the repository helpers bounded or delete them.

## Required follow-up

1. Make legacy repository list helpers accept explicit `take`/`skip` bounds, or remove them.
2. Add static/lint guard if feasible to prevent active service paths from calling unbounded helpers.
3. Run `npm --prefix backend run test:security` and record results.
4. Run school-scale validation workflow and record results.
5. Validate indexes/query plans against seeded 1k/20k/50k tiers.

## Claim impact

This ADR does not prove school-scale readiness. It only documents the architectural mitigation for active submission list/export paths. School-scale support remains blocked until validation and load evidence are recorded.
