# SubjectsService Split Design

**Date:** 2026-06-24
**Status:** Approved

## Goal

Split the monolithic `subjects.service.ts` (1,454 lines) into three focused domain services, following the same pattern as the AdminService split.

## Current State

- `backend/src/subjects/subjects.service.ts`: 1,454 lines, 18 public methods, 17 private helpers
- `backend/src/subjects/subjects.controller.ts`: 206 lines, 23 routes, all delegating to a single `SubjectsService`
- `backend/src/subjects/subjects.module.ts`: 13 lines, registers `SubjectsService`
- `backend/src/subjects/dto/subject-action.dto.ts`: shared DTOs
- No spec file, no external consumers outside the subjects module

## Proposed Services

### 1. StudentSubjectsService

**File:** `student-subjects.service.ts`
**Est. size:** ~350 lines

**Methods:**
- `studentSubjects(userId)` — list subjects for student
- `studentSubjectDetail(id, userId)` — subject detail with activities/group
- `studentSubmitCatalog(userId)` — submit catalog grouped by subject
- `studentSubmissionContext(activityId, userId)` — submission context for an activity
- `studentCalendar(userId)` — calendar events from activities

**Dependencies:** `SubjectRepository`, `SubmissionRepository`, `UserRepository`, `PrismaService`

**Duplicated helpers:** `requireAuthenticatedUserId`, `ensureStudentEnrolledInSubject`, `mapGroupMembers`, `lookupUserName`, `formatUserName`, `formatStatusLabel`

### 2. TeacherSubjectsService

**File:** `teacher-subjects.service.ts`
**Est. size:** ~750 lines

**Methods:**
- `teacherSubjects(teacherId)` — list subjects for teacher
- `teacherStudents(teacherId, search, section, options)` — paginated student list with progress
- `teacherSections(teacherUserId, options)` — paginated sections list
- `teacherSectionMasterList(sectionId, teacherUserId)` — section master list
- `teacherSectionMasterListExport(sectionId, teacherUserId)` — master list as xlsx
- `teacherSubjectDetail(id, teacherId)` — subject detail with enrollments/groups
- `createTeacherActivity(subjectId, body)` — create activity + notify students
- `updateTeacherActivity(subjectId, activityId, body)` — update activity
- `notifySubjectStudents(subjectId, body)` — manual notification to students
- `updateRestrictions(subjectId, body)` — update subject restrictions
- `reopenSubject(subjectId, actorUserId)` — reopen subject
- `reopenTeacherActivity(subjectId, activityId, actorUserId)` — reopen activity

**Dependencies:** `SubjectRepository`, `SubmissionRepository`, `UserRepository`, `NotificationRepository`, `AuditLogsService`, `MailService`, `PrismaService`, `AccessService`

**Duplicated helpers:** `requireAuthenticatedUserId`, `ensureTeacherOwnsSubject`, `getSubjectStudentUserIds`, `getNotificationPreferences`, `notifyUsers`, `queueEmailsForUsers`, `consumeTeacherEmailRateLimit`, `lookupUserName`, `formatUserName`, `formatStatusLabel`

### 3. SubjectGroupsService

**File:** `subject-groups.service.ts`
**Est. size:** ~300 lines

**Methods:**
- `createGroup(body)` — student creates a group
- `joinGroupByCode(body)` — student joins group by invite code
- `teacherApproveGroup(subjectId, groupId, actorUserId)` — teacher approves
- `teacherLockGroup(subjectId, groupId, actorUserId)` — teacher locks
- `teacherUnlockGroup(subjectId, groupId, actorUserId)` — teacher unlocks
- `teacherAssignGroupLeader(subjectId, groupId, memberId, actorUserId)` — reassign leader
- `teacherRemoveGroupMember(subjectId, groupId, memberId, actorUserId)` — remove member

**Dependencies:** `SubjectRepository`, `PrismaService`, `AccessService`, `AuditLogsService`

**Duplicated helpers:** `requireAuthenticatedUserId`, `ensureTeacherOwnsSubject`, `requireTeacherOwnedGroup`, `lookupUserName`, `userNameById`, `formatUserName`, `formatStatusLabel`

## File-Level Helpers (remain as module-scoped functions)

- `normalizedText(value, fallback)` — used by TeacherSubjectsService
- `requiredText(value, fieldLabel)` — used by TeacherSubjectsService
- `studentSubjectLink(subjectId)` — used by TeacherSubjectsService
- `DEFAULT_TEACHER_STUDENTS_TAKE`, `MAX_TEACHER_STUDENTS_TAKE` — moved to TeacherSubjectsService
- `DEFAULT_TEACHER_SECTIONS_TAKE`, `MAX_TEACHER_SECTIONS_TAKE` — moved to TeacherSubjectsService

## Module Changes

### subjects.module.ts
- Register all 3 services in `providers: [...]`
- Export all 3 services in `exports: [...]`
- No module imports change (already has `MailModule`, `AuditLogsModule`)

### subjects.controller.ts
- Import all 3 services
- Inject all 3 in constructor
- Route each endpoint to the correct service (same mapping as today, just different service)

### subjects.service.ts
- **Deleted** — fully replaced by the 3 new services

## Duplication Policy

Small helpers (<15 lines each) like `requireAuthenticatedUserId`, `ensureTeacherOwnsSubject`, `formatUserName`, `formatStatusLabel` are duplicated per-service. This avoids:
- Shared base classes with constructor injection complexity
- Circular dependencies between services
- Unnecessary abstraction for trivial code

## Testing

- No existing spec file for SubjectsService
- New services will have constructor-only "should be defined" tests as baseline
- No behavior change — existing controller tests cover integration

## Risks

- **None:** No external consumers beyond the subjects module controller
- All methods move exactly as-is — no behavior change
- Full test suite (463 tests) validates no regression
