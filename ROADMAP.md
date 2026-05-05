# Roadmap

This roadmap keeps the first production launch focused and separates must-have launch controls from post-launch improvements.

## MVP Launch Scope

- Role-based login and access for admins, teachers, and students.
- Admin management for users, academic structure, subjects, groups, mail jobs, backups, and system health.
- Teacher workflows for subjects, submissions, students, review, and feedback.
- Student workflows for due work, submitted work, groups, feedback, and profile.
- File upload controls with size, MIME, ownership, and malware-scanner production policy.
- Production deployment with CI gates, Prisma migration validation, smoke tests, monitoring, backup/restore proof, and rollback plan.

## First Public Release Candidate

Recommended version: `v1.0.0-rc.1`.

Exit criteria:

- CI green on `production-hardening-test -> main`.
- Staging smoke test completed with dated evidence.
- Backup restore drill completed with dated evidence.
- Monitoring alerts verified with dated evidence.
- Admin, teacher, and student signoff recorded.
- No known critical or high security blockers.

## Post-Launch Priorities

- Add deeper automated RBAC integration tests for teacher/student cross-tenant access.
- Add upload malware-scanner integration tests against the selected production scanner.
- Add dashboard-level SLOs and alert routing ownership.
- Add accessibility audit coverage for role dashboards and submission flows.
- Add operator-facing changelog publishing workflow.
- Add issue templates and labels for `security`, `production-blocker`, `rbac`, `uploads`, `smoke-test`, `ux`, and `docs`.
