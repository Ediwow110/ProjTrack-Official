# AdminOpsRepository Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `admin-ops.repository.ts` (2,205 lines) into 5 domain repositories, update all consumers, delete the old file.

**Architecture:** Pure extraction — copy methods from monolith into focused files with `@Global()` decorator, update module and service imports, no behavioral changes.

**Tech Stack:** NestJS 11, Prisma 6.19.3, TypeScript 5

---

### Task 1: Create SystemToolsRepository

**Files:**
- Create: `backend/src/repositories/system-tools.repository.ts`

Copy from `admin-ops.repository.ts`:
- Static data: `TOOL_META`, `DEFAULT_SYSTEM_TOOLS`, `ToolResult` type
- Private methods: `toolsRoot`, `projectRoot`, `ensureDir`, `formatRunLabel`, `normalizeToolStatus`, `isProductionRestrictedTool`, `mapSystemToolRecord`, `getStateSnapshot`, `executeSystemTool`, `ensureDefaultSystemTools`
- Public methods: `getSystemTools`, `runSystemTool`, `resolveSystemToolArtifact`, `importBackupArtifact`

Imports: `Injectable, NotFoundException, BadRequestException` from `@nestjs/common`, `existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync` from `fs`, `basename, join, resolve` from `path`, `PrismaService`, `getStorageSummary`, `SAFE_USER_SELECT`

- [ ] **Create file with extracted methods**

### Task 2: Create AcademicStructureRepository

**Files:**
- Create: `backend/src/repositories/academic-structure.repository.ts`

Copy from `admin-ops.repository.ts`:
- Private methods: `buildDepartmentCatalog`, `resolveDepartmentCatalogRecord`, `normalizeSearch`, `normalizeDepartmentName`, `departmentKey`, `buildLegacyDepartmentId`, `findLegacyDepartmentName`, `toTitleWords`, `normalizeAcademicYearLabel`, `formatAcademicYearStatus`, `formatYearLevel`, `normalizeYearLevelLabel`, `parseYearLevelNumber`, `normalizeCourseLabel`, `matchesCourse`, `sectionMatchesYearLevel`, `describePlacementSectionMismatch`, `extractYearLevel`, `resolveYearLevelLabel`, `ensureAcademicYearLevel`, `syncLegacyAcademicYearLevels`
- Public methods: `getActiveAcademicYear`, `ensureAcademicYear`, `createAcademicYear`, `deleteAcademicYear`, `createAcademicYearLevel`, `deleteAcademicYearLevel`, `listAcademicYears`, `listSections`, `resolveSectionPlacement`, `createSection`, `getSectionMasterList`, `deleteSection`, `listDepartments`, `getDepartment`, `createDepartment`, `updateDepartment`, `deleteDepartment`, `ensureDepartmentName`, `listCourses`, `createCourse`, `deleteCourse`, `getBulkMoveData`, `moveStudents`

Imports: `Injectable, NotFoundException, BadRequestException, ConflictException` from `@nestjs/common`, `PrismaService`, `SAFE_USER_SELECT`

### Task 3: Create SettingsRepository

**Files:**
- Create: `backend/src/repositories/settings.repository.ts`

Copy from `admin-ops.repository.ts`:
- Static data: `DEFAULT_SYSTEM_SETTINGS`, `buildDefaultAcademicSettings()` function
- Private methods: `normalizeSystemSettings`
- Public methods: `getAcademicSettings`, `saveAcademicSettings`, `getSystemSettings`, `saveSystemSettings`

Imports: `Injectable` from `@nestjs/common`, `PrismaService`

### Task 4: Create AnnouncementsRepository

**Files:**
- Create: `backend/src/repositories/announcements.repository.ts`

Copy from `admin-ops.repository.ts`:
- Public methods: `listAnnouncements`, `createAnnouncement`, `deleteAnnouncements`

Imports: `Injectable` from `@nestjs/common`, `PrismaService`

### Task 5: Create RequestRepository

**Files:**
- Create: `backend/src/repositories/request.repository.ts`

Copy from `admin-ops.repository.ts`:
- Public methods: `listRequests`, `updateRequestStatus`

Imports: `Injectable, NotFoundException` from `@nestjs/common`, `PrismaService`

### Task 6: Add saveSubmissionNote to SubmissionRepository

**Files:**
- Modify: `backend/src/repositories/submission.repository.ts`

Add `saveSubmissionNote(id: string, note: string)` method (lines 2071-2078 from old file).

### Task 7: Update RepositoriesModule

**Files:**
- Modify: `backend/src/repositories/repositories.module.ts`

Replace `AdminOpsRepository` with 5 new repos in providers and exports. Add all imports.

### Task 8: Update AdminNotificationsService

**Files:**
- Modify: `backend/src/admin/admin-notifications.service.ts`

Replace `AdminOpsRepository` with `AnnouncementsRepository`. Update method calls: `this.adminOpsRepository.listAnnouncements()` → `this.announcementsRepository.listAnnouncements()`, etc.

### Task 9: Update AdminReportsService

**Files:**
- Modify: `backend/src/admin/admin-reports.service.ts`

Replace `AdminOpsRepository` with `RequestRepository`. Update: `listRequests` → `this.requestRepository.listRequests()`, `updateRequestStatus` → `this.requestRepository.updateRequestStatus()`.

### Task 10: Update AdminSectionsService

**Files:**
- Modify: `backend/src/admin/admin-sections.service.ts`

Replace `AdminOpsRepository` with `AcademicStructureRepository`. Update: `listSections`, `createSection`, `getSectionMasterList`, `deleteSection`, `moveStudents`, `getBulkMoveData`.

### Task 11: Update AdminSettingsService

**Files:**
- Modify: `backend/src/admin/admin-settings.service.ts`

Replace `AdminOpsRepository` with `SettingsRepository` and `AcademicStructureRepository`. Update method calls accordingly.

### Task 12: Update AdminSubjectsService

**Files:**
- Modify: `backend/src/admin/admin-subjects.service.ts`

Replace `AdminOpsRepository` with `SettingsRepository`. Update: `getAcademicSettings`.

### Task 13: Update AdminSubmissionsService

**Files:**
- Modify: `backend/src/admin/admin-submissions.service.ts`

Replace `AdminOpsRepository` with `SubmissionRepository`. Update: `saveSubmissionNote`.

### Task 14: Update AdminSystemToolsService

**Files:**
- Modify: `backend/src/admin/admin-system-tools.service.ts`

Replace `AdminOpsRepository` with `SystemToolsRepository`. Update: `getSystemTools`, `runSystemTool`, `resolveSystemToolArtifact`, `importBackupArtifact`.

### Task 15: Update AdminUsersService

**Files:**
- Modify: `backend/src/admin/admin-users.service.ts`

Replace `AdminOpsRepository` with `AcademicStructureRepository`. Update: `resolveSectionPlacement`, `ensureDepartmentName`.

### Task 16: Delete admin-ops.repository.ts

- [ ] Delete `backend/src/repositories/admin-ops.repository.ts`

### Task 17: Verify

- [ ] Run `npx tsc --noEmit` to check compilation
- [ ] Run `npx jest` to check all 463 main tests pass
- [ ] Run security tests to check all 233 security tests pass
