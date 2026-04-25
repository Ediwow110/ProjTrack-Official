# Phase 3 — Submission lifecycle spec

## Canonical statuses
- Draft
- Open
- Submitted
- Reviewed
- Graded
- Late
- Needs Revision
- Reopened

## Student edit rules
Students may edit or resubmit only when the canonical status is Draft, Open, Needs Revision, or Reopened.

## Teacher review transitions
- Submitted -> Reviewed, Graded, Needs Revision
- Late -> Reviewed, Graded, Needs Revision
- Reviewed -> Graded, Needs Revision, Reopened
- Graded -> Reopened
- Needs Revision -> Submitted, Late, Reopened
- Reopened -> Submitted, Late, Reviewed, Graded, Needs Revision

## Backend rule
The backend must reject invalid state transitions and reject grading without a numeric grade.
