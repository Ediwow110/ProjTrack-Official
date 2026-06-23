# AdminOpsRepository Split Design

**Goal:** Split `admin-ops.repository.ts` (2,205 lines) into 5 focused domain repositories.

**Context:** This is the last remaining monolith after splitting AdminService (4,412 lines) and SubjectsService (1,454 lines). `AdminOpsRepository` is a `@Global()` repository that accumulated data-access methods for every admin feature. It must be decomposed into single-responsibility repositories.

**Pattern:** Each new repository gets `@Global()` (matching current behavior), injects only `PrismaService`, and owns data access for one entity cluster.

---

## Repository Definitions

### 1. SystemToolsRepository (`backend/src/repositories/system-tools.repository.ts`)

~380 lines. System tool execution, backup, cache, diagnostics, export, and artifact management.

**Public methods:**
- `getSystemTools()` — returns tool metadata + status
- `runSystemTool(id)` — orchestrates tool execution (backup, restore, cache, purge, diag, export)
- `resolveSystemToolArtifact(artifactPath)` — resolves file artifact path
- `importBackupArtifact(input)` — imports backup via file I/O

**Static data moved:**
- `TOOL_META` constant
- `DEFAULT_SYSTEM_TOOLS` constant
- `ToolResult` type

**Static helpers moved:**
- Gets no helpers from the original file (fs operations are inline)

### 2. AcademicStructureRepository (`backend/src/repositories/academic-structure.repository.ts`)

~850 lines. All academic structure entities: academic years, year levels, sections, departments, courses, plus student movement.

**Public methods:**
- `getActiveAcademicYear()`, `ensureAcademicYear(name, status)`, `createAcademicYear(payload)`, `listAcademicYears(search?)`, `deleteAcademicYear(id)`
- `createAcademicYearLevel(payload)`, `deleteAcademicYearLevel(id)`
- `listSections(filters)`, `resolveSectionPlacement(payload)`, `createSection(payload)`, `getSectionMasterList(sectionId)`, `deleteSection(id)`
- `listDepartments(search?)`, `getDepartment(id)`, `createDepartment(payload)`, `updateDepartment(id, payload)`, `deleteDepartment(id)`, `ensureDepartmentName(value?)`
- `listCourses(academicYearId)`, `createCourse(payload)`, `deleteCourse(id)`
- `getBulkMoveData()`, `moveStudents(sourceSectionId, destSectionId, ids)`

**Private helpers moved:**
- `buildDepartmentCatalog()` — used by `listDepartments`, `getBulkMoveData`

### 3. SettingsRepository (`backend/src/repositories/settings.repository.ts`)

~80 lines. Academic settings and system settings CRUD.

**Public methods:**
- `getAcademicSettings()`, `saveAcademicSettings(payload)`
- `getSystemSettings()`, `saveSystemSettings(payload)`

**Static data moved:**
- `DEFAULT_SYSTEM_SETTINGS` constant (18 fields)

**Static helpers moved:**
- `buildDefaultAcademicSettings()` function

### 4. AnnouncementsRepository (`backend/src/repositories/announcements.repository.ts`)

~50 lines. Announcement CRUD.

**Public methods:**
- `listAnnouncements()`, `createAnnouncement(body)`, `deleteAnnouncements(ids)`

### 5. RequestRepository (`backend/src/repositories/request.repository.ts`)

~30 lines. Request management.

**Public methods:**
- `listRequests(status?)`, `updateRequestStatus(id, status)`

### 6. SubmissionRepository update

- Add `saveSubmissionNote(id, note)` to existing `backend/src/repositories/submission.repository.ts` (~15 lines)

---

## Consumer Updates

| Service | Current injection | New injections | Methods used |
|---|---|---|---|
| AdminNotificationsService | `AdminOpsRepository` | `AnnouncementsRepository` | listAnnouncements, createAnnouncement, deleteAnnouncements |
| AdminReportsService | `AdminOpsRepository` | `SystemToolsRepository` | getSystemTools, runSystemTool |
| AdminSectionsService | `AdminOpsRepository` | `AcademicStructureRepository` | listSections, createSection, deleteSection, getSectionMasterList, moveStudents, getBulkMoveData |
| AdminSettingsService | `AdminOpsRepository` | `SettingsRepository`, `AcademicStructureRepository` | getAcademicSettings, saveAcademicSettings, getSystemSettings, saveSystemSettings, ensureAcademicYear, createAcademicYear, deleteAcademicYear, createAcademicYearLevel, deleteAcademicYearLevel, listAcademicYears, listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, ensureDepartmentName, listCourses, createCourse, deleteCourse, getActiveAcademicYear |
| AdminSubjectsService | `AdminOpsRepository` | `SettingsRepository` | getAcademicSettings |
| AdminSubmissionsService | `AdminOpsRepository` | `SubmissionRepository` | saveSubmissionNote |
| AdminSystemToolsService | `AdminOpsRepository` | `SystemToolsRepository` | getSystemTools, runSystemTool, resolveSystemToolArtifact, importBackupArtifact |
| AdminUsersService | `AdminOpsRepository` | `AcademicStructureRepository` | resolveSectionPlacement, ensureDepartmentName |

---

## Module Changes

`RepositoriesModule` (`backend/src/repositories/repositories.module.ts`):
- Remove `AdminOpsRepository` from providers and exports
- Add 5 new repos to providers and exports
- Keep `@Global()` decorator

---

## Spec File Updates

Each consumer's `.spec.ts` file needs factory function updated:

1. `admin-notifications.service.spec.ts` — `AnnouncementsRepository` mock
2. `admin-reports.service.spec.ts` — `SystemToolsRepository` mock
3. `admin-sections.service.spec.ts` — `AcademicStructureRepository` mock
4. `admin-settings.service.spec.ts` — `SettingsRepository` + `AcademicStructureRepository` mocks
5. `admin-subjects.service.spec.ts` — `SettingsRepository` mock
6. `admin-submissions.service.spec.ts` — `SubmissionRepository` mock
7. `admin-system-tools.service.spec.ts` — `SystemToolsRepository` mock
8. `admin-users.service.spec.ts` — `AcademicStructureRepository` mock

---

## Deletion

- Delete `backend/src/repositories/admin-ops.repository.ts` after all consumers are updated

---

## No Behavioral Changes

- All method signatures remain identical
- All return types remain identical
- No logic changes, no refactoring
- Pure extraction into focused files
