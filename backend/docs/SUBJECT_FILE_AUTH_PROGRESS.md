# Subject File Authorization Progress

This batch strengthens file access checks beyond simple uploader ownership.

## Added
- teacher access now validates subject ownership:
  - a teacher can access a file only when it belongs to a subject they teach
- student access now allows:
  - direct ownership access
  - subject-membership access for files linked to a subject they are enrolled in

## Why this helps
This is a better approximation of real academic file access rules:
- students should only reach files relevant to their enrolled subjects
- teachers should only reach files inside subjects they handle

## Remaining work
- group-member-aware file authorization at a finer level
- DB-backed authorization using Prisma relations instead of prototype store checks
- admin/teacher filtering by section and submission state
