# API Map (In-Memory Prototype)

## Auth
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/me`
- POST `/auth/activate`
- POST `/auth/forgot-password`
- POST `/auth/reset-password`

## Admin Students
- GET `/admin/students/template`
- POST `/admin/students/import`
- POST `/admin/students/import/confirm`
- POST `/admin/students/:id/activate`
- POST `/admin/students/:id/send-reset-link`

## Dashboard
- GET `/student/dashboard/summary`
- GET `/student/dashboard/charts`
- GET `/student/dashboard/upcoming-deadlines`
- GET `/teacher/dashboard/summary`
- GET `/admin/dashboard/summary`
- GET `/admin/dashboard/activity`

## Subjects / Groups
- GET `/student/subjects`
- GET `/student/subjects/:id`
- GET `/student/activities/:id/submission-context`
- GET `/teacher/subjects`
- GET `/teacher/subjects/:id`
- POST `/teacher/subjects/:id/submissions`
- PATCH `/teacher/subjects/:id/restrictions`
- PATCH `/teacher/subjects/:id/reopen`
- POST `/student/groups`
- POST `/student/groups/join-by-code`

## Submissions
- GET `/student/submissions`
- GET `/student/submissions/:id`
- POST `/student/submissions`
- GET `/teacher/submissions`
- GET `/teacher/submissions/export`
- GET `/teacher/submissions/:id`
- PATCH `/teacher/submissions/:id/review`

## Notifications
- GET `/student/notifications`
- POST `/student/notifications/mark-all-read`
- GET `/teacher/notifications`
- POST `/teacher/notifications/mark-all-read`
- GET `/admin/notifications`
- POST `/admin/notifications/broadcast`

## Admin Operations
- GET `/admin/reports/summary`
- GET `/admin/reports/current-view`
- GET `/admin/reports/export`
- GET `/admin/groups`
- GET `/admin/groups/:id`
- GET `/admin/announcements`
- POST `/admin/announcements`
- GET `/admin/calendar/events`
- GET `/admin/calendar/events/:id`
- GET `/admin/audit-logs`
- GET `/admin/audit-logs/:id`
