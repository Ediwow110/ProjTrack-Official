# Repository Cutover Plan

This batch adds repository scaffolds that support two modes:

- `prototype` → reads from the JSON-backed `AppStore`
- `prisma` → reads from PostgreSQL through `PrismaService`

## Current repositories
- `UserRepository`
- `SubjectRepository`
- `SubmissionRepository`
- `NotificationRepository`
- `AuditLogRepository`

## How to use them
Service modules should gradually move from direct `AppStore` access to repository usage.  
That lets the app switch persistence modes without redesigning the frontend contract layer.

## Suggested order
1. Auth → `UserRepository`
2. Dashboard → `UserRepository`, `SubmissionRepository`, `NotificationRepository`
3. Subjects → `SubjectRepository`
4. Submissions → `SubmissionRepository`
5. Notifications → `NotificationRepository`
6. Audit Logs → `AuditLogRepository`

## Goal
After services are updated to use repositories, `PERSISTENCE_MODE=prisma` becomes the default path and the prototype store can remain only for local demos.
