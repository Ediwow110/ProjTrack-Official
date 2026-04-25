# Request User Propagation Progress

This batch pushes the authenticated request user further into the backend flow.

## Added
- guarded controllers now read `req.user.sub` from the bearer token payload
- student routes now pass the authenticated student ID into:
  - dashboard
  - subjects
  - submission context
  - groups
  - submissions
  - notifications
  - profile
- teacher routes now pass the authenticated teacher ID into:
  - dashboard
  - subjects
  - submissions
  - review actions
  - notifications
  - profile

## Why this matters
Previous batches verified bearer tokens and roles, but many handlers still used hard-coded seeded IDs. This batch reduces that mismatch and makes the prototype more realistic.

## Still remaining
- more admin mutation flows should record the actual admin actor from `req.user.sub`
- some deeper repository/service writes still do not fully persist actor identity everywhere
