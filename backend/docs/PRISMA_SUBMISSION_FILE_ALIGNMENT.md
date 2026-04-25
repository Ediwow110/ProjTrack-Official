# Prisma Submission/File Alignment

This batch aligns more of the Prisma schema with the repository layer around submissions and uploaded files.

## Added / adjusted
- `SubmissionFile` model
- richer `Submission` fields:
  - `subjectId`
  - `studentId`
  - `submittedById`
  - `reviewerId`
  - `title`
  - timestamps
  - file relation
- subject/task/group/group-member schema fields adjusted to better match repository usage
- submission creation now carries uploaded file `relativePath` metadata

## Why this helps
The repository layer already assumed a richer Prisma shape for submissions and files. This batch reduces that mismatch and makes the future Prisma cutover more realistic.

## Still remaining
- actual Prisma migrations / db push execution
- end-to-end verification against a live Postgres instance
- download endpoints for stored files
