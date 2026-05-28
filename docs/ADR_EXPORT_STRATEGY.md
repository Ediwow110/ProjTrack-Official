# ADR: Export Strategy for School-Scale Data

Date: 2026-05-14  
Status: Proposed

## Context

Teacher/admin exports can become expensive at school-scale data volume. A synchronous unlimited export can create large database reads, high memory use, slow responses, and denial-of-service risk.

Current teacher export behavior is intentionally capped:

- database query requests at most 1001 rows,
- response returns at most 1000 rows,
- response includes truncation metadata.

## Decision options

### Option A: Keep hard cap

Keep exports capped at 1000 rows and require users to filter more narrowly.

Pros:

- Simple.
- Predictable memory and database impact.
- Already implemented for teacher export active path.

Cons:

- Not suitable for full school-wide exports.
- Users may need multiple filtered exports.

### Option B: Queued export job

Large exports are requested asynchronously. A worker generates the file and stores it for later download.

Pros:

- Best fit for large exports.
- Can rate-limit and audit export generation.
- Avoids long synchronous HTTP requests.

Cons:

- Requires job queue, status tracking, storage, expiry, and notification UX.

### Option C: Streaming export

Server streams CSV rows with strict query bounds and backpressure.

Pros:

- Better UX than waiting for a job in some cases.
- Lower memory than building full result in RAM.

Cons:

- Still ties up request lifecycle.
- Harder to retry and audit.
- Needs careful timeout/rate-limit design.

## Current recommendation

Keep Option A for current branch. Do not remove the cap until Option B or C is implemented with tests, audit logging, and operational controls.

For school-scale production use, prefer Option B for full exports.

## Required controls for any large export

- Authorization and scope checks.
- Audit log entry.
- Hard maximum export size or async job policy.
- Rate limits.
- Query bounds or streaming cursor.
- Filename and storage safety.
- Expiry for generated files.
- Operational monitoring.

## Claim impact

The current cap is a safety control, not a feature-complete large-export solution. Do not claim unrestricted school-scale export support until queued or streaming exports are implemented and validated.
