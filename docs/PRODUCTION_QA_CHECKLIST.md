# PROJTRACK Production QA Checklist

Use this checklist after deployment configuration is complete and before opening the system to real users. Record tester name, date, environment, and any evidence links in the release notes.

## 1. Auth

- [ ] Student login works at `/student/login`.
- [ ] Teacher login works at `/teacher/login`.
- [ ] Admin login works at `/admin/login`.
- [ ] Login selector routes each role to the correct login page.
- [ ] Forgot password accepts a valid account email and shows a safe response.
- [ ] Reset password works from a valid reset link.
- [ ] Account activation works from a valid activation link.

## 2. Admin

- [ ] `/admin/users` loads for admins only.
- [ ] Add Admin creates a pending admin and sends an activation email.
- [ ] Deactivate user works for eligible users.
- [ ] Self delete/deactivate is blocked.
- [ ] Last active admin delete/deactivate is blocked.
- [ ] Seed cleanup preview is hidden or disabled unless `ALLOW_SEED_DATA_CLEANUP=true`.
- [ ] In production, seed cleanup also requires `ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true`.
- [ ] Seed cleanup preview shows affected counts and IDs before deletion.
- [ ] Admin Submissions CRUD opens and respects validation.
- [ ] Admin submission delete requires typing `DELETE`.
- [ ] Admin user hard delete requires typing `DELETE USER`.
- [ ] `/admin/requests` redirects to `/admin/notifications`.

## 3. Student

- [ ] Dashboard shows active subjects/classes, deadlines, pending submissions, feedback, and notifications.
- [ ] Subjects/classes page shows subject code, name, teacher, section, and next action.
- [ ] Student can submit an activity.
- [ ] Duplicate submit is prevented.
- [ ] Invalid file type shows a clear error.
- [ ] Oversized file shows a clear error.
- [ ] Submitted timestamp and status are visible after success.
- [ ] Feedback/grade appears after teacher review.
- [ ] Notification badge and inbox update.
- [ ] Student-facing pages do not display internal IDs.
- [ ] Student cannot access another student's data or file by guessed URL/API ID.

## 4. Teacher

- [ ] Subject/classroom view loads only for assigned subjects.
- [ ] Create activity works.
- [ ] Notify students creates in-app notifications.
- [ ] Review submissions works.
- [ ] Reopen activity works when allowed.
- [ ] Classroom notifications reach enrolled students.
- [ ] Email-off fallback still creates in-app notifications.
- [ ] Teacher-facing pages do not display internal IDs by default.

## 5. Mail

- [ ] Activation email sends from `support@projtrack.codes`.
- [ ] Password reset email sends from `support@projtrack.codes`.
- [ ] Bulk invite email sends from `support@projtrack.codes`.
- [ ] Classroom notification email sends from `notification@projtrack.codes`.
- [ ] Admin/system alert sends from `admin@projtrack.codes`.
- [ ] `TESTMAIL_ENABLED=false` in production.
- [ ] Testmail recipient override variables are not set in production.

## 6. Storage

- [ ] Student can upload an allowed file.
- [ ] Student can download their own file.
- [ ] Teacher can download submissions only for assigned classes.
- [ ] Admin download requires admin authentication.
- [ ] Delete submission cleans storage objects or fails safely without silent orphaning.

## 7. Theme/UI

- [ ] Admin light/dark mode is readable.
- [ ] Teacher light/dark mode is readable.
- [ ] Student light/dark mode is readable.
- [ ] Tables are readable in both themes.
- [ ] Modals are readable in both themes.
- [ ] Dropdowns are readable in both themes.
- [ ] Notification menu is readable in both themes.
- [ ] Login pages are not affected by portal dashboard theme styles.

## 8. Production

- [ ] Frontend deployed to `https://projtrack.codes`.
- [ ] Backend deployed to `https://api.projtrack.codes`.
- [ ] Production environment variables are set.
- [ ] Production database migrations have run.
- [ ] S3-compatible object storage is configured.
- [ ] Mailrelay sending is verified with real messages.
- [ ] Secrets have been rotated after any prior exposure.
- [ ] Duplicate scan has been reviewed.
- [ ] Database backup has been created and restore-tested in staging.
- [ ] `https://api.projtrack.codes/health/ready` passes.
