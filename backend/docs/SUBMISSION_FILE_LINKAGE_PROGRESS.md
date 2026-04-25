# Submission File Linkage Progress

This batch links uploaded file metadata to submission records in the prototype store.

## Added
- uploaded file records now support:
  - `submissionId`
  - `activityId`
  - `subjectId`
- after a student submits work, uploaded file paths are linked to the created submission
- new backend route:
  - `GET /files/submission/:submissionId`

## Why this helps
The upload/download layer is now closer to a real system:
- files are not just uploaded
- they are associated with a concrete submission record
- later admin/teacher tooling can inspect attachments by submission

## Remaining work
- Prisma-backed file/submission linkage
- subject-membership-based authorization
- richer attachment browsing in admin/teacher pages
