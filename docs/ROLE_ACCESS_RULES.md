# Role Access Rules

This document summarizes the intended access boundaries for ProjTrack. It is a deployment and QA reference, not a replacement for backend authorization rules.

## Public routes

- Landing and marketing pages
- Login pages for student, teacher, and admin
- Password reset and account activation flows

## Student access

Students may access only student-scoped routes and APIs after a successful backend login.

- Dashboard, calendar, notifications, profile
- Subject views assigned to the authenticated student
- Submission history and submission creation for the authenticated student

Students must not access:

- Admin routes
- Teacher routes
- Other students' submissions, grades, or profiles
- Diagnostic admin endpoints

## Teacher access

Teachers may access only teacher-scoped routes and APIs after a successful backend login.

- Dashboard, notifications, profile
- Assigned subject views
- Teacher submission review workflows
- Teacher student rosters for assigned sections and subjects

Teachers must not access:

- Admin routes
- Student-only submission creation flows
- Records outside their assigned sections and subjects
- Diagnostic admin endpoints unless explicitly granted on the backend

## Admin access

Admins may access platform-wide administrative routes and APIs after a successful backend login.

- User, student, teacher, subject, section, and department management
- Reports, audit logs, announcements, requests, backups, and system tools
- Diagnostic health and monitoring views

Admins should be the only role with access to:

- `/admin/*` routes
- `/health/database`
- `/health/storage`
- `/health/mail`
- `/health/configuration`
- Monitoring and release-status dashboards

## Enforcement notes

- Frontend route protection is role-based and should fail closed in backend mode.
- Production logins must use backend-issued tokens; client-only session creation is blocked.
- Backend authorization remains the source of truth. Frontend route guards improve UX but do not replace server-side checks.
- Smoke, staging, and release QA should verify that each role lands only on its own dashboard and cannot navigate into another role's protected routes.
