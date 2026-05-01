import {
  getAuthSession,
  setAuthSession,
  updateAuthSession,
  type AppRole,
} from "../mockAuth";
import { http } from "./http";
import { apiRuntime, buildBackendFileUrl, isOfficialMode } from "./runtime";
import { normalizeDateLabel, normalizeDateTimeLabel, normalizeId, normalizeNotificationType } from "./normalize";
import { formatSubmissionStatus, getReviewActionState, normalizeSubmissionStatus } from "../submissionRules";
import type {
  AdminAnnouncementRecord,
  AdminCreateUserInput,
  AdminDepartmentCreateInput,
  AdminDepartmentRecord,
  AdminDepartmentUpdateInput,
  AdminDashboardResponse,
  AdminSubmissionRecord,
  AdminSubmissionUpsertInput,
  AdminCalendarEvent,
  AdminAcademicYearRecord,
  AdminGroupRecord,
  AdminNotificationRecord,
  AdminReportsResponse,
  AdminRequestRecord,
  AdminSectionCreateInput,
  AdminSectionRecord,
  AdminStudentRecord,
  AdminStudentUpsertInput,
  AdminSubjectRecord,
  AdminSubjectUpsertInput,
  AdminTeacherRecord,
  AdminTeacherUpsertInput,
  AdminUserRecord,
  AuditLogRecord,
  CalendarEventItem,
  SignInPayload,
  StudentDashboardResponse,
  StudentSubmitCatalogResponse,
  StudentPortalNotification,
  StudentProfileResponse,
  TeacherProfileResponse,
  AdminProfileResponse,
  TeacherPortalNotification,
  AdminStudentViewResponse,
  AcademicSettingsResponse,
  SystemSettingsResponse,
  BrandingResponse,
  SystemToolRecord,
  SystemToolRunResult,
  SystemToolRunResponse,
  BulkMoveDataResponse,
  AdminTeacherViewResponse,
  AdminSubjectViewResponse,
  AdminSubmissionViewResponse,
  SectionMasterListResponse,
  StudentSubjectCard,
  StudentSubjectResponse,
  StudentSubmissionRow,
  TeacherAssignedSectionRecord,
  TeacherDashboardResponse,
  TeacherSubmissionReviewResponse,
  TeacherStudentRecord,
  TeacherSubjectCard,
  TeacherSubjectResponse,
  TeacherSubmissionRow,
  MailJobRecord,
  SystemHealthRecord,
  ClientErrorTelemetryResponse,
  BackupDetailResponse,
  BackupHistoryResponse,
  BackupRunRecord,
  BackupSettingsResponse,
  ReleaseStatusItem,
  BootstrapStepItem,
  MailRuntimeStatus,
} from "./contracts";

const delay = (ms = 320) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const adminAnnouncementsData: any[] = [];
const adminDepartmentsData: any[] = [];
const adminDashboardData: any = {};
const adminSubmissionsData: any[] = [];
const adminCalendarEvents: any[] = [];
const adminGroupsData: any[] = [];
const adminNotifications: any[] = [];
const adminReportsData: any = {};
const adminRequestsData: any[] = [];
const adminSectionsData: any[] = [];
const adminStudentsData: any[] = [];
const adminSubjectsData: any[] = [];
const adminTeachersData: any[] = [];
const auditLogs: any[] = [];
const signInMock: any = {};
const studentCalendarEvents: any[] = [];
const studentSubmitCatalogData: any = { subjects: [], activities: {} };
const studentDashboardData: any = {};
const studentNotificationsData: any[] = [];
const studentProfileData: any = {};
const teacherNotificationsData: any[] = [];
const teacherProfileData: any = {};
const adminStudentViewData: any = {};
const adminTeacherViewData: any = {};
const adminSubjectViewData: any = {};
const adminSubmissionViewData: any = {};
const academicSettingsData: any = {};
const systemSettingsData: any = {};
const systemToolsData: any[] = [];
const bulkMoveData: any = { academicYears: [], sections: [] };
const studentSubjectCards: any[] = [];
const studentSubjectData: any = {};
const studentSubmissions: any[] = [];
const teacherDashboardData: any = {};
const teacherSubmissionReviewData: any = {};
const teacherStudentsData: any[] = [];
const teacherSubjectCards: any[] = [];
const teacherSubjectData: any = {};
const teacherSubmissions: any[] = [];
const PROFILE_AVATAR_MAX_MB = 5;

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, header: Array<string>, rows: Array<Array<string | number>>) {
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toAnnouncementDisplayStatus(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "PUBLISHED" || normalized === "SENT") return "Sent";
  if (normalized === "SCHEDULED") return "Scheduled";
  if (normalized === "DRAFT") return "Draft";
  if (normalized === "QUEUED") return "Queued";

  const titleCased = normalized
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

  return titleCased || "Draft";
}

function toAnnouncementBackendStatus(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "SCHEDULED" || normalized === "DRAFT" || normalized === "PUBLISHED") {
    return normalized;
  }

  if (normalized === "SENT" || normalized === "QUEUED") {
    return "PUBLISHED";
  }

  return "PUBLISHED";
}

function toAnnouncementDisplayWhen(value?: string | Date | null) {
  if (!value) return "Not scheduled";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getHealthySystemTone(good: boolean, warning = false) {
  if (good) {
    return {
      pill: "bg-emerald-50 border-emerald-200 text-emerald-700",
      dot: "bg-emerald-500",
      label: "System Ready",
    };
  }

  if (warning) {
    return {
      pill: "bg-amber-50 border-amber-200 text-amber-700",
      dot: "bg-amber-500",
      label: "Needs Attention",
    };
  }

  return {
    pill: "bg-rose-50 border-rose-200 text-rose-700",
    dot: "bg-rose-500",
    label: "Not Ready",
  };
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

async function uploadProfileAvatar(file: File, scope: string) {
  const fileType = String(file.type || '').toLowerCase();
  if (!['image/png','image/jpeg','image/jpg','image/webp'].includes(fileType)) {
    throw new Error('Unsupported avatar file. Please use PNG, JPG, or WEBP.');
  }
  if (file.size > PROFILE_AVATAR_MAX_MB * 1024 * 1024) {
    throw new Error(`Avatar file is too large. Maximum size is ${PROFILE_AVATAR_MAX_MB} MB.`);
  }
  return http.uploadFile<{ relativePath: string }>("/files/upload", file, { scope });
}

function isSpreadsheetFile(file: File) {
  return /\.(xlsx|xls)$/i.test(file.name);
}

function isCsvLikeFile(file: File) {
  return /\.(csv|tsv)$/i.test(file.name) || file.type.includes("csv") || file.type.includes("tab-separated-values");
}




function requireBackendApi() {
  throw new Error("Backend API access is required.");
}

function buildStoredFileDownloadUrl(relativePath?: string) {
  if (!relativePath) return undefined;
  const cleaned = relativePath.replace(/^\/+/, "");
  return buildBackendFileUrl(`/files/download/${cleaned}`);
}

function toStoredFileRoutePath(relativePath?: string) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "").trim();
  if (!cleaned) throw new Error("Stored file path is required.");
  return `/files/download/${cleaned}`;
}

function toStoredFileDeletePath(relativePath?: string) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "").trim();
  if (!cleaned) throw new Error("Stored file path is required.");
  return `/files/${cleaned}`;
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function getProtectedFileObjectUrl(relativePath?: string) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "").trim();
  if (!cleaned) return "";
  const { blob } = await http.getBlob(toStoredFileRoutePath(cleaned));
  return URL.createObjectURL(blob);
}

async function getProtectedFileObjectUrlWithCacheBust(
  relativePath?: string,
  cacheBust?: string | number,
) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "").trim();
  if (!cleaned) return "";
  const { blob } = await http.getBlob(
    toStoredFileRoutePath(cleaned),
    cacheBust === undefined ? undefined : { v: cacheBust },
  );
  return URL.createObjectURL(blob);
}

async function downloadStoredFile(relativePath?: string, preferredName?: string) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "").trim();
  if (!cleaned) throw new Error("Stored file path is required.");
  const response = await http.getBlob(toStoredFileRoutePath(cleaned));
  const fallbackName = preferredName || cleaned.split("/").pop() || "download";
  downloadBlobFile(response.blob, response.fileName || fallbackName);
}

function getTeacherDisplayName(subjectLike: any, fallback = "Assigned Teacher") {
  const teacherUser = subjectLike?.teacher?.user;
  const nestedName = [teacherUser?.firstName, teacherUser?.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  if (nestedName) return nestedName;

  const teacherName = String(
    subjectLike?.teacherName ||
      subjectLike?.teacher?.name ||
      subjectLike?.teacher?.fullName ||
      "",
  ).trim();
  if (teacherName) return teacherName;

  return fallback;
}

function syncAuthSessionFromCurrentUser(user?: {
  id?: string;
  identifier?: string;
  email?: string;
  role?: string;
  name?: string;
  status?: string;
  avatarRelativePath?: string;
}) {
  const current = getAuthSession();
  if (!current || !user) return;

  const hasAvatarPath = typeof user.avatarRelativePath === "string";
  updateAuthSession({
    userId: user.id ? String(user.id) : current.userId,
    identifier: user.identifier ? String(user.identifier) : current.identifier,
    email: user.email ? String(user.email) : current.email,
    displayName: user.name ? String(user.name) : current.displayName,
    status: user.status ? String(user.status) : current.status,
    avatarRelativePath: hasAvatarPath ? user.avatarRelativePath : current.avatarRelativePath,
    avatarVersion: hasAvatarPath ? Date.now() : current.avatarVersion,
  });
}

function syncAuthSessionFromProfile(profile?: {
  fullName?: string;
  avatarRelativePath?: string;
  form?: { email?: string; avatarRelativePath?: string };
}) {
  const current = getAuthSession();
  if (!current || !profile) return;

  const avatarRelativePath =
    typeof profile.avatarRelativePath === "string"
      ? profile.avatarRelativePath
      : typeof profile.form?.avatarRelativePath === "string"
        ? profile.form.avatarRelativePath
        : undefined;

  updateAuthSession({
    displayName: String(profile.fullName || current.displayName).trim() || current.displayName,
    email: profile.form?.email ? String(profile.form.email) : current.email,
    avatarRelativePath:
      avatarRelativePath === undefined ? current.avatarRelativePath : avatarRelativePath,
    avatarVersion: avatarRelativePath === undefined ? current.avatarVersion : Date.now(),
  });
}


function toSubmissionModeLabel(modeOrGroupId: unknown): "Individual" | "Group" {
  const normalized = String(modeOrGroupId || "").trim().toUpperCase();
  if (normalized === "GROUP") return "Group";
  if (normalized === "INDIVIDUAL") return "Individual";
  return modeOrGroupId ? "Group" : "Individual";
}

function toAdminNotificationType(type: unknown): AdminNotificationRecord['type'] {
  return normalizeNotificationType(type, ['request', 'account', 'system'] as const, 'system');
}

function toStudentNotificationType(type: unknown): StudentPortalNotification['type'] {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized === 'review' || normalized === 'submission' || normalized === 'submit') {
    return 'feedback';
  }

  if (normalized === 'announcement' || normalized === 'system' || normalized === 'notification') {
    return 'info';
  }

  if (normalized === 'new-activity' || normalized === 'activity' || normalized === 'activity-created') {
    return 'info';
  }

  return normalizeNotificationType(
    normalized,
    ['grade', 'overdue', 'deadline', 'account', 'feedback', 'info'] as const,
    'info',
  );
}

function toTeacherNotificationType(type: unknown): TeacherPortalNotification['type'] {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized === 'review' || normalized === 'submission' || normalized === 'submit') {
    return 'submit';
  }

  if (normalized === 'announcement' || normalized === 'system' || normalized === 'notification') {
    return 'info';
  }

  return normalizeNotificationType(normalized, ['deadline', 'grade', 'info'] as const, 'info');
}


function toAuditRole(role: unknown): AuditLogRecord['role'] {
  return role === 'ADMIN' ? 'Admin' : role === 'TEACHER' ? 'Teacher' : 'Student';
}


function formatPersonName(value: any, fallback = "Unknown") {
  if (typeof value === "string") {
    return value.trim() || fallback;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (!value || typeof value !== "object") {
    return fallback;
  }

  if (value.name) return formatPersonName(value.name, fallback);
  if (value.student) return formatPersonName(value.student, fallback);
  if (value.user) return formatPersonName(value.user, fallback);

  const fullName = [value.firstName, value.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;

  return String(value.email || value.studentNumber || value.id || fallback).trim() || fallback;
}

function formatMemberStatus(value: any) {
  const normalized = String(value || "ACTIVE").trim().toUpperCase().replace(/_/g, " ");
  if (normalized === "ACTIVE") return "Active";
  if (normalized === "INACTIVE") return "Inactive";
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildGroupMemberRows(group: any) {
  const raw = Array.isArray(group?.members) ? group.members : Array.isArray(group?.memberUserIds) ? group.memberUserIds.map((id: string) => ({ id, name: id })) : [];
  return raw.map((member: any, index: number) => {
    const role = String(member?.role || "").trim();
    const id = String(
      member?.id ||
      member?.userId ||
      member?.studentId ||
      member?.student?.userId ||
      member?.student?.id ||
      index + 1,
    );
    return {
      id,
      name: formatPersonName(member?.name ?? member?.student ?? member?.user ?? member, id),
      status: formatMemberStatus(member?.status ?? member?.student?.status ?? member?.user?.status),
      isLeader: Boolean(member?.isLeader) || role.toUpperCase() === "LEADER" || index === 0,
    };
  });
}

export const endpointRegistry = {
  auth: { signIn: "POST /auth/login", currentUser: "GET /auth/me" },
  student: {
    dashboard: "GET /student/dashboard/summary",
    calendar: "GET /student/calendar/events",
    submissions: "GET /student/submissions",
    subjects: "GET /student/subjects",
    notifications: "GET /student/notifications",
    submitCatalog: "GET /student/submit-catalog",
    createSubmission: "POST /student/submissions",
  },
  files: {
    upload: "POST /files/upload-base64",
    list: "GET /files",
  },
  teacher: { submissions: "GET /teacher/submissions", export: "GET /teacher/submissions/export", dashboard: "GET /teacher/dashboard/summary", subjects: "GET /teacher/subjects", students: "GET /teacher/students", submissionReview: "GET /teacher/submissions/:id" },
  admin: {
    auditLogs: "GET /admin/audit-logs",
    auditLogDetail: "GET /admin/audit-logs/:id",
    reports: "GET /admin/reports/summary",
    reportDashboard: "GET /admin/reports/dashboard",
    notifications: "GET /admin/notifications",
    markNotificationRead: "POST /admin/notifications/:id/read",
    markAllNotificationsRead: "POST /admin/notifications/read-all",
    deleteNotifications: "POST /admin/notifications/delete",
    announcements: "GET /admin/announcements",
    deleteAnnouncements: "POST /admin/announcements/delete",
    calendar: "GET /admin/calendar/events",
    calendarEventDetail: "GET /admin/calendar/events/:id",
    groups: "GET /admin/groups",
    students: "GET /admin/students",
    subjects: "GET /admin/subjects",
    teachers: "GET /admin/teachers",
    sections: "GET /admin/sections",
    requests: "GET /admin/requests",
    dashboard: "GET /admin/dashboard/summary",
    submissions: "GET /admin/submissions",
    submissionNote: "POST /admin/submissions/:id/note",
    mailJobs: "GET /admin/mail-jobs",
    health: "GET /health",
  },
  teacherSubject: { detail: "GET /teacher/subjects/:id" },
  studentSubject: { detail: "GET /student/subjects/:id" },
} as const;

export interface TeacherSubmissionFilters { search?: string; status?: string; section?: string; subject?: string; type?: string }
export interface AuditLogFilters { search?: string; module?: string }
export interface AdminReportsFilters { schoolYear?: string; semester?: string; section?: string }
export interface AdminNotificationsFilters { type?: string }
export interface AdminStudentFilters { search?: string; status?: string }
export interface AdminSubjectFilters { search?: string }
export interface AdminGroupFilters { search?: string; section?: string; status?: string }
export interface AdminAnnouncementFilters { status?: string }
export interface AdminCalendarFilters { audience?: string }
export interface AdminTeacherFilters { search?: string; status?: string }
export interface AdminSectionFilters { search?: string; academicYearId?: string }
export interface AdminAcademicYearFilters { search?: string }
export interface AdminRequestFilters { status?: string }
export interface AdminSubmissionFilters {
  search?: string;
  status?: string;
  section?: string;
  subjectId?: string;
  studentId?: string;
}
export interface AdminUserFilters { search?: string; role?: string; status?: string }
export interface TeacherStudentFilters { search?: string; section?: string }
export interface StudentSubjectCardFilters { search?: string }
export interface StudentNotificationFilters { type?: string }

function parseDelimitedRows(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [] as string[][];
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

const templateHeaders = [
  "student_id",
  "first_name",
  "middle_initial",
  "last_name",
  "email",
  "academic_year",
  "course_code",
  "course_name",
  "year_level",
  "section",
];

const defaultAcademicSettings: AcademicSettingsResponse = {
  schoolYear: "2025–2026",
  semester: "2nd Semester",
  periodStart: "2026-01-15",
  periodEnd: "2026-05-30",
  latePolicy: "24h",
  lateDeduction: "10",
  allowedTypes: ["pdf", "docx", "pptx", "zip"],
};

const defaultSystemSettings: SystemSettingsResponse = {
  schoolName: "PROJTRACK Academy Portal",
  email: "admin@projtrack.edu.ph",
  notifEmail: "noreply@projtrack.edu.ph",
  minPassLen: "8",
  maxFailedLogins: "5",
  sessionTimeout: "60",
  allowRegistration: false,
  requireEmailVerification: true,
  twoFactorAdmin: false,
  backupFrequency: "Daily",
  accountAccessEmailsEnabled: true,
  classroomActivityEmailsEnabled: false,
  classroomActivitySystemNotificationsEnabled: true,
};

const defaultBrandingResponse: BrandingResponse = {
  brandName: "ProjTrack",
  logoUrl: null,
  iconUrl: null,
  faviconUrl: "/favicon.svg",
  updatedAt: null,
};

function normalizeAcademicSettingsResponse(payload: any): AcademicSettingsResponse {
  return {
    schoolYear: String(payload?.schoolYear ?? defaultAcademicSettings.schoolYear),
    semester: String(payload?.semester ?? defaultAcademicSettings.semester),
    periodStart: String(
      payload?.periodStart ?? payload?.submissionStart ?? defaultAcademicSettings.periodStart,
    ),
    periodEnd: String(
      payload?.periodEnd ?? payload?.submissionEnd ?? defaultAcademicSettings.periodEnd,
    ),
    latePolicy: String(payload?.latePolicy ?? defaultAcademicSettings.latePolicy),
    lateDeduction: String(payload?.lateDeduction ?? defaultAcademicSettings.lateDeduction),
    allowedTypes:
      Array.isArray(payload?.allowedTypes) && payload.allowedTypes.length > 0
        ? payload.allowedTypes.map((item: unknown) => String(item))
        : [...defaultAcademicSettings.allowedTypes],
  };
}

function normalizeSystemSettingsResponse(payload: any): SystemSettingsResponse {
  return {
    schoolName: String(payload?.schoolName ?? defaultSystemSettings.schoolName),
    email: String(payload?.email ?? defaultSystemSettings.email),
    notifEmail: String(payload?.notifEmail ?? defaultSystemSettings.notifEmail),
    minPassLen: String(payload?.minPassLen ?? defaultSystemSettings.minPassLen),
    maxFailedLogins: String(payload?.maxFailedLogins ?? defaultSystemSettings.maxFailedLogins),
    sessionTimeout: String(payload?.sessionTimeout ?? defaultSystemSettings.sessionTimeout),
    allowRegistration: Boolean(payload?.allowRegistration ?? defaultSystemSettings.allowRegistration),
    requireEmailVerification: Boolean(
      payload?.requireEmailVerification ?? defaultSystemSettings.requireEmailVerification,
    ),
    twoFactorAdmin: Boolean(payload?.twoFactorAdmin ?? defaultSystemSettings.twoFactorAdmin),
    backupFrequency: String(payload?.backupFrequency ?? defaultSystemSettings.backupFrequency),
    accountAccessEmailsEnabled: Boolean(
      payload?.accountAccessEmailsEnabled ?? defaultSystemSettings.accountAccessEmailsEnabled,
    ),
    classroomActivityEmailsEnabled: Boolean(
      payload?.classroomActivityEmailsEnabled ?? defaultSystemSettings.classroomActivityEmailsEnabled,
    ),
    classroomActivitySystemNotificationsEnabled: Boolean(
      payload?.classroomActivitySystemNotificationsEnabled ??
        defaultSystemSettings.classroomActivitySystemNotificationsEnabled,
    ),
  };
}

function normalizeBrandingResponse(payload: any): BrandingResponse {
  const updatedAt = payload?.updatedAt ? String(payload.updatedAt) : defaultBrandingResponse.updatedAt;

  return {
    brandName: String(payload?.brandName ?? defaultBrandingResponse.brandName).trim() || defaultBrandingResponse.brandName,
    logoUrl: normalizeBrandingAssetUrl(payload?.logoUrl, updatedAt),
    iconUrl: normalizeBrandingAssetUrl(payload?.iconUrl, updatedAt),
    faviconUrl:
      normalizeBrandingAssetUrl(payload?.faviconUrl, updatedAt) ??
      defaultBrandingResponse.faviconUrl,
    updatedAt,
  };
}

function normalizeBrandingAssetUrl(value: unknown, updatedAt?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const resolved = raw.startsWith("/branding-assets/")
    ? buildBackendFileUrl(raw)
    : raw;
  if (!updatedAt || !resolved.includes("/branding-assets/")) {
    return resolved;
  }

  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}v=${encodeURIComponent(updatedAt)}`;
}

const academicSettingsStore: AcademicSettingsResponse = normalizeAcademicSettingsResponse(academicSettingsData);
const systemSettingsStore: SystemSettingsResponse = normalizeSystemSettingsResponse(systemSettingsData);
const brandingStore: BrandingResponse = normalizeBrandingResponse(defaultBrandingResponse);
const bulkMoveStore: BulkMoveDataResponse = JSON.parse(JSON.stringify(bulkMoveData));
const systemToolsStore: SystemToolRecord[] = JSON.parse(JSON.stringify(systemToolsData));
let lastStudentImportBatchId: string | null = null;

export const authService = {
  async signIn(payload: SignInPayload) {
    const response = await http.post<{
      user: {
        id: string;
        email: string;
        identifier: string;
        role: string;
        name: string;
        status: string;
        avatarRelativePath?: string;
      };
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", {
      identifier: payload.identifier,
      password: payload.password,
      expectedRole: payload.role.toUpperCase(),
    });
    const role = payload.role as AppRole;
    const avatarVersion = Date.now();
    setAuthSession(
      role,
      response.user.identifier,
      { accessToken: response.accessToken, refreshToken: response.refreshToken },
      response.user.name,
      {
        userId: response.user.id,
        email: response.user.email,
        status: response.user.status,
        avatarRelativePath: response.user.avatarRelativePath ?? "",
        avatarVersion,
      },
    );
    return {
      session: {
        role,
        identifier: response.user.identifier,
        displayName: response.user.name,
        userId: response.user.id,
        email: response.user.email,
        status: response.user.status,
        avatarRelativePath: response.user.avatarRelativePath ?? "",
        avatarVersion,
      },
      redirectTo: `/${role}/dashboard`,
    };
  },
  async activate(ref: string, token: string, password: string, confirmPassword: string) {
    return http.post<{ success: boolean; message: string }>("/auth/activate", { ref, token, password, confirmPassword });
  },
  async forgotPassword(email: string, role?: AppRole | string) {
    return http.post<{ success: boolean; message: string }>("/auth/forgot-password", { email, role });
  },
  async resetPassword(ref: string, token: string, password: string, confirmPassword: string) {
    return http.post<{ success: boolean; message: string }>("/auth/reset-password", { ref, token, password, confirmPassword });
  },
  async getCurrentUser() {
    const currentUser = await http.get<{
      id: string;
      identifier: string;
      email: string;
      role: string;
      name: string;
      status: string;
      avatarRelativePath?: string;
    }>("/auth/me");
    syncAuthSessionFromCurrentUser(currentUser);
    return currentUser;
  },
  async logout() {
    await http.logout();
  },
};

export const studentService = {
  async getDashboard(): Promise<StudentDashboardResponse> {
    if (apiRuntime.useBackend) {
      const [summary, charts, upcoming, notifications, submissionRows] = await Promise.all([
        http.get<{ pending: number; submitted: number; graded: number; overdue: number }>("/student/dashboard/summary"),
        http.get<{ statusBreakdown: { draft: number; pendingReview: number; needsRevision: number; graded: number }; subjectProgress: Array<{ subject: string; totalActivities: number; completed: number }> }>("/student/dashboard/charts"),
        http.get<Array<{ id: string; title: string; deadline: string; subjectId: string; windowStatus: string }>>("/student/dashboard/upcoming-deadlines"),
        http.get<Array<{ id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string }>>("/student/notifications"),
        http.get<Array<any>>("/student/submissions"),
      ]);
      const subjectName = (subjectId: string) => {
        const fallback = subjectId?.replace(/^subj_/, '').replace(/_/g, ' ') || 'Subject';
        return fallback.replace(/\b\w/g, (m) => m.toUpperCase());
      };
      return {
        greeting: "Welcome back, Maria!",
        subtext: "Stay on top of deadlines, progress, and recent updates.",
        kpis: [
          { label: 'Pending', value: String(summary.pending), tone: 'blue', icon: 'book' },
          { label: 'Submitted', value: String(summary.submitted), tone: 'teal', icon: 'check' },
          { label: 'Graded', value: String(summary.graded), tone: 'emerald', icon: 'star' },
          { label: 'Overdue', value: String(summary.overdue), tone: 'amber', icon: 'clock' },
        ],
        deadlines: upcoming.slice(0, 6).map((item) => {
          const dueDate = new Date(item.deadline);
          const matchingSubmission = submissionRows.find((row: any) => String(row.activityId || row.taskId || '') === String(item.id || ''));
          const status = formatSubmissionStatus(matchingSubmission?.status || 'NOT_STARTED');
          const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
          return {
            id: Number(String(item.id).replace(/\D/g, '').slice(-6) || Math.random() * 1000),
            activityId: item.id ? String(item.id) : undefined,
            subjectId: item.subjectId ? String(item.subjectId) : undefined,
            submissionId: matchingSubmission?.id ? String(matchingSubmission.id) : undefined,
            title: item.title,
            subject: subjectName(item.subjectId),
            due: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            overdue: daysLeft < 0,
            daysLeft,
            window: item.windowStatus || 'Open',
            status,
          };
        }),
        recentSubmissions: submissionRows.slice(0, 5).map((row: any, index: number) => ({
          id: String(row.id ?? index + 1),
          title: row.title,
          subject: subjectName(row.subjectId),
          date: row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          status: formatSubmissionStatus(row.status),
          grade: row.grade == null ? '—' : String(row.grade),
        })),
        notifications: notifications.slice(0, 4).map((row) => ({
          id: Number(String(row.id).replace(/\D/g, '').slice(-6) || Math.random() * 1000),
          text: row.title,
          time: new Date(row.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          type: row.type === 'grade' ? 'grade' : row.type === 'feedback' ? 'feedback' : row.type === 'overdue' ? 'overdue' : 'info',
        })),
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(studentDashboardData));
  },
  async getCalendarEvents(): Promise<CalendarEventItem[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/student/calendar/events");
      return rows.map((row: any, index: number) => {
        const dateValue = row.deadline ? new Date(row.deadline) : null;
        return {
          id: Number(String(row.id ?? index + 1).replace(/\D/g, '').slice(-6) || index + 1),
          activityId: normalizeId(row.activityId),
          subjectId: normalizeId(row.subjectId),
          submissionId: row.submissionId ? String(row.submissionId) : undefined,
          date: dateValue ? dateValue.toISOString().slice(0, 10) : '',
          displayDate: dateValue ? dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          title: row.title,
          subject: row.subjectName || row.subject || row.subjectName || row.subject || String(row.subjectId || 'Subject'),
          type: String(row.submissionMode || '').toUpperCase() === 'GROUP' ? 'Group' : 'Individual',
          window: row.windowStatus || 'Open',
          status: formatSubmissionStatus(row.submissionStatus || row.status || 'NOT_STARTED'),
        };
      });
    }
    await delay();
    return JSON.parse(JSON.stringify(studentCalendarEvents));
  },
  async getSubmitCatalog(): Promise<StudentSubmitCatalogResponse> {
    if (apiRuntime.useBackend) {
      const catalog = await http.get<StudentSubmitCatalogResponse>("/student/submit-catalog");
      return {
        subjects: catalog.subjects,
        activities: Object.fromEntries(Object.entries(catalog.activities || {}).map(([subjectName, items]) => [subjectName, (items || []).map((item) => ({
          ...item,
          id: item.id ? String(item.id) : undefined,
          subjectId: item.subjectId ? String(item.subjectId) : undefined,
          groupId: item.groupId ? String(item.groupId) : undefined,
        }))])),
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(studentSubmitCatalogData));
  },
  async uploadSubmissionFile(file: File, scope = "student-submissions") {
    if (apiRuntime.useBackend) {
      return http.uploadFile<{ id: string; uploadId: string; fileName: string; sizeBytes: number; relativePath?: string }>("/files/upload", file, { scope });
    }
    await delay(150);
    const uploadId = `upload_${Date.now()}`;
    return {
      id: uploadId,
      uploadId,
      fileName: file.name,
      sizeBytes: file.size,
      relativePath: `${scope}/${file.name}`,
    };
  },
  async submitProject(input: {
    activityId: string;
    title: string;
    description: string;
    notes?: string;
    externalLinks?: string[];
    file?: File | null;
    groupId?: string;
    groupName?: string;
    type?: "individual" | "group";
  }) {
    let uploadedFile:
      | { id: string; uploadId: string; fileName: string; sizeBytes: number; relativePath?: string }
      | null = null;

    if (input.file) {
      uploadedFile = await this.uploadSubmissionFile(input.file);
    }

    const catalog = await this.getSubmitCatalog();
    const activityEntry = Object.entries(catalog.activities).flatMap(([subjectName, items]) =>
      items.map((item) => ({ subjectName, item })),
).find(({ item }) => String(item.id) === String(input.activityId));

    if (!activityEntry) {
      throw new Error("Unable to match the selected activity to the submission catalog.");
    }

    if (apiRuntime.useBackend) {
      return http.post<any>("/student/submissions", {
        activityId: activityEntry.item.id,
        title: input.title,
        groupId: input.type === "group" ? (input.groupId || activityEntry.item.groupId) : undefined,
        files: uploadedFile
          ? [{
              uploadId: uploadedFile.uploadId,
              name: uploadedFile.fileName,
              sizeKb: Math.max(1, Math.round(uploadedFile.sizeBytes / 1024)),
            }]
          : [],
        description: input.description,
        notes: input.notes,
        externalLink: input.externalLinks?.[0],
        externalLinks: input.externalLinks,
      });
    }

    await delay(220);
    return {
      success: true,
      uploadedFile,
      activity: activityEntry.item.title,
    };
  },
  async getSubmissions(filters: { search?: string; status?: string } = {}): Promise<StudentSubmissionRow[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/student/submissions", filters.status && filters.status !== 'All' ? { status: filters.status.replace(/\s+/g, '_').toUpperCase() } : undefined);
      const q = (filters.search ?? '').toLowerCase();
      return rows.map((row: any) => ({
        id: normalizeId(row.id) || '',
        activityId: normalizeId(row.activityId || row.taskId),
        subjectId: normalizeId(row.subjectId),
        title: row.title,
        activityTitle: row.activityTitle || row.title,
        subject: row.subject || row.subjectName || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase()) || 'Subject',
        type: toSubmissionModeLabel(row.submissionMode || row.groupId),
        due: normalizeDateLabel(row.deadline),
        submitted: normalizeDateLabel(row.submittedAt),
        status: formatSubmissionStatus(row.status),
        grade: row.grade == null ? '—' : String(row.grade),
        feedback: row.feedback || 'No feedback yet.',
        description: row.description || '',
        notes: row.notes || '',
        externalLinks: Array.isArray(row.externalLinks)
          ? row.externalLinks.filter(Boolean)
          : row.externalLink
            ? [row.externalLink]
            : [],
        groupName: row.groupName,
        leader: row.members?.[0]?.name,
        members: row.members?.map((m: any) => m.name) || [],
        submittedBy: row.submittedBy || undefined,
        files: row.files?.map((f: any) => {
          if (typeof f === "string") return f;
          const label = f.name || "Attachment";
          const href = buildStoredFileDownloadUrl(f.relativePath);
          return href ? `${label}|||${href}` : label;
        }) || [],
      })).filter((s: StudentSubmissionRow) => !q || s.title.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(studentSubmissions)).filter((s: StudentSubmissionRow) => {
      const matchSearch = !q || s.title.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q);
      const matchStatus = !filters.status || filters.status === "All" || s.status === filters.status;
      return matchSearch && matchStatus;
    });
  },
  async getSubmissionDetail(id: string): Promise<StudentSubmissionRow> {
    if (apiRuntime.useBackend) {
      const row = await http.get<any>(`/student/submissions/${encodeURIComponent(String(id))}`);
      return {
        id: normalizeId(row.id) || '',
        activityId: normalizeId(row.activityId || row.taskId),
        subjectId: normalizeId(row.subjectId),
        title: row.title,
        activityTitle: row.activityTitle || row.title,
        subject: row.subjectName || row.subject || row.subjectId?.replace(/^subj_/, '').replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase()) || 'Subject',
        type: toSubmissionModeLabel(row.submissionMode || row.groupId),
        due: normalizeDateLabel(row.deadline),
        submitted: normalizeDateLabel(row.submittedAt),
        status: formatSubmissionStatus(row.status),
        grade: row.grade == null ? '—' : String(row.grade),
        feedback: row.feedback || 'No feedback yet.',
        description: row.description || '',
        notes: row.notes || '',
        externalLinks: Array.isArray(row.externalLinks) ? row.externalLinks.filter(Boolean) : row.externalLink ? [row.externalLink] : [],
        groupName: row.groupName,
        leader: row.members?.[0]?.name,
        members: row.members?.map((m: any) => m.name) || [],
        submittedBy: row.submittedBy || undefined,
        files: row.files?.map((f: any) => {
          if (typeof f === 'string') return f;
          const label = f.name || 'Attachment';
          const href = buildStoredFileDownloadUrl(f.relativePath);
          return href ? `${label}|||${href}` : label;
        }) || [],
      };
    }
    const rows = await this.getSubmissions();
    const match = rows.find((row) => String(row.id) === String(id));
    if (!match) throw new Error('Submission not found.');
    return JSON.parse(JSON.stringify(match));
  },
};

export const teacherService = {
  async getSubmissions(filters: TeacherSubmissionFilters & { subjectId?: string } = {}): Promise<TeacherSubmissionRow[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/teacher/submissions", {
        section: !filters.section || filters.section === 'All Sections' ? undefined : filters.section,
        status: !filters.status || filters.status === 'All' ? undefined : filters.status.replace(/\s+/g, '_').toUpperCase(),
        subjectId: filters.subjectId || undefined,
      });
      const q = (filters.search ?? '').toLowerCase();
      return rows.map((s: any) => ({
        id: String(s.id ?? ''),
        subjectId: s.subjectId ? String(s.subjectId) : undefined,
        activityId: s.activityId ? String(s.activityId) : undefined,
        title: s.title || s.activityTitle || 'Submission',
        owner: s.groupName || s.studentName || s.owner || s.submittedBy || 'Student',
        studentId: s.studentId ? String(s.studentId) : s.entityId ? String(s.entityId) : undefined,
        subject: s.subjectName || s.subject || s.subjectId || 'Subject',
        section: s.section || '—',
        activity: s.activityTitle || s.title || 'Submission',
        type: toSubmissionModeLabel(s.submissionMode || s.groupId),
        due: s.deadline ? new Date(s.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        submitted: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        status: formatSubmissionStatus(s.status),
        grade: s.grade == null ? '—' : String(s.grade),
      })).filter((s: TeacherSubmissionRow) => {
        const matchSearch =
          !q ||
          s.title.toLowerCase().includes(q) ||
          s.owner.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q) ||
          (s.activity || '').toLowerCase().includes(q) ||
          String(s.studentId || '').toLowerCase().includes(q);
        const matchStatus = !filters.status || filters.status === 'All' || s.status === filters.status;
        const matchSection = !filters.section || filters.section === 'All Sections' || s.section === filters.section;
        const matchSubject = !filters.subject || filters.subject === 'All Subjects' || s.subject === filters.subject;
        const matchSubjectId = !filters.subjectId || String(s.subjectId || '') === String(filters.subjectId);
        const matchType = !filters.type || filters.type === 'All Types' || s.type === filters.type;
        return matchSearch && matchStatus && matchSection && matchSubject && matchSubjectId && matchType;
      });
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(teacherSubmissions)).filter((s: TeacherSubmissionRow) => {
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        String(s.studentId || '').toLowerCase().includes(q);
      const matchStatus = !filters.status || filters.status === "All" || s.status === filters.status;
      const matchSection = !filters.section || filters.section === "All Sections" || s.section === filters.section;
      const matchSubject = !filters.subject || filters.subject === "All Subjects" || s.subject === filters.subject;
      const matchType = !filters.type || filters.type === "All Types" || s.type === filters.type;
      return matchSearch && matchStatus && matchSection && matchSubject && matchType;
    });
  },
  async getSubmissionReview(id: string): Promise<TeacherSubmissionReviewResponse> {
    if (!id) throw new Error("Submission id is required.");
    if (apiRuntime.useBackend) {
      const row = await http.get<any>(`/teacher/submissions/${id}`);
      const actionState = getReviewActionState(row.status);
      const groupMembers = Array.isArray(row.members)
        ? row.members
            .map((member: any) => {
              const name = String(member?.name || member || '').trim();
              const memberId = String(member?.id || member?.studentId || '').trim();
              if (!name && !memberId) return '';
              if (name && memberId) return `${name} (${memberId})`;
              return name || memberId;
            })
            .filter(Boolean)
        : [];
      const timeline = [{ action: 'Submission loaded', by: 'System', time: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—', type: 'info' }];
      if (row.reviewedAt) {
        timeline.push({ action: 'Marked as reviewed', by: row.reviewedBy || 'Teacher', time: new Date(row.reviewedAt).toLocaleString(), type: 'review' });
      }
      if (row.gradedAt) {
        timeline.push({ action: 'Graded', by: row.gradedBy || 'Teacher', time: new Date(row.gradedAt).toLocaleString(), type: 'grade' });
      }
      if (row.reopenedAt) {
        timeline.push({ action: 'Reopened', by: row.reopenedBy || 'Teacher', time: new Date(row.reopenedAt).toLocaleString(), type: 'reopen' });
      }
      return {
        title: row.title || row.activityTitle || 'Submission',
        subject: row.subjectName || row.subject || row.subjectId || 'Subject',
        section: row.section || 'BSIT 3A',
        due: normalizeDateLabel(row.deadline),
        student: row.studentName || row.owner || row.submittedBy || 'Student',
        studentId: row.studentId || row.entityId || '—',
        initials: (row.owner || row.submittedBy || 'ST').split(' ').map((s: string) => s[0]).join('').slice(0,2).toUpperCase(),
        description: row.description || row.feedback || row.notes || 'Submission details are available for this record.',
        feedback: row.feedback || '',
        grade: row.grade == null ? undefined : String(row.grade),
        files: (row.files || []).map((f: any) => ({
          name: f.name || f.fileName || f,
          size: f.sizeKb ? `${f.sizeKb} KB` : f.fileSize ? `${f.fileSize} KB` : '—',
          href: buildStoredFileDownloadUrl(f.relativePath),
        })),
        timeline,
        status: formatSubmissionStatus(row.status),
        activity: row.activityTitle || row.title,
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—',
        late: normalizeSubmissionStatus(row.status) === 'LATE' ? 'Late' : 'On time',
        type: toSubmissionModeLabel(row.submissionMode || row.groupId),
        groupName: row.groupName || undefined,
        submittedBy: row.submittedBy || undefined,
        groupMembers,
        allowedActions: actionState,
      };
    }
    requireBackendApi();
    await delay();
    return {
      ...JSON.parse(JSON.stringify(teacherSubmissionReviewData)),
      allowedActions: getReviewActionState((teacherSubmissionReviewData as any).status),
    };
  },
  async exportSubmissionsCsv(records: TeacherSubmissionRow[], sectionLabel = "all") {
    await delay(120);
    downloadCsv(
      `teacher-submissions-${sectionLabel.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["Title", "Student/Group", "Subject", "Section", "Type", "Due Date", "Submitted", "Status", "Grade"],
      records.map((s) => [s.title, s.owner, s.subject, s.section, s.type, s.due, s.submitted, s.status, s.grade])
    );
  },

async reviewSubmission(id: string, payload: { status?: string; grade?: number; feedback?: string }) {
  if (apiRuntime.useBackend) {
    return http.patch(`/teacher/submissions/${id}/review`, {
      status: payload.status,
      grade: payload.grade,
      feedback: payload.feedback,
    });
  }
  await delay(180);
  return { success: true };
},
};

export const adminService = {
  async getUsers(filters: AdminUserFilters = {}): Promise<AdminUserRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/users", {
        search: filters.search || undefined,
        role: !filters.role || filters.role === "All" ? undefined : filters.role,
        status: !filters.status || filters.status === "All" ? undefined : filters.status,
      });
      return rows.map((row: any) => ({
        id: String(row.id),
        displayIdentifier: String(row.displayIdentifier || row.studentNumber || row.employeeId || row.profileLabel || "—"),
        identifierLabel: String(row.identifierLabel || "Student/Employee ID"),
        profileId: row.profileId ? String(row.profileId) : null,
        email: String(row.email || ""),
        role: String(row.role || ""),
        status: String(row.status || "Unknown"),
        statusKey: String(row.statusKey || row.status || ""),
        firstName: String(row.firstName || ""),
        lastName: String(row.lastName || ""),
        phone: String(row.phone || ""),
        office: String(row.office || ""),
        createdAt: String(row.createdAt || ""),
        updatedAt: String(row.updatedAt || ""),
        profileLabel: String(row.profileLabel || "—"),
        studentNumber: row.studentNumber ? String(row.studentNumber) : null,
        employeeId: row.employeeId ? String(row.employeeId) : null,
        isSeedCandidate: Boolean(row.isSeedCandidate),
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return [] as AdminUserRecord[];
  },
  async createAdmin(payload: AdminCreateUserInput) {
    if (apiRuntime.useBackend) {
      return http.post<{
        success: boolean;
        id: string;
        email: string;
        role: string;
        status: string;
        activationQueued: boolean;
        mailJobId?: string;
      }>("/admin/users/admins", payload);
    }
    requireBackendApi();
    await delay(180);
    return {
      success: true,
      id: `admin_${Date.now()}`,
      email: payload.email,
      role: "ADMIN",
      status: "Pending Activation",
      activationQueued: payload.sendActivationEmail !== false,
    };
  },
  async activateUser(id: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; queued?: boolean; status: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/users/${id}/activate`);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, status: "Pending Password Setup" };
  },
  async deactivateUser(id: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; status: string }>(`/admin/users/${id}/deactivate`);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, status: "INACTIVE" };
  },
  async sendUserResetLink(id: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; queued?: boolean; status?: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/users/${id}/send-reset-link`);
    }
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async resendUserActivation(id: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; queued?: boolean; status?: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/users/${id}/resend-activation`);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, status: "Pending Password Setup" };
  },
  async deleteUser(id: string, confirmation: string) {
    if (apiRuntime.useBackend) {
      return http.delete<{ success: boolean; deleted: boolean }>(`/admin/users/${id}`, {
        confirmation,
      });
    }
    requireBackendApi();
    await delay(180);
    return { success: true, deleted: true };
  },
  async getDashboard(): Promise<AdminDashboardResponse> {
    if (apiRuntime.useBackend) {
      const [summary, activity, academicSettings, live, ready, storage, mail, database] = await Promise.all([
        http.get<{ totalStudents: number; totalTeachers: number; totalSubjects: number; totalSubmissions: number; pendingReviews: number }>("/admin/dashboard/summary"),
        http.get<Array<any>>("/admin/dashboard/activity"),
        http.get<any>("/admin/settings/academic"),
        http.get<any>("/health/live"),
        http.get<any>("/health/ready"),
        http.get<any>("/health/storage"),
        http.get<any>("/health/mail"),
        http.get<any>("/health/database"),
      ]);
      const systemStatus = [
        {
          label: "Backend Service",
          status: live?.ok ? "Live" : "Unavailable",
          good: Boolean(live?.ok),
        },
        {
          label: "Database",
          status: database?.ok ? "Ready" : "Needs Attention",
          good: Boolean(database?.ok),
        },
        {
          label: "File Storage",
          status: storage?.ok ? "Ready" : "Needs Attention",
          good: Boolean(storage?.ok),
        },
        {
          label: "Mail Delivery",
          status: mail?.ok ? "Ready" : "Needs Attention",
          good: Boolean(mail?.ok),
        },
      ];
      const healthySystems = systemStatus.filter((item) => item.good).length;
      const readinessFailures = Object.entries(ready?.checks || {})
        .filter(([, ok]) => !ok)
        .map(([key]) => key.replace(/\b\w/g, (match) => match.toUpperCase()));

      return {
        title: 'Admin Dashboard',
        subtitle: ready?.ok
          ? 'System summary for PROJTRACK. Core readiness checks are green.'
          : `System summary for PROJTRACK. Readiness is currently blocked by ${readinessFailures.join(", ") || "one or more subsystems"}.`,
        kpis: [
          { label: 'Total Students', value: String(summary.totalStudents), icon: 'users', color: 'text-blue-700', bg: 'bg-blue-50', delta: 'current' },
          { label: 'Total Teachers', value: String(summary.totalTeachers), icon: 'book', color: 'text-teal-700', bg: 'bg-teal-50', delta: 'current' },
          { label: 'Total Subjects', value: String(summary.totalSubjects), icon: 'layers', color: 'text-violet-700', bg: 'bg-violet-50', delta: 'current' },
          { label: 'Total Submissions', value: String(summary.totalSubmissions), icon: 'file', color: 'text-emerald-700', bg: 'bg-emerald-50', delta: 'current' },
          { label: 'Pending Reviews', value: String(summary.pendingReviews), icon: 'inbox', color: 'text-amber-700', bg: 'bg-amber-50', delta: 'attention' },
          {
            label: 'Healthy Systems',
            value: `${healthySystems}/${systemStatus.length}`,
            icon: 'grid',
            color: healthySystems === systemStatus.length ? 'text-slate-700' : 'text-amber-700',
            bg: healthySystems === systemStatus.length ? 'bg-slate-100' : 'bg-amber-50',
            delta: ready?.ok ? 'healthy' : 'needs attention',
          },
        ],
        submissionTrend: [
          { month: 'Jan', count: Math.max(1, Math.round(summary.totalSubmissions * 0.18)) },
          { month: 'Feb', count: Math.max(1, Math.round(summary.totalSubmissions * 0.22)) },
          { month: 'Mar', count: Math.max(1, Math.round(summary.totalSubmissions * 0.28)) },
          { month: 'Apr', count: Math.max(1, Math.round(summary.totalSubmissions * 0.32)) },
        ],
        statusDist: [
          { name: 'Pending Review', value: summary.pendingReviews, fill: '#0f766e' },
          { name: 'Reviewed', value: Math.max(0, summary.totalSubmissions - summary.pendingReviews), fill: '#1d4ed8' },
        ],
        recentActivity: activity.slice(0, 8).map((item: any) => ({
          action: item.action,
          user: item.actorRole,
          target: item.target,
          time: new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          type: item.module,
        })),
        systemStatus,
        currentTerm: {
          schoolYear: academicSettings?.schoolYear || "Not configured",
          semester: academicSettings?.semester || "Not configured",
          detail:
            academicSettings?.periodStart && academicSettings?.periodEnd
              ? `${academicSettings.periodStart} to ${academicSettings.periodEnd}`
              : "Configure dates in Academic Settings.",
        },
      };
    }
    requireBackendApi();
    await delay();
    return JSON.parse(JSON.stringify(adminDashboardData));
  },
  async getSubmissions(filters: AdminSubmissionFilters = {}): Promise<AdminSubmissionRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/submissions", {
        search: filters.search || undefined,
        status: !filters.status || filters.status === "All" ? undefined : filters.status.replace(/\s+/g, "_").toUpperCase(),
        subjectId: filters.subjectId || undefined,
        studentId: filters.studentId || undefined,
        section: !filters.section || filters.section === "All" ? undefined : filters.section,
      });
      return rows.map((row: any) => ({
        id: normalizeId(row.id) || "",
        title: String(row.title || ""),
        student: String(row.student || row.ownerLabel || "—"),
        teacher: String(row.teacher || "—"),
        subject: String(row.subject || "—"),
        section: String(row.section || "—"),
        due: normalizeDateTimeLabel(row.due) || "—",
        submitted: normalizeDateTimeLabel(row.submitted) || "—",
        status: formatSubmissionStatus(row.status || ""),
        grade: row.grade == null ? "—" : String(row.grade),
        statusKey: String(row.statusKey || row.status || ""),
        subjectCode: String(row.subjectCode || ""),
        taskId: normalizeId(row.taskId),
        taskTitle: String(row.taskTitle || row.title || ""),
        subjectId: normalizeId(row.subjectId),
        studentId: row.studentId ? String(row.studentId) : null,
        studentNumber: row.studentNumber ? String(row.studentNumber) : null,
        groupId: row.groupId ? String(row.groupId) : null,
        ownerLabel: String(row.ownerLabel || row.student || "—"),
        feedback: String(row.feedback || ""),
        notes: String(row.notes || ""),
        externalLinks: Array.isArray(row.externalLinks) ? row.externalLinks.map((item: unknown) => String(item)) : [],
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminSubmissionsData)).filter((s: AdminSubmissionRecord) => {
      const matchSearch = !q || s.title.toLowerCase().includes(q) || s.student.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q);
      const matchStatus = !filters.status || filters.status === "All" || s.status === filters.status;
      return matchSearch && matchStatus;
    });
  },
  async exportSubmissionsCsv(records: AdminSubmissionRecord[]) {
    await delay(120);
    downloadCsv(
      `admin-submissions-current-view.csv`,
      ["Title", "Student", "Teacher", "Subject", "Section", "Due", "Submitted", "Status", "Grade"],
      records.map((s) => [s.title, s.student, s.teacher, s.subject, s.section, s.due, s.submitted, s.status, s.grade])
    );
  },
  async createSubmission(payload: AdminSubmissionUpsertInput) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string; status: string }>("/admin/submissions", payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id: `submission_${Date.now()}`, status: payload.status };
  },
  async updateSubmission(id: string, payload: Partial<AdminSubmissionUpsertInput>) {
    if (apiRuntime.useBackend) {
      return http.patch<{ success: boolean; id: string; status: string }>(`/admin/submissions/${id}`, payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id, status: String(payload.status || "UPDATED") };
  },
  async deleteSubmission(id: string, confirmation: string) {
    if (apiRuntime.useBackend) {
      return http.delete<{ success: boolean; deleted: boolean }>(`/admin/submissions/${id}`, {
        confirmation,
      });
    }
    requireBackendApi();
    await delay(180);
    return { success: true, deleted: true };
  },

async getAuditLogDetail(id: string): Promise<AuditLogRecord> {
  if (apiRuntime.useBackend) {
    const row = await http.get<any>(`/admin/audit-logs/${id}`);
      return {
        id: String(row.id),
        action: row.action,
        module: row.module,
        user: row.actorName || row.actorUserId || 'System',
        actorUserId: row.actorUserId ? String(row.actorUserId) : null,
        actorEmail: row.actor?.email ? String(row.actor.email) : null,
        target: row.target || '—',
      time: new Date(row.timestamp || row.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      role: toAuditRole(row.actorRole),
      ip: row.ipAddress || '127.0.0.1',
      entityId: row.entityId || '—',
      result: row.result === 'Failed' ? 'Failed' : row.result === 'Queued' ? 'Queued' : 'Success',
      session: row.sessionId || 'sess_backend_live',
      details: row.details || '',
      before: row.beforeValue,
      after: row.afterValue,
    };
  }
  await delay();
  const rows = await this.getAuditLogs();
  return rows.find((row) => String(row.id) === String(id)) ?? rows[0];
},

  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/audit-logs", {
        module: !filters.module || filters.module === 'All' ? undefined : filters.module,
      });
      const q = (filters.search ?? '').toLowerCase();
        return rows.map((l: any, index: number): AuditLogRecord => ({
          id: String(l.id ?? index + 1),
          action: String(l.action ?? ''),
          module: String(l.module ?? ''),
          user: String(l.actor?.email || l.actorUserId || l.actorRole || 'System'),
          actorUserId: l.actorUserId ? String(l.actorUserId) : null,
          actorEmail: l.actor?.email ? String(l.actor.email) : null,
          target: String(l.target ?? '—'),
        time: new Date(l.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        role: toAuditRole(l.actorRole),
        ip: String(l.ipAddress || '127.0.0.1'),
        entityId: String(l.entityId || '—'),
        result: (l.result === 'Failed' ? 'Failed' : l.result === 'Queued' ? 'Queued' : 'Success') as AuditLogRecord['result'],
        session: String(l.sessionId || 'sess_backend_live'),
        details: String(l.details || '—'),
        before: l.beforeValue,
        after: l.afterValue,
      })).filter((l: AuditLogRecord) => {
        const matchesSearch = !q || l.action.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
        const matchesModule = !filters.module || filters.module === 'All' || l.module === filters.module;
        return matchesSearch && matchesModule;
      });
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(auditLogs)).filter((l: AuditLogRecord) => {
      const matchesSearch = !q || l.action.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
      const matchesModule = !filters.module || filters.module === "All" || l.module === filters.module;
      return matchesSearch && matchesModule;
    });
  },
  async getReports(filters: AdminReportsFilters = {}): Promise<AdminReportsResponse> {
  if (apiRuntime.useBackend) {
    const payload = await http.get<AdminReportsResponse>("/admin/reports/dashboard", {
      section: !filters.section || filters.section === "All Sections" ? undefined : filters.section,
    });
    return payload;
  }
  await delay();
  return JSON.parse(JSON.stringify(adminReportsData));
},
  async exportReportsCsv(rows: AdminReportsResponse["tableRows"], sectionLabel = "all-sections") {
    if (apiRuntime.useBackend) {
      const payload = await http.get<{ filename?: string; csv?: string }>("/admin/reports/export", {
        section: sectionLabel === "All Sections" ? undefined : sectionLabel,
      });
      if (!payload?.csv) {
        throw new Error("Report export did not return CSV content.");
      }
      const blob = new Blob([payload.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename || `admin-reports-${sectionLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    await delay(120);
    downloadCsv(
      `admin-reports-${sectionLabel.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["Subject", "Section", "Completion Rate", "Pending", "Graded", "Average Review Time"],
      rows.map((row) => [row.subject, row.section, row.completionRate, row.pending, row.graded, row.avgReview])
    );
  },

async getFileInventory(scope?: string) {
  if (apiRuntime.useBackend) {
    const rows = await http.get<Array<any>>("/files", { scope });
    return rows.map((row: any) => ({
      storedName: row.storedName,
      fileName: row.fileName || row.storedName,
      scope: row.scope,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.uploadedAt || row.modifiedAt,
      uploadedByUserId: row.uploadedByUserId,
      submissionId: row.submissionId,
      subjectId: row.subjectId,
      relativePath: row.relativePath,
      href: buildStoredFileDownloadUrl(row.relativePath),
    }));
  }
  await delay(120);
  return [];
},

async downloadInventoryFile(relativePath: string, fileName?: string) {
  return downloadStoredFile(relativePath, fileName);
},

async deleteInventoryFile(relativePath: string) {
  return http.delete<{ ok: boolean }>(toStoredFileDeletePath(relativePath));
},

async getBackupHistory(): Promise<BackupHistoryResponse> {
  if (apiRuntime.useBackend) {
    return http.get<BackupHistoryResponse>("/admin/backups");
  }
  requireBackendApi();
  throw new Error("Backend API access is required.");
  await delay();
  return {
    latestSuccessful: null,
    oldestAvailable: null,
    totalBackups: 0,
    failedBackups: 0,
    storageUsedBytes: 0,
    nextAutomaticBackup: null,
    rows: [],
  };
},

async getBackupSettings(): Promise<BackupSettingsResponse> {
  if (apiRuntime.useBackend) {
    return http.get<BackupSettingsResponse>("/admin/backups/settings");
  }
  requireBackendApi();
  throw new Error("Backend API access is required.");
},

async updateBackupSettings(payload: Partial<BackupSettingsResponse>): Promise<BackupSettingsResponse> {
  if (apiRuntime.useBackend) {
    return http.patch<BackupSettingsResponse>("/admin/backups/settings", payload);
  }
  requireBackendApi();
  throw new Error("Backend API access is required.");
},

async runBackupNow(): Promise<BackupRunRecord> {
  if (apiRuntime.useBackend) {
    return http.post<BackupRunRecord>("/admin/backups/run", { backupType: "full" });
  }
  requireBackendApi();
  await delay();
  throw new Error("Backend API access is required.");
},

async getBackupDetail(id: string): Promise<BackupDetailResponse> {
  return http.get<BackupDetailResponse>(`/admin/backups/${id}`);
},

async protectBackup(id: string, protectedValue: boolean, confirmation?: string): Promise<BackupRunRecord> {
  return http.post<BackupRunRecord>(
    `/admin/backups/${id}/${protectedValue ? "protect" : "unprotect"}`,
    {},
    protectedValue ? undefined : { confirmation },
  );
},

async deleteBackup(id: string, confirmation: string): Promise<BackupRunRecord> {
  return http.delete<BackupRunRecord>(`/admin/backups/${id}`, { confirmation });
},

async restoreBackup(id: string, confirmation: string) {
  return http.post<{ success?: boolean; message?: string }>(`/admin/backups/${id}/restore`, { confirmation });
},

async validateBackup(id: string) {
  return http.post<{ success: boolean; expectedSha256: string; actualSha256: string }>(`/admin/backups/${id}/validate`, {});
},

async getBackupManifest(id: string) {
  return http.get<Record<string, unknown>>(`/admin/backups/${id}/manifest`);
},

async downloadBackup(id: string, fileName?: string) {
  const response = await http.getBlob(`/admin/backups/${id}/download`);
  downloadBlobFile(response.blob, response.fileName || fileName || "projtrack-backup.json");
},

async getSystemHealth(): Promise<SystemHealthRecord[]> {
  if (apiRuntime.useBackend) {
    const [live, ready, storage, mail, database, backups, configuration] = await Promise.all([
      http.get<any>("/health/live"),
      http.get<any>("/health/ready"),
      http.get<any>("/health/storage"),
      http.get<any>("/health/mail"),
      http.get<any>("/health/database"),
      http.get<any>("/health/backups"),
      http.get<any>("/health/configuration"),
    ]);
    const failingReadinessChecks = Object.entries(ready?.checks || {})
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

    return [
      {
        key: "backend",
        label: "Backend Service",
        ok: Boolean(live?.ok),
        detail: !live?.ok
          ? "Backend liveness check failed."
          : failingReadinessChecks.length
            ? `Backend is live, but readiness is failing for ${failingReadinessChecks.join(", ")}.`
            : "Backend liveness and readiness checks passed.",
        checkedAt: ready?.timestamp || live?.timestamp || new Date().toISOString(),
      },
      {
        key: "storage",
        label: "Object Storage",
        ok: Boolean(storage?.ok),
        detail: storage?.detail || (storage?.uploadsPath || "uploads"),
        checkedAt: storage?.timestamp || new Date().toISOString(),
      },
      {
        key: "mail",
        label: "Mail Delivery",
        ok: Boolean(mail?.ok),
        detail: mail?.detail || `${mail?.provider || "stub"} · ${mail?.from || "noreply"}`,
        checkedAt: mail?.timestamp || new Date().toISOString(),
      },
      {
        key: "database",
        label: "Database Readiness",
        ok: Boolean(database?.ok),
        detail: database?.detail || `${database?.persistenceMode || "prisma"} mode`,
        checkedAt: database?.timestamp || new Date().toISOString(),
      },
      {
        key: "environment",
        label: "Environment Config",
        ok: Boolean(configuration?.ok),
        detail: configuration?.detail || (configuration?.ok ? "Runtime configuration passed." : "Runtime configuration needs attention."),
        checkedAt: new Date().toISOString(),
      },
      {
        key: "backups",
        label: "Latest Backup",
        ok: Boolean(backups?.ok),
        detail: backups?.detail || "Backup status unavailable.",
        checkedAt: backups?.timestamp || new Date().toISOString(),
      },
      {
        key: "backup-worker",
        label: "Backup Worker",
        ok: Boolean(backups?.worker?.enabled ? backups?.worker?.running : true),
        detail: backups?.worker?.enabled ? "Backup worker is enabled." : "Backup worker disabled for this process.",
        checkedAt: backups?.timestamp || new Date().toISOString(),
      },
      {
        key: "mail-worker",
        label: "Mail Worker",
        ok: Boolean(mail?.worker?.enabled ? mail?.worker?.running : true),
        detail: mail?.worker?.enabled ? "Mail worker is enabled." : "Mail worker disabled for this process.",
        checkedAt: mail?.timestamp || new Date().toISOString(),
      },
    ];
  }

  await delay(120);
  return [
    { key: "backend", label: "Backend Service", ok: true, detail: "reachable", checkedAt: new Date().toISOString() },
    { key: "storage", label: "File Storage", ok: true, detail: "local uploads", checkedAt: new Date().toISOString() },
    { key: "mail", label: "Mail Provider", ok: true, detail: "stub", checkedAt: new Date().toISOString() },
    { key: "database", label: "Database Config", ok: false, detail: "not configured", checkedAt: new Date().toISOString() },
  ];
},

async getClientErrorTelemetry(): Promise<ClientErrorTelemetryResponse> {
  if (apiRuntime.useBackend) {
    return http.get<ClientErrorTelemetryResponse>("/monitoring/client-errors");
  }

  await delay(80);
  return {
    count: 0,
    items: [],
  };
},

async getReleaseStatus(): Promise<ReleaseStatusItem[]> {
  if (apiRuntime.useBackend) {
    const [live, ready, storage, mail, database] = await Promise.all([
      http.get<any>("/health/live"),
      http.get<any>("/health/ready"),
      http.get<any>("/health/storage"),
      http.get<any>("/health/mail"),
      http.get<any>("/health/database"),
    ]);
    const readinessFailures = Object.entries(ready?.checks || {})
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

      return [
        { area: "Frontend UI", status: "done", detail: "Primary student, teacher, and admin pages are active in official mode." },
        {
          area: "Auth",
          status: live?.ok && database?.ok ? "done" : "pending",
          detail: live?.ok && database?.ok
            ? "Authentication endpoints, session wiring, and backend dependencies are available."
            : "Auth still depends on backend/database readiness before it can be considered release-safe.",
        },
        {
          area: "Database",
          status: database?.ok ? "done" : "pending",
          detail: database?.detail || "Database readiness has not been verified.",
        },
        {
          area: "Files",
          status: storage?.ok ? "done" : "pending",
          detail: storage?.detail || "File storage is not yet reporting healthy status.",
        },
        {
          area: "Mail",
          status: mail?.ok ? "done" : "pending",
          detail: mail?.detail || "Mail delivery is still using stub mode.",
        },
        {
          area: "Production Readiness",
          status: ready?.ok ? "done" : "pending",
          detail: ready?.ok
            ? "Core readiness probes are green and the main release gates are currently passing."
            : `Readiness is still blocked by ${readinessFailures.join(", ") || "one or more subsystems"}.`,
        },
      ];
  }
  await delay(80);
    return [
      { area: "Frontend UI", status: "done", detail: "Primary student, teacher, and admin pages are available." },
      { area: "Auth", status: "done", detail: "Auth service wiring is available." },
      { area: "Database", status: "pending", detail: "Database configuration still needs to be completed." },
      { area: "Files", status: "done", detail: "Local file linkage works." },
      { area: "Mail", status: "pending", detail: "Mail delivery is still using stub mode." },
      { area: "Production Readiness", status: "pending", detail: "Final QA and release hardening are still required." },
    ];
},


async getBootstrapGuide(): Promise<BootstrapStepItem[]> {
  if (apiRuntime.useBackend) {
    const [live, ready, storage, mail, database] = await Promise.all([
      http.get<any>("/health/live"),
      http.get<any>("/health/ready"),
      http.get<any>("/health/storage"),
      http.get<any>("/health/mail"),
      http.get<any>("/health/database"),
    ]);
    const failingChecks = Object.entries(ready?.checks || {})
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

    return [
      {
        title: "Backend service",
        status: live?.ok ? "ready" : "action_needed",
        detail: !live?.ok
          ? "Backend did not report healthy status."
          : ready?.ok
            ? "Backend liveness and readiness checks passed."
            : `Backend liveness is healthy. Remaining blockers: ${failingChecks.join(", ") || "one or more subsystems"}.`,
      },
      {
        title: "Uploads storage",
        status: storage?.ok ? "ready" : "action_needed",
        detail: storage?.detail || `Storage path: ${storage?.uploadsPath || "uploads"}`,
      },
      {
        title: "Mail configuration",
        status: mail?.ok ? "ready" : "action_needed",
        detail: mail?.detail || `Mail provider: ${mail?.provider || "configured"} · From: ${mail?.from || "noreply@projtrack.local"}`,
      },
      {
        title: "Database configuration",
        status: database?.ok ? "ready" : "action_needed",
        detail: database?.detail || "DATABASE_URL is not configured yet.",
      },
      {
        title: "Prisma migration step",
        status: database?.ok ? "ready" : "action_needed",
        detail: database?.ok
          ? "Migration records are reachable and currently healthy."
          : "Database readiness must pass before Prisma deploy-time migration can be trusted.",
      },
    ];
  }

  await delay(80);
    return [
      { title: "Backend service", status: "ready", detail: "Backend service is available." },
      { title: "Uploads storage", status: "ready", detail: "Local uploads storage is enabled." },
      { title: "Mail configuration", status: "info", detail: "Mail delivery configuration still needs review before release." },
      { title: "Database configuration", status: "action_needed", detail: "Configure the real database connection to continue official-mode cutover." },
      { title: "Prisma migration step", status: "action_needed", detail: "Run the Prisma generate, migrate, and seed flow after database setup." },
  ];
},


async getMailRuntimeStatus(): Promise<MailRuntimeStatus> {
  if (apiRuntime.useBackend) {
    const status = await http.get<any>("/health/mail");
    const worker = status?.worker || {};
    const latestProcessed = status?.latestProcessedJob || null;
    const senderConfig = status?.senderConfig || {};
    return {
      provider: String(status?.providerName ?? status?.provider ?? "unknown"),
      deliveryMode: status?.deliveryMode ? String(status.deliveryMode) : null,
      realDeliveryActive: Boolean(status?.realDeliveryActive),
      localStub: Boolean(status?.localStub),
      workerHealthy: typeof status?.workerHealthy === "boolean" ? status.workerHealthy : undefined,
      dedicatedWorkerHealthy:
        typeof status?.dedicatedWorkerHealthy === "boolean"
          ? status.dedicatedWorkerHealthy
          : typeof status?.workerHealthy === "boolean"
            ? status.workerHealthy
            : undefined,
      dedicatedWorkerProvider: status?.dedicatedWorkerProvider ? String(status.dedicatedWorkerProvider) : worker.provider ?? null,
      heartbeatFresh: typeof status?.heartbeatFresh === "boolean" ? status.heartbeatFresh : undefined,
      heartbeatProviderMatches:
        typeof status?.heartbeatProviderMatches === "boolean" ? status.heartbeatProviderMatches : undefined,
      workerHeartbeatAgeSeconds:
        typeof status?.workerHeartbeatAgeSeconds === "number"
          ? status.workerHeartbeatAgeSeconds
          : null,
      workerEnabled: typeof worker.enabled === "boolean" ? worker.enabled : null,
      workerRunning: typeof worker.running === "boolean" ? worker.running : null,
      apiProcessWorkerEnabled:
        typeof status?.apiProcessWorkerEnabled === "boolean"
          ? status.apiProcessWorkerEnabled
          : typeof worker.enabled === "boolean"
            ? worker.enabled
            : null,
      apiProcessWorkerRunning:
        typeof status?.apiProcessWorkerRunning === "boolean"
          ? status.apiProcessWorkerRunning
          : typeof worker.running === "boolean"
            ? worker.running
            : null,
      workerId: worker.workerId ?? null,
      workerPollMs: typeof worker.pollMs === "number" ? worker.pollMs : null,
      workerLastHeartbeatAt: worker.lastHeartbeatAt ?? null,
      workerLastProcessedAt: worker.lastProcessedJobAt ?? null,
      queueDepth: Number(status?.queueDepth ?? status?.queued ?? 0),
      queuedCount: Number(status?.queued ?? 0),
      processingCount: Number(status?.processing ?? 0),
      queuedTooLongCount: Number(status?.queuedTooLongCount ?? 0),
      processingTooLongCount: Number(status?.processingTooLongCount ?? 0),
      failedCount: Number(status?.failed ?? 0),
      deadCount: Number(status?.dead ?? 0),
      archivedCount: Number(status?.archived ?? 0),
      recentDeadCount: Number(status?.recentDeadCount ?? 0),
      pausedLimitReached: Number(status?.pausedLimitReached ?? 0),
      sent24h: Number(status?.sent24h ?? 0),
      latestSentAt: status?.latestSentAt ?? null,
      latestProcessedAt: latestProcessed?.lastAttemptAt ?? latestProcessed?.updatedAt ?? null,
      latestFailureReason: status?.latestFailureReason ?? null,
      latestSafeProviderError: status?.latestSafeProviderError ?? status?.recentFailure?.message ?? null,
      recentFailureReason: status?.recentFailureReason ?? status?.recentFailure?.failureReason ?? null,
      recentFailureSafeMessage: status?.recentFailureSafeMessage ?? status?.recentFailure?.message ?? null,
      senderConfig: {
        fromName: senderConfig.fromName ?? null,
        admin: senderConfig.admin ?? null,
        noreply: senderConfig.noreply ?? null,
        invite: senderConfig.invite ?? null,
        notification: senderConfig.notification ?? null,
        support: senderConfig.support ?? null,
      },
      senderConfigIssues: Array.isArray(status?.senderConfigIssues)
        ? status.senderConfigIssues.map((item: unknown) => String(item))
        : [],
      alerts: Array.isArray(status?.alerts)
        ? status.alerts.map((item: any) => ({
            code: String(item?.code ?? "MAIL_ALERT"),
            severity:
              item?.severity === "error" || item?.severity === "warning" || item?.severity === "info"
                ? item.severity
                : "info",
            message: String(item?.message ?? ""),
          }))
        : [],
      detail: status?.detail ? String(status.detail) : undefined,
    };
  }
  requireBackendApi();
  throw new Error("Backend API access is required.");
},

async retryMailJob(id: string, force = false) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/mail-jobs/${id}/retry`, { force });
  }
  await delay(120);
  return { success: true, id };
},

async retryMailJobs(ids: string[], force = false) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/mail-jobs/retry`, { ids, force });
  }
  await delay(120);
  return { success: true, retriedCount: ids.length, blockedCount: 0, missingCount: 0, retriedIds: ids, blocked: [], missingIds: [] };
},

async cancelMailJob(id: string) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/mail-jobs/${id}/cancel`, {});
  }
  await delay(120);
  return { success: true, id };
},

async archiveMailJob(id: string) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/mail-jobs/${id}/archive`, {});
  }
  await delay(120);
  return { success: true, id };
},

async archiveOldMailJobs(olderThanDays = 30) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/mail-jobs/archive-old`, { olderThanDays });
  }
  await delay(120);
  return { success: true, archivedCount: 0, olderThanDays };
},

async sendTestMail(to: string) {
  if (apiRuntime.useBackend) {
    const result = await http.post<{ success: boolean; queued: boolean; provider: string; status: string; jobId?: string | null; providerMessageId?: string | null; detail?: string }>("/admin/mail/test", { to });
    if (!result?.jobId) {
      throw new Error("Mail queue did not return a confirmed MailJob ID. No success message was shown.");
    }
    return { ...result, jobId: result.jobId };
  }
  requireBackendApi();
  throw new Error("Backend API access is required.");
},

  async getMailJobs(includeArchived = false): Promise<MailJobRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/mail-jobs", includeArchived ? { includeArchived: "true" } : undefined);
        return rows.map((row: any) => ({
          id: String(row.id),
          to: String(row.userEmail ?? row.originalRecipient ?? row.recipient?.email ?? ""),
          recipient: {
            email: String(row.recipient?.email ?? row.userEmail ?? row.originalRecipient ?? ""),
            userId: row.recipient?.userId ? String(row.recipient.userId) : undefined,
            role: row.recipient?.role ? String(row.recipient.role) : undefined,
            fullName: row.recipient?.fullName ? String(row.recipient.fullName) : undefined,
            studentId: row.recipient?.studentId ? String(row.recipient.studentId) : undefined,
            teacherId: row.recipient?.teacherId ? String(row.recipient.teacherId) : undefined,
            employeeId: row.recipient?.employeeId ? String(row.recipient.employeeId) : undefined,
            isExternal: Boolean(row.recipient?.isExternal ?? !row.recipient?.userId),
          },
          deliveryRecipient: row.deliveryRecipient ? String(row.deliveryRecipient) : undefined,
        routedToTestmail: Boolean(row.routedToTestmail),
        fromEmail: row.fromEmail ? String(row.fromEmail) : undefined,
        template: String(row.templateKey ?? row.emailType ?? ""),
        status: (() => {
          const normalized = String(row.status || "queued").toLowerCase();
          if (normalized === "paused_limit_reached") return "failed" as MailJobRecord["status"];
          return ["queued", "processing", "sent", "failed", "dead", "cancelled"].includes(normalized)
            ? (normalized as MailJobRecord["status"])
            : "queued";
        })(),
        createdAt: new Date(row.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        sentAt: row.sentAt ? new Date(row.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : undefined,
        archivedAt: row.archivedAt ? new Date(row.archivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : undefined,
        provider: row.provider,
        attempts: typeof row.attempts === "number" ? row.attempts : undefined,
        maxAttempts: typeof row.maxAttempts === "number" ? row.maxAttempts : undefined,
        retryableFailure: typeof row.retryableFailure === "boolean" ? row.retryableFailure : undefined,
        lastAttemptAt: row.lastAttemptAt ? new Date(row.lastAttemptAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : undefined,
        nextAttemptAt: (row.scheduledAt || row.nextAttemptAt)
          ? new Date(row.scheduledAt || row.nextAttemptAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          : undefined,
        lastError: row.lastError ? String(row.lastError) : undefined,
        failureHint: row.failureHint ? String(row.failureHint) : undefined,
        failureReason: row.failureReason ? String(row.failureReason) : undefined,
        providerMessageId: row.providerMessageId ? String(row.providerMessageId) : undefined,
      }));
    }
  requireBackendApi();
  return [];
},


async markNotificationRead(id: string) {
  if (apiRuntime.useBackend) {
    return http.post(`/admin/notifications/${id}/read`, {});
  }
  await delay(120);
  return { success: true, id };
},

async markAllNotificationsRead() {
  if (apiRuntime.useBackend) {
    return http.post("/admin/notifications/read-all", {});
  }
  await delay(120);
  return { success: true };
},

async deleteNotifications(ids: string[]) {
  const normalizedIds = Array.from(new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (apiRuntime.useBackend) {
    return http.post<{ success: boolean; count: number }>("/admin/notifications/delete", {
      ids: normalizedIds,
    });
  }
  await delay(120);
  let count = 0;
  normalizedIds.forEach((id) => {
    const index = adminNotifications.findIndex((item) => String(item.id) === id);
    if (index >= 0) {
      adminNotifications.splice(index, 1);
      count += 1;
    }
  });
  return { success: true, count };
},

  async getNotifications(filters: AdminNotificationsFilters = {}): Promise<AdminNotificationRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/notifications", {
        type: !filters.type || filters.type === "All" ? undefined : filters.type.toLowerCase(),
      });
        return rows.map((n: any) => ({
          id: String(n.id),
          userId: n.userId ? String(n.userId) : null,
          dedupeKey: n.dedupeKey ? String(n.dedupeKey) : null,
          date: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: toAdminNotificationType(n.type),
        read: !!(n.isRead ?? n.read),
        title: n.title,
        body: n.body,
        time: new Date(n.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      })).filter((n: AdminNotificationRecord) => !filters.type || filters.type === 'All' || n.type === filters.type.toLowerCase());
    }
    await delay();
    return JSON.parse(JSON.stringify(adminNotifications)).map((n: AdminNotificationRecord, index: number) => ({
      ...n,
      id: String(n.id ?? index + 1),
    })).filter((n: AdminNotificationRecord) => !filters.type || filters.type === "All" || n.type === filters.type.toLowerCase());
  },
  async getStudents(filters: AdminStudentFilters = {}): Promise<AdminStudentRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/students", {
        search: filters.search || undefined,
        status: !filters.status || filters.status === "All" ? undefined : filters.status,
      });
      return rows.map((s: any) => ({
        id: String(s.id),
        studentId: String(s.studentId || s.studentNumber || s.id),
        firstName: String(s.firstName || ""),
        lastName: String(s.lastName || ""),
        middleInitial: String(s.middleInitial || "").trim(),
        academicYear: String(s.academicYear || s.schoolYear || "—"),
        yearLevel: String(s.yearLevel || "—"),
        course: String(s.course || "—"),
        name:
          String(s.name || "").trim() ||
          [s.firstName, s.lastName].filter(Boolean).join(" ").trim() ||
          "Unknown Student",
        email: String(s.email || "—"),
        sectionId: String(s.sectionId || ""),
        section: String(s.section || "—"),
        status: s.status,
        createdBy: s.createdBy || "Admin",
        lastActive: s.lastActive ? new Date(s.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminStudentsData))
      .map((s: any) => {
        const name = String(s.name || "").trim();
        const [firstName = "", ...lastNameParts] = name.split(" ");
        return {
          ...s,
          firstName: String(s.firstName || firstName),
          lastName: String(s.lastName || lastNameParts.join(" ")),
          middleInitial: String(s.middleInitial || "").trim(),
          yearLevel: String(s.yearLevel || "—"),
          course: String(s.course || "—"),
        } as AdminStudentRecord;
      })
      .filter((s: AdminStudentRecord) => {
        const studentId = String(s.studentId || s.id || "").toLowerCase();
        const matchSearch = !q || s.name.toLowerCase().includes(q) || studentId.includes(q) || s.email.toLowerCase().includes(q);
        const matchStatus = !filters.status || filters.status === "All" || s.status === filters.status;
        return matchSearch && matchStatus;
      });
  },
  async createStudent(payload: AdminStudentUpsertInput) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string }>("/admin/students", payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id: `student_${Date.now()}` };
  },
  async updateStudent(id: string, payload: AdminStudentUpsertInput) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string }>(`/admin/students/${id}`, payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id };
  },
  async downloadStudentTemplate() {
    if (apiRuntime.useBackend) {
      const template = await http.get<{ columns: string[]; sample: Record<string, string> }>("/admin/students/template");
      const sampleRow = template.columns.map((column) => template.sample[column] ?? "").join(",");
      const csv = `${template.columns.join(",")}
${sampleRow}
`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "projtrack-student-import-template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    await delay(120);
    const csv = `${templateHeaders.join(",")}
STU-2026-00152,Lia,M,Navarro,lia.n@school.edu.ph,2025-2026,BSIT,Bachelor of Science in Information Technology,3rd Year,BSIT 3991
`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "projtrack-student-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async parseStudentImport(file: File, existingStudents: AdminStudentRecord[]) {
    if (apiRuntime.useBackend) {
      const backendPayload = isSpreadsheetFile(file)
        ? {
            fileName: file.name,
            fileType: "xlsx" as const,
            fileBase64: await fileToBase64(file),
          }
        : isCsvLikeFile(file)
          ? {
              fileName: file.name,
              fileType: "csv" as const,
              csvText: await file.text(),
            }
          : null;

      if (!backendPayload) {
        throw new Error("Unsupported import file. Please upload .xlsx, .xls, .csv, or .tsv.");
      }

      const response = await http.post<{ batchId: string; preview: Array<{ index: number; row: any; issues: string[] }> }>("/admin/students/import", backendPayload);
      lastStudentImportBatchId = response.batchId;
      return response.preview.map((item) => ({
        sourceIndex: item.row?.sourceIndex ?? item.index,
        student_id: item.row.student_id ?? "",
        last_name: item.row.last_name ?? "",
        first_name: item.row.first_name ?? "",
        middle_initial: item.row.middle_initial ?? "",
        year_level: item.row.year_level ?? "",
        section: item.row.section ?? "",
        course: item.row.course_code ?? item.row.course ?? "",
        academic_year: item.row.academic_year ?? "",
        email: item.row.email ?? "",
        status: "Pending Activation" as const,
        validationErrors: item.issues,
      }));
    }

    const textValue = await file.text();
    const rows = parseDelimitedRows(textValue);
    if (rows.length < 2) throw new Error("The import file is empty or missing student rows.");
    const headerMap = rows[0].map((header) => header.toLowerCase());
    const requiredHeaders = [
      "student_id",
      "first_name",
      "last_name",
      "email",
      "course_code",
      "year_level",
      "section",
    ];
    const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));
    if (missingHeaders.length) throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);

    const existingIds = new Set(
      existingStudents.map((s) => String(s.studentId || s.id || "").toLowerCase()),
    );
    const existingEmails = new Set(existingStudents.map((s) => s.email.toLowerCase()));
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    return rows.slice(1).map((cells, index) => {
      const getValue = (key: string) => cells[headerMap.indexOf(key)]?.trim() ?? "";
      const student_id = getValue("student_id");
      const first_name = getValue("first_name");
      const middle_initial = getValue("middle_initial");
      const last_name = getValue("last_name");
      const email = getValue("email");
      const academic_year = getValue("academic_year");
      const course_code = getValue("course_code") || getValue("course");
      const course_name = getValue("course_name");
      const year_level = getValue("year_level");
      const section = getValue("section");
      const validationErrors: string[] = [];
      if (!student_id || !first_name || !last_name || !email || !course_code || !year_level || !section) validationErrors.push("Missing required value");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationErrors.push("Invalid email format");
      const lowerId = student_id.toLowerCase();
      const lowerEmail = email.toLowerCase();
      if (student_id && (existingIds.has(lowerId) || seenIds.has(lowerId))) validationErrors.push("Duplicate student ID");
      if (email && (existingEmails.has(lowerEmail) || seenEmails.has(lowerEmail))) validationErrors.push("Duplicate email");
      if (student_id) seenIds.add(lowerId);
      if (email) seenEmails.add(lowerEmail);
      return {
        sourceIndex: index,
        student_id,
        first_name,
        middle_initial,
        last_name,
        email,
        academic_year,
        year_level,
        section,
        course: course_code,
        course_code,
        course_name,
        status: "Pending Activation" as const,
        validationErrors,
      };
    });
  },
  async confirmStudentImport(rows: Array<{ sourceIndex?: number; student_id: string; last_name: string; first_name: string; middle_initial?: string; year_level?: string; section: string; course?: string; course_code?: string; academic_year?: string; email: string }>) {
    if (apiRuntime.useBackend && lastStudentImportBatchId) {
      const acceptedRowIndexes = rows.map((row, index) => row.sourceIndex ?? index);
      const response = await http.post<{
        students: Array<{ id: string; studentNumber: string; name: string; email: string; status: string }>;
        summary?: {
          created: number;
          updatedOrSkipped: number;
          invalidRows: number;
          pendingActivation: number;
        };
      }>("/admin/students/import/confirm", {
        batchId: lastStudentImportBatchId,
        acceptedRowIndexes,
      });
      return {
        students: response.students.map((student) => ({
          id: String(student.id ?? student.studentNumber),
          studentId: String(student.studentNumber),
          firstName: rows.find((row) => row.student_id === student.studentNumber)?.first_name ?? "",
          lastName: rows.find((row) => row.student_id === student.studentNumber)?.last_name ?? "",
          middleInitial: rows.find((row) => row.student_id === student.studentNumber)?.middle_initial ?? "",
          academicYear: rows.find((row) => row.student_id === student.studentNumber)?.academic_year ?? "—",
          yearLevel: rows.find((row) => row.student_id === student.studentNumber)?.year_level ?? "—",
          course:
            rows.find((row) => row.student_id === student.studentNumber)?.course_code ??
            rows.find((row) => row.student_id === student.studentNumber)?.course ??
            "—",
          name: student.name,
          email: student.email,
          sectionId: "",
          section: rows.find((row) => row.student_id === student.studentNumber)?.section ?? "—",
          status: "Pending Activation" as const,
          createdBy: "Bulk Import",
          lastActive: "Pending activation",
        })),
        summary: {
          created: response.summary?.created ?? response.students.length,
          updatedOrSkipped: response.summary?.updatedOrSkipped ?? 0,
          invalidRows: response.summary?.invalidRows ?? 0,
          pendingActivation:
            response.summary?.pendingActivation ?? response.students.length,
        },
      };
    }
    await delay(180);
    return {
      students: rows.map((row) => ({
        id: row.student_id,
        studentId: row.student_id,
        firstName: row.first_name,
        lastName: row.last_name,
        middleInitial: row.middle_initial ?? "",
        academicYear: row.academic_year ?? "—",
        yearLevel: row.year_level ?? "—",
        course: row.course_code ?? row.course ?? "—",
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        sectionId: "",
        section: row.section,
        status: "Pending Activation" as const,
        createdBy: "Bulk Import",
        lastActive: "Pending activation",
      })),
      summary: {
        created: rows.length,
        updatedOrSkipped: 0,
        invalidRows: 0,
        pendingActivation: rows.length,
      },
    };
  },
  async activateStudent(id: string) {
    if (apiRuntime.useBackend) return http.post<{ success: boolean; status: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/students/${id}/activate`);
    requireBackendApi();
    await delay(180);
    return { success: true, status: "PENDING_PASSWORD_SETUP" };
  },
  async sendStudentSetupInvite(id: string) {
    if (apiRuntime.useBackend) return http.post<{ success: boolean; queued?: boolean; status: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/students/${id}/send-setup-invite`);
    requireBackendApi();
    await delay(180);
    return { success: true, queued: true, status: "PENDING_ACTIVATION" };
  },
  async sendStudentResetLink(id: string) {
    if (apiRuntime.useBackend) return http.post<{ success: boolean; queued?: boolean; status?: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/students/${id}/send-reset-link`);
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async deactivateStudent(id: string) {
    if (apiRuntime.useBackend) return http.post<{ success: boolean; status: string }>(`/admin/students/${id}/deactivate`);
    requireBackendApi();
    await delay(180);
    return { success: true, status: "INACTIVE" };
  },

async activateTeacher(id: string) {
  if (apiRuntime.useBackend) return http.post<{ success: boolean; queued?: boolean; status: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/teachers/${id}/activate`);
  requireBackendApi();
  await delay(180);
  return { success: true, status: "PENDING_PASSWORD_SETUP" };
},
async sendTeacherResetLink(id: string) {
  if (apiRuntime.useBackend) return http.post<{ success: boolean; queued?: boolean; status?: string; mailJobId?: string; provider?: string; fromEmail?: string }>(`/admin/teachers/${id}/send-reset-link`);
  requireBackendApi();
  await delay(180);
  return { success: true };
},
async deactivateTeacher(id: string) {
  if (apiRuntime.useBackend) return http.post<{ success: boolean; status: string }>(`/admin/teachers/${id}/deactivate`);
  requireBackendApi();
  await delay(180);
  return { success: true, status: "INACTIVE" };
},
async createTeacher(payload: AdminTeacherUpsertInput) {
  if (apiRuntime.useBackend) return http.post<{ success: boolean; id: string }>(`/admin/teachers`, payload);
  requireBackendApi();
  await delay(180);
  return { success: true, id: `teacher_${Date.now()}` };
},
async updateTeacher(id: string, payload: AdminTeacherUpsertInput) {
  if (apiRuntime.useBackend) return http.post<{ success: boolean; id: string }>(`/admin/teachers/${id}`, payload);
  requireBackendApi();
  await delay(180);
  return { success: true, id };
},

async saveSubmissionNote(id: string, note: string) {
  if (apiRuntime.useBackend) {
    return http.post<{ success: boolean; note: string }>(`/admin/submissions/${id}/note`, { note });
  }
  requireBackendApi();
  await delay(180);
  return { success: true, note };
},

  async getSubjects(filters: AdminSubjectFilters = {}): Promise<AdminSubjectRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/subjects", {
        search: filters.search || undefined,
      });
      return rows.map((s: any) => ({
        id: String(s.id || s.code || ""),
        code: s.code || s.id,
        name: s.name,
        teacher: s.teacher || "Unassigned",
        sections: Array.isArray(s.sections) ? s.sections : [],
        activities: s.activities ?? 0,
        students: s.students ?? 0,
        status: s.status || "Active",
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminSubjectsData)).map((s: AdminSubjectRecord, index: number) => ({
      ...s,
      id: s.id || s.code || `subject_${index + 1}`,
    })).filter((s: AdminSubjectRecord) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.teacher.toLowerCase().includes(q));
  },
  async createSubject(payload: AdminSubjectUpsertInput) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string }>("/admin/subjects", payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id: `subject_${Date.now()}` };
  },
  async updateSubject(id: string, payload: Omit<AdminSubjectUpsertInput, "sectionCodes">) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string }>(`/admin/subjects/${id}`, payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id };
  },
  async getGroups(filters: AdminGroupFilters = {}): Promise<AdminGroupRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/groups", {
        section: !filters.section || filters.section === 'All Sections' ? undefined : filters.section,
        status: !filters.status || filters.status === 'All Statuses' ? undefined : filters.status.toUpperCase(),
      });
      const q = (filters.search ?? '').toLowerCase();
      return rows.map((g: any) => ({
        id: g.id,
        name: g.name,
        subject: g.subject,
        section: g.section,
        leader: g.leader,
        members: (g.members || []).map((m: any) => String(m.name || m)),
        status: formatSubmissionStatus(g.status).replace('Submitted', 'Active'),
        mode: 'Group',
        code: g.inviteCode,
        leaderId: String((g.members || []).find((m: any) => m.isLeader)?.id || ''),
        memberDetails: (g.members || []).map((m: any, index: number) => ({ id: String(m.id || index + 1), name: String(m.name || m), isLeader: Boolean(m.isLeader) || index === 0 })),
      })).filter((g: AdminGroupRecord) => {
        const matchesQuery = !q || [g.id, g.name, g.subject, g.section, g.leader, g.code].some((v) => v.toLowerCase().includes(q));
        const matchesSection = !filters.section || filters.section === 'All Sections' || g.section.includes(filters.section);
        const matchesStatus = !filters.status || filters.status === 'All Statuses' || g.status === filters.status;
        return matchesQuery && matchesSection && matchesStatus;
      });
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminGroupsData)).filter((g: AdminGroupRecord) => {
      const matchesQuery = !q || [g.id, g.name, g.subject, g.section, g.leader, g.code].some((v) => v.toLowerCase().includes(q));
      const matchesSection = !filters.section || filters.section === "All Sections" || g.section === filters.section;
      const matchesStatus = !filters.status || filters.status === "All Statuses" || g.status === filters.status;
      return matchesQuery && matchesSection && matchesStatus;
    });
  },
  async approveGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/approve`, {});
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async lockGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/lock`, {});
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async unlockGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/unlock`, {});
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async assignGroupLeader(id: string, memberId: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/leader`, { memberId });
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async removeGroupMember(id: string, memberId: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/members/${memberId}/remove`, {});
    requireBackendApi();
    await delay(180);
    return { success: true };
  },
  async exportGroupsCsv(records: AdminGroupRecord[]) {
    await delay(120);
    downloadCsv(
      "admin-groups-current-view.csv",
      ["Group", "Subject", "Section", "Leader", "Members", "Mode", "Status", "Invite Code"],
      records.map((g) => [g.name, g.subject, g.section, g.leader, g.members.join(" | "), g.mode, g.status, g.code])
    );
  },
  async getAnnouncements(filters: AdminAnnouncementFilters = {}): Promise<AdminAnnouncementRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/announcements");
      return rows.map((item: any, index: number) => ({
        id: String(item.id ?? index + 1),
        title: item.title,
        audience: item.audience,
        channel: item.audience === 'ALL' ? 'System + Email' : 'System',
        status: toAnnouncementDisplayStatus(item.status),
        when: toAnnouncementDisplayWhen(item.publishAt),
        body: item.body,
      })).filter((item: AdminAnnouncementRecord) => !filters.status || filters.status === 'All' || item.status === filters.status);
    }
    await delay();
    return JSON.parse(JSON.stringify(adminAnnouncementsData)).filter((item: AdminAnnouncementRecord) => !filters.status || filters.status === "All" || item.status === filters.status);
  },
  async createAnnouncement(payload: Omit<AdminAnnouncementRecord, "id">): Promise<AdminAnnouncementRecord> {
    if (apiRuntime.useBackend) {
      const parsedWhen = new Date(payload.when);
      const publishAt = Number.isNaN(parsedWhen.getTime())
        ? new Date().toISOString()
        : parsedWhen.toISOString();
      const created = await http.post<any>("/admin/announcements", {
        title: payload.title,
        body: payload.body,
        audience: payload.audience,
        status: toAnnouncementBackendStatus(payload.status),
        publishAt,
      });
      return {
        id: String(created.id ?? Date.now()),
        title: created.title,
        audience: created.audience,
        channel: payload.channel,
        status: toAnnouncementDisplayStatus(created.status),
        when: toAnnouncementDisplayWhen(created.publishAt),
        body: created.body,
      };
    }
    await delay(180);
    return { id: String(Math.max(...adminAnnouncementsData.map((x) => Number(x.id))) + 1), ...payload };
  },

  async deleteAnnouncements(ids: string[]) {
    const normalizedIds = Array.from(new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; count: number }>("/admin/announcements/delete", {
        ids: normalizedIds,
      });
    }
    await delay(180);
    let count = 0;
    normalizedIds.forEach((id) => {
      const index = adminAnnouncementsData.findIndex((item) => String(item.id) === id);
      if (index >= 0) {
        adminAnnouncementsData.splice(index, 1);
        count += 1;
      }
    });
    return { success: true, count };
  },
  async getCalendarEvents(filters: AdminCalendarFilters = {}): Promise<AdminCalendarEvent[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/calendar/events", {
        audience: !filters.audience || filters.audience === 'All Events' ? undefined : filters.audience.toUpperCase(),
      });
      return rows.map((event: any) => {
        const startsAt = event.startsAt || event.date || event.when;
        const parsedDate = startsAt ? new Date(startsAt) : null;
        return {
          id: String(event.id),
          date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getDate() : Number(event.date ?? 1),
          title: event.title,
          section: event.subject || event.section || event.audience,
          tone: event.type === 'announcement' ? 'violet' : event.windowStatus === 'REOPENED' ? 'amber' : 'blue',
          type: event.type,
          audience: event.audience,
          startsAt,
          windowStatus: event.windowStatus,
        };
      });
    }
    await delay();
    return JSON.parse(JSON.stringify(adminCalendarEvents)).map((event: AdminCalendarEvent, index: number) => ({
      ...event,
      id: event.id || `event_${index + 1}`,
    })).filter((event: AdminCalendarEvent) => !filters.audience || filters.audience === "All Events" || event.section === filters.audience || event.title.includes(filters.audience));
  },

  async getCalendarEventDetail(id: string): Promise<AdminCalendarEvent> {
    if (apiRuntime.useBackend) {
      const event = await http.get<any>(`/admin/calendar/events/${id}`);
      const startsAt = event.startsAt || event.date || event.when;
      const parsedDate = startsAt ? new Date(startsAt) : null;
      return {
        id: String(event.id),
        date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getDate() : Number(event.date ?? 1),
        title: event.title,
        section: event.subject || event.section || event.audience,
        tone: event.type === 'announcement' ? 'violet' : event.windowStatus === 'REOPENED' ? 'amber' : 'blue',
        type: event.type,
        audience: event.audience,
        startsAt,
        windowStatus: event.windowStatus,
      };
    }
    await delay();
    const events = await this.getCalendarEvents();
    return events.find((event) => event.id === id) ?? events[0];
  },
};

export const teacherSubjectService = {
  async getSubject(id: string): Promise<TeacherSubjectResponse> {
    if (apiRuntime.useBackend) {
      const subject = await http.get<any>(`/teacher/subjects/${id}`);
      const teacherName = getTeacherDisplayName(subject);
      const students = (subject.students || []).map((s: any) => ({
        name: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.name || 'Student',
        id: s.studentProfile?.studentNumber || s.studentNumber || s.id,
        status: s.status === 'ACTIVE' ? 'Active' : String(s.status || 'Active').replace(/_/g, ' '),
        submitted: 0,
        graded: 0,
      }));
      const sections = Array.from(new Set((subject.enrollments || []).map((en: any) => en.section?.name || en.student?.section?.name).filter(Boolean)));
      const submissions = (subject.submissions || []).map((a: any) => ({
        id: String(a.id),
        title: a.title,
        due: a.deadline ? new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        mode: String(a.submissionMode).toUpperCase() === 'GROUP' ? 'Group' : 'Individual',
        window: String(a.windowStatus || (a.isOpen ? 'OPEN' : 'CLOSED')).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        status: a.isOpen ? 'Active' : 'Closed',
        submitted: Number(a.submissions?.length || 0),
        total: students.length,
        late: Number((a.submissions || []).filter((item: any) => item.status === 'LATE').length || 0),
        instructions: a.description || '',
        allowLateSubmission: Boolean(a.allowLateSubmission),
        openAt: a.openAt || undefined,
        closeAt: a.closeAt || undefined,
        maxFileSizeMb: Number(a.maxFileSizeMb || 10),
        acceptedFileTypes: Array.isArray(a.acceptedFileTypes) ? a.acceptedFileTypes : (Array.isArray(a.fileTypes) ? a.fileTypes : []),
        externalLinksAllowed: a.externalLinksAllowed !== false,
        notifyByEmail: Boolean(a.notifyByEmail),
      }));
      const groups = (subject.groups || []).map((group: any) => {
        const memberDetails = (group.members || []).map((member: any, index: number) => ({
          id: String(member.studentId || member.id || index + 1),
          name:
            [member.student?.firstName, member.student?.lastName]
              .filter(Boolean)
              .join(' ') ||
            member.name ||
            'Student',
          isLeader:
            Boolean(group.leaderId && String(group.leaderId) === String(member.studentId || member.id)) ||
            index === 0,
        }));
        const sectionNames = Array.from(
          new Set(
            [
              group.section?.name,
              ...((group.subject?.enrollments || []).map((item: any) => item.section?.name)),
            ].filter(Boolean),
          ),
        );
        const normalizedStatus = String(group.status || '').trim().toUpperCase();
        const status =
          normalizedStatus === 'PENDING'
            ? 'Pending Review'
            : normalizedStatus
                .toLowerCase()
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (match: string) => match.toUpperCase()) || 'Active';
        return {
          id: String(group.id),
          name: String(group.name || 'Group'),
          code: String(group.inviteCode || '—'),
          status,
          section: sectionNames.join(', ') || '—',
          leader: memberDetails.find((member: any) => member.isLeader)?.name || 'Unassigned',
          memberCount: memberDetails.length,
          members: memberDetails.map((member: any) => member.name),
          memberDetails,
        };
      });
      return {
        groupEnabled: Boolean(subject.groupEnabled) || (subject.activities || []).some((a: any) => String(a.submissionMode || '').toUpperCase() === 'GROUP'),
        code: subject.code,
        name: subject.name,
        status: subject.status,
        section: sections.join(', ') || '—',
        studentsCount: students.length,
        term: 'AY 2025–2026 · 2nd Semester',
        overview: [
          { l: 'Teacher', v: teacherName },
          { l: 'Sections', v: sections.join(', ') || '—' },
          { l: 'Activities', v: String(submissions.length) },
          { l: 'Group Work', v: subject.groupEnabled ? 'Enabled' : 'Disabled' },
        ],
        submissions,
        students,
        groups,
        rules: [
          { label: 'Open', value: subject.isOpen ? 'Yes' : 'No' },
          { label: 'Late Allowed', value: subject.allowLateSubmission ? 'Yes' : 'No' },
          { label: 'Group Mode', value: subject.groupEnabled ? 'Enabled' : 'Disabled' },
          { label: 'Group Size', value: `${subject.minGroupSize || 1} to ${subject.maxGroupSize || 1}` },
        ],
        announcements: [],
        logs: [],
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(teacherSubjectData));
  },

  async createActivity(subjectId: string, payload: { title: string; instructions?: string; deadline: string; submissionMode: 'INDIVIDUAL' | 'GROUP'; allowLateSubmission?: boolean; openAt?: string; closeAt?: string; acceptedFileTypes?: string[]; maxFileSizeMb?: number; externalLinksAllowed?: boolean; notifyByEmail?: boolean }) {
    return http.post<{ id?: string; success?: boolean; notified?: number; inAppNotificationsCreated?: number; emailJobsQueued?: number; emailQueueWarnings?: string[] }>(`/teacher/subjects/${subjectId}/submissions`, payload);
  },

  async updateActivity(subjectId: string, activityId: string, payload: { title: string; instructions?: string; deadline: string; submissionMode: 'INDIVIDUAL' | 'GROUP'; allowLateSubmission?: boolean; openAt?: string; closeAt?: string; acceptedFileTypes?: string[]; maxFileSizeMb?: number; externalLinksAllowed?: boolean; notifyByEmail?: boolean }) {
    return http.patch(`/teacher/subjects/${subjectId}/submissions/${activityId}`, payload);
  },

  async reopenActivity(subjectId: string, activityId: string) {
    return http.patch<{ success: boolean; notified?: number; inAppNotificationsCreated?: number; emailJobsQueued?: number; emailQueueWarnings?: string[] }>(`/teacher/subjects/${subjectId}/submissions/${activityId}/reopen`, {});
  },

  async approveGroup(subjectId: string, groupId: string) {
    return http.post(`/teacher/subjects/${subjectId}/groups/${groupId}/approve`, {});
  },

  async lockGroup(subjectId: string, groupId: string) {
    return http.post(`/teacher/subjects/${subjectId}/groups/${groupId}/lock`, {});
  },

  async unlockGroup(subjectId: string, groupId: string) {
    return http.post(`/teacher/subjects/${subjectId}/groups/${groupId}/unlock`, {});
  },

  async assignGroupLeader(subjectId: string, groupId: string, memberId: string) {
    return http.post(`/teacher/subjects/${subjectId}/groups/${groupId}/leader`, { memberId });
  },

  async removeGroupMember(subjectId: string, groupId: string, memberId: string) {
    return http.post(`/teacher/subjects/${subjectId}/groups/${groupId}/members/${memberId}/remove`, {});
  },

  async notifyStudents(subjectId: string, payload: { title: string; message: string; type?: string }) {
    return http.post<{ success: boolean; notified?: number; inAppNotificationsCreated?: number; emailJobsQueued?: number; emailQueueWarnings?: string[] }>(`/teacher/subjects/${subjectId}/notify`, payload);
  },

  async reopenSubject(subjectId: string) {
    return http.patch<{ success: boolean; notified?: number; inAppNotificationsCreated?: number; emailJobsQueued?: number; emailQueueWarnings?: string[] }>(`/teacher/subjects/${subjectId}/reopen`, {});
  },
};

export const studentSubjectService = {
  async getSubject(id: string): Promise<StudentSubjectResponse> {
    if (!id) {
      throw new Error("Subject id is required.");
    }
    if (apiRuntime.useBackend) {
      const subject = await http.get<any>(`/student/subjects/${id}`);
      const teacherName = getTeacherDisplayName(subject);
      const memberRows = buildGroupMemberRows(subject.group);
      const group = subject.group ? {
        id: String(subject.group.id || ''),
        name: String(subject.group.name || ''),
        code: subject.group.inviteCode || '—',
        leader: formatPersonName(
          subject.group.leader || memberRows.find((m: { isLeader: boolean; name: string }) => m.isLeader)?.name,
          '—',
        ),
        membersCount: String(memberRows.length),
        locked: subject.group.status === 'LOCKED' ? 'Locked' : 'Open',
        status: subject.group.status || 'Active',
      } : null;
      return {
        groupEnabled: Boolean(subject.groupEnabled) || (subject.activities || []).some((a: any) => String(a.submissionMode || '').toUpperCase() === 'GROUP'),
        code: subject.code,
        name: subject.name,
        teacher: teacherName,
        section: Array.isArray(subject.sections) ? subject.sections.join(', ') : subject.section,
        term: 'AY 2025–2026 · 2nd Semester',
        activitiesCount: (subject.activities || []).length,
        overview: [
          { label: 'Teacher', value: teacherName },
          { label: 'Sections', value: Array.isArray(subject.sections) ? subject.sections.join(', ') : (subject.section || '—') },
          { label: 'Activities', value: String((subject.activities || []).length) },
          { label: 'Status', value: subject.status || 'Active' },
        ],
        activities: (subject.activities || []).map((a: any, index: number) => ({
          id: String(a.id ?? index + 1),
          title: a.title,
          type: a.submissionMode === 'GROUP' ? 'Group' : 'Individual',
          due: a.deadline ? new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          fileTypes: (a.fileTypes || a.acceptedFileTypes || []).join(', ') || 'See submission rules',
          window: a.windowStatus || 'Open',
          status: formatSubmissionStatus(a.submissionStatus || 'NOT_STARTED'),
          action: a.actionLabel || 'Submit',
          daysLeft: a.deadline ? Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000) : 0,
        })),
        group,
        members: memberRows.map((member: { name: string; status: string; isLeader: boolean }) => ({
          name: member.name,
          role: member.isLeader ? 'Leader' : 'Member',
          status: member.status || 'Active',
        })),
        recentActivity: (subject.activities || []).slice(0, 4).map((a: any) => `${a.title} · ${a.windowStatus || 'Open'}`),
      };
    }
    requireBackendApi();
    await delay();
    return JSON.parse(JSON.stringify(studentSubjectData));
  },
};


export const teacherDashboardService = {
  async getDashboard(): Promise<TeacherDashboardResponse> {
    if (apiRuntime.useBackend) {
      const [summary, submissions, subjects] = await Promise.all([
        http.get<{ subjects: number; pendingReviews: number; graded: number; needsRevision: number }>("/teacher/dashboard/summary"),
        http.get<Array<any>>("/teacher/submissions"),
        http.get<Array<any>>("/teacher/subjects"),
      ]);
      const chartData = [
        { name: 'Pending Review', value: summary.pendingReviews, fill: '#0f766e' },
        { name: 'Graded', value: summary.graded, fill: '#1d4ed8' },
        { name: 'Needs Revision', value: summary.needsRevision, fill: '#f59e0b' },
      ];
      const upcomingDeadlines = subjects
        .flatMap((subject: any) => (Array.isArray(subject.tasks) ? subject.tasks : []).map((task: any) => {
          const dueAt = task.deadline ? new Date(task.deadline) : null;
          const diffDays = dueAt ? Math.max(0, Math.ceil((dueAt.getTime() - Date.now()) / 86400000)) : 0;
          const submissionsForTask = submissions.filter((row: any) => String(row.activityId || row.taskId || '') === String(task.id || ''));
          return {
            activity: task.title || task.name || 'Submission',
            activityId: String(task.id ?? ''),
            subject: subject.name || subject.code || 'Subject',
            subjectId: String(subject.id ?? ''),
            due: dueAt ? dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
            daysLeft: diffDays,
            submitted: submissionsForTask.length,
            total: Number((subject.enrollments || []).length || 0),
          };
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

      return {
        greeting: 'Teacher workspace',
        subtext: 'Review queue, subjects, and submission counts reflect the current teacher workspace.',
        kpis: [
          { label: 'Subjects', value: String(summary.subjects), tone: 'blue' },
          { label: 'Pending Reviews', value: String(summary.pendingReviews), tone: 'teal' },
          { label: 'Graded', value: String(summary.graded), tone: 'emerald' },
          { label: 'Needs Revision', value: String(summary.needsRevision), tone: 'amber' },
        ],
        chartData,
        pending: submissions.filter((s: any) => s.status === 'PENDING_REVIEW').slice(0, 5).map((s: any) => ({
          id: String(s.id ?? ''),
          title: s.activityTitle || s.title,
          student: s.groupName || s.studentName || s.owner || 'Student',
          subject: s.subjectName || s.subject || s.subjectId || 'Subject',
          submitted: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          status: 'Pending Review',
        })),
        upcomingDeadlines: upcomingDeadlines.length > 0 ? upcomingDeadlines : subjects.slice(0, 5).map((s: any, i: number) => ({
          activity: s.name,
          subject: s.code,
          subjectId: String(s.id ?? ''),
          due: `+${i + 2} days`,
          daysLeft: i + 2,
          submitted: Math.max(1, 3 + i),
          total: Math.max(4, 8 + i),
        })),
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(teacherDashboardData));
  },
};

export const teacherCatalogService = {
  async getSubjects(filters: { search?: string } = {}): Promise<TeacherSubjectCard[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/teacher/subjects");
      const q = (filters.search ?? '').toLowerCase();
      return rows.map((s: any) => {
        const sections = Array.from(new Set((s.enrollments || []).map((en: any) => en.section?.name || en.student?.section?.name).filter(Boolean)));
        return {
          id: String(s.id),
          code: s.code,
          name: s.name,
          section: sections.join(', ') || '—',
          students: Number((s.enrollments || []).length),
          activities: Number((s.tasks || []).length),
          pending: Number((s.tasks || []).length),
        };
      }).filter((s: TeacherSubjectCard) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.section.toLowerCase().includes(q));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(teacherSubjectCards)).filter((s: TeacherSubjectCard) =>
      !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.section.toLowerCase().includes(q)
    );
  },
  async getStudents(filters: TeacherStudentFilters = {}): Promise<TeacherStudentRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/teacher/students", {
        search: filters.search || undefined,
        section: !filters.section || filters.section === 'All' ? undefined : filters.section,
      });
      return rows.map((s: any) => ({
        id: String(s.id),
        studentId: String(s.studentId || s.id),
        academicYear: String(s.academicYear || s.schoolYear || "—"),
        name: String(s.name),
        email: String(s.email || '—'),
        section: String(s.section || '—'),
        subjects: Number(s.subjects ?? 0),
        status: String(s.status || 'Active'),
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(teacherStudentsData)).filter((s: TeacherStudentRecord) => {
      const studentId = String(s.studentId || s.id || "").toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || studentId.includes(q) || s.email.toLowerCase().includes(q);
      const matchSection = !filters.section || filters.section === "All" || s.section === filters.section;
      return matchSearch && matchSection;
    });
  },
  async getAssignedSections(): Promise<TeacherAssignedSectionRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/teacher/sections");
      return rows.map((section: any) => ({
        id: String(section.id),
        code: String(section.code || section.name || "—"),
        academicYear: String(section.academicYear || "—"),
        yearLevel: String(section.yearLevel || "—"),
        course: String(section.course || "—"),
        students: Number(section.students ?? 0),
        subjects: Number(section.subjects ?? 0),
        adviser: String(section.adviser || ""),
      }));
    }
    await delay();
    return [];
  },
  async getSectionMasterList(sectionId: string): Promise<SectionMasterListResponse> {
    if (apiRuntime.useBackend) {
      return http.get<SectionMasterListResponse>(`/teacher/sections/${sectionId}/master-list`);
    }
    await delay();
    return {
      section: {
        id: sectionId,
        name: "Section",
        academicYear: "2025-2026",
        yearLevel: "3rd Year",
        adviser: "",
        course: "BSIT",
      },
      rows: [],
    };
  },
  async downloadSectionMasterList(sectionId: string) {
    const response = await http.getBlob(`/teacher/sections/${sectionId}/master-list/export`);
    downloadBlobFile(response.blob, response.fileName || "masters-list.xlsx");
  },
};

export const studentCatalogService = {
  async getSubjects(filters: StudentSubjectCardFilters = {}): Promise<StudentSubjectCard[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/student/subjects");
      const q = (filters.search ?? '').toLowerCase();
      return rows
        .map((s: any) => ({
          id: String(s.id),
          code: s.code,
          name: s.name,
          teacher: getTeacherDisplayName(s),
          section: (s.sections || []).join(', '),
          term: 'AY 2025–2026 · 2nd Semester',
          activities: Number((s.activities || []).length || 0),
          status: s.status || 'Active',
        }))
        .filter((s: StudentSubjectCard) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.teacher.toLowerCase().includes(q));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(studentSubjectCards)).map((s: StudentSubjectCard, index: number) => ({ ...s, id: (s as any).id || String(index + 1) })).filter((s: StudentSubjectCard) =>
      !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.teacher.toLowerCase().includes(q)
    );
  },
  async getNotifications(filters: StudentNotificationFilters = {}): Promise<StudentPortalNotification[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/student/notifications");
      return rows.map((n: any, index: number) => ({
        id: String(n.id ?? index + 1),
        date: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: toStudentNotificationType(n.type),
        read: !!n.isRead,
        title: n.title,
        body: n.body,
        time: new Date(n.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      })).filter((n: StudentPortalNotification) => !filters.type || filters.type === 'All' || n.type === filters.type.toLowerCase());
    }
    await delay();
    return JSON.parse(JSON.stringify(studentNotificationsData)).map((n: StudentPortalNotification) => ({ ...n, id: String(n.id) })).filter((n: StudentPortalNotification) => !filters.type || filters.type === "All" || n.type === filters.type.toLowerCase());
  },

  async markNotificationRead(id: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/student/notifications/${id}/read`, {});
    }
    await delay();
    return { success: true, id };
  },
  async markAllNotificationsRead() {
    if (apiRuntime.useBackend) {
      return http.post('/student/notifications/mark-all-read', {});
    }
    await delay();
    return { success: true };
  },
};

export const studentGroupService = {
  async createGroup(subjectId: string, name: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/student/groups`, { subjectId, name });
    }
    await delay(180);
    return { success: true };
  },
  async joinGroup(subjectId: string, inviteCode: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/student/groups/join-by-code`, { subjectId, code: inviteCode });
    }
    await delay(180);
    return { success: true };
  },
};

export const adminCatalogService = {
  async getTeachers(filters: AdminTeacherFilters = {}): Promise<AdminTeacherRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/teachers", {
        search: filters.search || undefined,
        status: !filters.status || filters.status === "All" ? undefined : filters.status,
      });
      return rows.map((t: any) => ({
        id: String(t.id),
        name: t.name,
        email: t.email,
        dept: t.dept || t.department || "Unassigned Department",
        employeeId: t.employeeId ? String(t.employeeId) : null,
        subjects: t.subjects ?? 0,
        students: t.students ?? 0,
        status: t.status,
        lastActive: t.lastActive ? new Date(t.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminTeachersData)).filter((t: AdminTeacherRecord) => {
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
      const matchStatus = !filters.status || filters.status === "All" || t.status === filters.status;
      return matchSearch && matchStatus;
    });
  },
  async getDepartments(filters: { search?: string } = {}): Promise<AdminDepartmentRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/departments", {
        search: filters.search || undefined,
      });
      return rows.map((department: any) => ({
        id: String(department.id),
        name: String(department.name || ""),
        description: String(department.description || ""),
        teachers: Number(department.teachers ?? 0),
        subjects: Number(department.subjects ?? 0),
        isLegacy: Boolean(department.isLegacy),
        canDelete: Boolean(department.canDelete),
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminDepartmentsData)).filter((department: AdminDepartmentRecord) =>
      !q ||
      department.name.toLowerCase().includes(q) ||
      String(department.description || "").toLowerCase().includes(q)
    );
  },
  async getDepartment(id: string): Promise<AdminDepartmentRecord> {
    if (apiRuntime.useBackend) {
      const department = await http.get<any>(`/admin/departments/${encodeURIComponent(id)}`);
      return {
        id: String(department.id),
        name: String(department.name || ""),
        description: String(department.description || ""),
        teachers: Number(department.teachers ?? 0),
        subjects: Number(department.subjects ?? 0),
        isLegacy: Boolean(department.isLegacy),
        canDelete: Boolean(department.canDelete),
      };
    }
    await delay();
    const match = adminDepartmentsData.find((department: AdminDepartmentRecord) => department.id === id);
    if (!match) throw new Error("Department not found.");
    return JSON.parse(JSON.stringify(match));
  },
  async createDepartment(payload: AdminDepartmentCreateInput): Promise<AdminDepartmentRecord> {
    if (apiRuntime.useBackend) {
      const department = await http.post<any>("/admin/departments", payload);
      return {
        id: String(department.id),
        name: String(department.name || ""),
        description: String(department.description || ""),
        teachers: Number(department.teachers ?? 0),
        subjects: Number(department.subjects ?? 0),
        isLegacy: Boolean(department.isLegacy),
        canDelete: Boolean(department.canDelete),
      };
    }
    requireBackendApi();
    await delay(180);
    const created = {
      id: `department_${Date.now()}`,
      name: payload.name,
      description: payload.description || "",
      teachers: 0,
      subjects: 0,
      isLegacy: false,
      canDelete: true,
    };
    adminDepartmentsData.unshift(created);
    return created;
  },
  async updateDepartment(id: string, payload: AdminDepartmentUpdateInput): Promise<AdminDepartmentRecord> {
    if (apiRuntime.useBackend) {
      const department = await http.patch<any>(`/admin/departments/${encodeURIComponent(id)}`, payload);
      return {
        id: String(department.id),
        name: String(department.name || ""),
        description: String(department.description || ""),
        teachers: Number(department.teachers ?? 0),
        subjects: Number(department.subjects ?? 0),
        isLegacy: Boolean(department.isLegacy),
        canDelete: Boolean(department.canDelete),
      };
    }
    requireBackendApi();
    await delay(180);
    const index = adminDepartmentsData.findIndex((department: AdminDepartmentRecord) => department.id === id);
    if (index < 0) throw new Error("Department not found.");
    adminDepartmentsData[index] = {
      ...adminDepartmentsData[index],
      ...payload,
    };
    return JSON.parse(JSON.stringify(adminDepartmentsData[index]));
  },
  async deleteDepartment(id: string, confirmation: string): Promise<{ success: boolean; deleted: boolean; id: string; name: string }> {
    if (apiRuntime.useBackend) {
      return http.delete<{ success: boolean; deleted: boolean; id: string; name: string }>(
        `/admin/departments/${encodeURIComponent(id)}`,
        { confirmation },
      );
    }
    requireBackendApi();
    await delay(180);
    const index = adminDepartmentsData.findIndex((department: AdminDepartmentRecord) => department.id === id);
    if (index < 0) throw new Error("Department not found.");
    const [removed] = adminDepartmentsData.splice(index, 1);
    return { success: true, deleted: true, id, name: removed.name };
  },
  async getSections(filters: AdminSectionFilters = {}): Promise<AdminSectionRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/admin/sections", {
        search: filters.search || undefined,
        academicYearId: filters.academicYearId || undefined,
      });
      return rows.map((s: any) => ({
        id: String(s.id || s.code),
        code: s.code,
        program: s.program,
        yearLevel: s.yearLevel,
        yearLevelId: String(s.yearLevelId || ""),
        yearLevelName: String(s.yearLevelName || ""),
        yearLevelLabel: s.yearLevelLabel,
        adviser: s.adviser,
        description: s.description || "",
        ay: s.ay,
        academicYear: s.academicYear || s.ay,
        academicYearId: String(s.academicYearId || ""),
        academicYearStatus: s.academicYearStatus,
        students: s.students,
        subjects: s.subjects,
        status: s.status,
      }));
    }
    await delay();
    const q = (filters.search ?? "").toLowerCase();
    return JSON.parse(JSON.stringify(adminSectionsData)).filter((s: AdminSectionRecord) =>
      !q || s.code.toLowerCase().includes(q) || s.adviser.toLowerCase().includes(q)
    );
  },
  async getAcademicYears(filters: AdminAcademicYearFilters = {}): Promise<AdminAcademicYearRecord[]> {
    if (apiRuntime.useBackend) {
      return http.get<AdminAcademicYearRecord[]>("/admin/academic-years", {
        search: filters.search || undefined,
      });
    }
    await delay();
    return [];
  },
  async createAcademicYear(payload: { name: string; status?: string }): Promise<{ success: boolean; id: string; name: string; status: string }> {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string; name: string; status: string }>("/admin/academic-years", payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, id: `ay_${Date.now()}`, name: payload.name, status: payload.status || "Upcoming" };
  },
  async createAcademicYearLevel(payload: { academicYearId: string; name: string; sortOrder?: number }) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id: string; name: string; academicYear: string }>(
        `/admin/academic-years/${payload.academicYearId}/year-levels`,
        payload,
      );
    }
    requireBackendApi();
    await delay(180);
    return {
      success: true,
      id: `level_${Date.now()}`,
      name: payload.name,
      academicYear: payload.academicYearId,
    };
  },
  async createSection(payload: AdminSectionCreateInput): Promise<{ success: boolean; id?: string; code: string; academicYear?: string }> {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean; id?: string; code: string; academicYear?: string }>("/admin/sections", payload);
    }
    requireBackendApi();
    await delay(180);
    return { success: true, code: payload.code };
  },
  async getSectionMasterList(sectionId: string): Promise<SectionMasterListResponse> {
    if (apiRuntime.useBackend) {
      return http.get<SectionMasterListResponse>(`/admin/sections/${sectionId}/master-list`);
    }
    await delay();
    return {
      section: {
        id: sectionId,
        name: "Section",
        academicYear: "2025-2026",
        yearLevel: "1st Year",
        adviser: "",
        course: "BSIT",
      },
      rows: [],
    };
  },
  async downloadSectionMasterList(sectionId: string) {
    const response = await http.getBlob(`/admin/sections/${sectionId}/master-list/export`);
    downloadBlobFile(response.blob, response.fileName || "masters-list.xlsx");
  },
  async getRequests(filters: AdminRequestFilters = {}): Promise<AdminRequestRecord[]> {
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>(`/admin/requests${filters.status && filters.status !== "All" ? `?status=${encodeURIComponent(filters.status)}` : ""}`);
      return rows.map((r: any) => ({
        id: String(r.id),
        requester: r.requester,
        role: r.role,
        type: r.type,
        subject: r.subject,
        date: r.date,
        status: r.status,
        details: r.details,
      }));
    }
    await delay();
    return JSON.parse(JSON.stringify(adminRequestsData)).filter((r: AdminRequestRecord) => !filters.status || filters.status === "All" || r.status === filters.status);
  },
  async approveRequest(id: string): Promise<{ ok: boolean; status: "Approved" }> {
    if (apiRuntime.useBackend) {
      return http.post(`/admin/requests/${id}/approve`, {});
    }
    await delay(180);
    return { ok: true, status: "Approved" };
  },
  async rejectRequest(id: string): Promise<{ ok: boolean; status: "Rejected" }> {
    if (apiRuntime.useBackend) {
      return http.post(`/admin/requests/${id}/reject`, {});
    }
    await delay(180);
    return { ok: true, status: "Rejected" };
  },
};


export const profileService = {
  async getAvatarObjectUrl(relativePath?: string, cacheBust?: string | number) {
    return getProtectedFileObjectUrlWithCacheBust(relativePath, cacheBust);
  },
  async uploadStudentAvatar(file: File) {
    const uploaded = await uploadProfileAvatar(file, 'student-profile-avatars');
    return this.updateStudentProfile({ avatarRelativePath: uploaded.relativePath });
  },
  async removeStudentAvatar() {
    return this.updateStudentProfile({ avatarRelativePath: '' });
  },
  async getStudentProfile(): Promise<StudentProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.get<StudentProfileResponse>("/student/profile");
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const response = JSON.parse(JSON.stringify(studentProfileData));
    syncAuthSessionFromProfile(response);
    return response;
  },
  async updateStudentProfile(input: Partial<{ firstName: string; lastName: string; email: string; phone?: string; avatarRelativePath?: string }>): Promise<StudentProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.patch<StudentProfileResponse>("/student/profile", input);
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const nextFirstName = input.firstName ?? studentProfileData.form.firstName;
    const nextLastName = input.lastName ?? studentProfileData.form.lastName;
    studentProfileData.fullName = `${nextFirstName} ${nextLastName}`.trim();
    studentProfileData.initials = `${nextFirstName[0] || ''}${nextLastName[0] || ''}`.toUpperCase();
    studentProfileData.form = { ...studentProfileData.form, ...input };
    const response = JSON.parse(JSON.stringify(studentProfileData));
    syncAuthSessionFromProfile(response);
    return response;
  },
  async changeStudentPassword(currentPassword: string, newPassword: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean }>("/student/profile/change-password", { currentPassword, newPassword });
    }
    requireBackendApi();
    await delay();
    return { success: true };
  },
  async uploadTeacherAvatar(file: File) {
    const uploaded = await uploadProfileAvatar(file, 'teacher-profile-avatars');
    return this.updateTeacherProfile({ avatarRelativePath: uploaded.relativePath });
  },
  async removeTeacherAvatar() {
    return this.updateTeacherProfile({ avatarRelativePath: '' });
  },
  async getTeacherProfile(): Promise<TeacherProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.get<TeacherProfileResponse>("/teacher/profile");
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const response = JSON.parse(JSON.stringify(teacherProfileData));
    syncAuthSessionFromProfile(response);
    return response;
  },
  async updateTeacherProfile(input: Partial<{ firstName: string; lastName: string; email: string; phone?: string; office?: string; avatarRelativePath?: string }>): Promise<TeacherProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.patch<TeacherProfileResponse>("/teacher/profile", input);
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const nextFirstName = input.firstName ?? teacherProfileData.form.firstName;
    const nextLastName = input.lastName ?? teacherProfileData.form.lastName;
    teacherProfileData.fullName = `${nextFirstName} ${nextLastName}`.trim();
    teacherProfileData.initials = `${nextFirstName[0] || ''}${nextLastName[0] || ''}`.toUpperCase();
    teacherProfileData.form = { ...teacherProfileData.form, ...input };
    const response = JSON.parse(JSON.stringify(teacherProfileData));
    syncAuthSessionFromProfile(response);
    return response;
  },
  async changeTeacherPassword(currentPassword: string, newPassword: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean }>("/teacher/profile/change-password", { currentPassword, newPassword });
    }
    requireBackendApi();
    await delay();
    return { success: true };
  },
  async uploadAdminAvatar(file: File) {
    const uploaded = await uploadProfileAvatar(file, 'admin-profile-avatars');
    return this.updateAdminProfile({ avatarRelativePath: uploaded.relativePath });
  },
  async removeAdminAvatar() {
    return this.updateAdminProfile({ avatarRelativePath: '' });
  },
  async getAdminProfile(): Promise<AdminProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.get<AdminProfileResponse>("/admin/profile");
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const response = {
      initials: 'AD',
      fullName: 'Administrator',
      roleLabel: 'Admin Portal',
      summary: [
        { label: 'Role', value: 'System Administrator', tone: 'text-slate-700' },
        { label: 'Status', value: 'Active', tone: 'text-emerald-700' },
      ],
      form: { firstName: 'System', lastName: 'Administrator', email: 'admin@projtrack.edu.ph', phone: '', office: 'Main Office', avatarRelativePath: '' },
    };
    syncAuthSessionFromProfile(response);
    return response;
  },
  async updateAdminProfile(input: Partial<{ firstName: string; lastName: string; email: string; phone?: string; office?: string; avatarRelativePath?: string }>): Promise<AdminProfileResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.patch<AdminProfileResponse>("/admin/profile", input);
      syncAuthSessionFromProfile(response);
      return response;
    }
    requireBackendApi();
    await delay();
    const response = {
      initials: `${input.firstName?.[0] || 'A'}${input.lastName?.[0] || 'D'}`.toUpperCase(),
      fullName: `${input.firstName || 'System'} ${input.lastName || 'Administrator'}`.trim(),
      roleLabel: 'Admin Portal',
      summary: [
        { label: 'Role', value: 'System Administrator', tone: 'text-slate-700' },
        { label: 'Status', value: 'Active', tone: 'text-emerald-700' },
      ],
      form: { firstName: input.firstName || 'System', lastName: input.lastName || 'Administrator', email: input.email || 'admin@projtrack.edu.ph', phone: input.phone || '', office: input.office || 'Main Office', avatarRelativePath: input.avatarRelativePath || '' },
      avatarRelativePath: input.avatarRelativePath || '',
    };
    syncAuthSessionFromProfile(response);
    return response;
  },
  async changeAdminPassword(currentPassword: string, newPassword: string) {
    if (apiRuntime.useBackend) {
      return http.post<{ success: boolean }>("/admin/profile/change-password", { currentPassword, newPassword });
    }
    requireBackendApi();
    await delay();
    return { success: true };
  },
};

export const teacherNotificationService = {
  async getNotifications(filters: { type?: string } = {}): Promise<TeacherPortalNotification[]> {
    const normalizedType = filters.type && filters.type !== 'All' ? filters.type.toLowerCase() : null;
    if (apiRuntime.useBackend) {
      const rows = await http.get<Array<any>>("/teacher/notifications");
      return rows
        .slice()
        .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .map((n: any, index: number) => ({
          id: String(n.id ?? index + 1),
          date: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          type: toTeacherNotificationType(n.type),
          read: !!n.isRead,
          title: n.title,
          body: n.body,
          time: new Date(n.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        }))
        .filter((n: TeacherPortalNotification) => !normalizedType || n.type === normalizedType);
    }
    requireBackendApi();
    await delay();
    return JSON.parse(JSON.stringify(teacherNotificationsData))
      .map((n: TeacherPortalNotification) => ({ ...n, id: String(n.id) }))
      .sort((a: TeacherPortalNotification, b: TeacherPortalNotification) => {
        const left = new Date(`${a.date} ${a.time}`).getTime();
        const right = new Date(`${b.date} ${b.time}`).getTime();
        return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
      })
      .filter((n: TeacherPortalNotification) => !normalizedType || n.type === normalizedType);
  },

  async markNotificationRead(id: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/teacher/notifications/${id}/read`, {});
    }
    requireBackendApi();
    await delay();
    return { success: true, id };
  },
  async markAllNotificationsRead() {
    if (apiRuntime.useBackend) {
      return http.post('/teacher/notifications/mark-all-read', {});
    }
    requireBackendApi();
    await delay();
    return { success: true };
  },
};

export const adminDetailService = {
  async getStudentView(id: string): Promise<AdminStudentViewResponse> {
    if (!id) throw new Error("Student id is required.");
    if (apiRuntime.useBackend) {
      return http.get<AdminStudentViewResponse>(`/admin/students/${id}/detail`);
    }
    await delay();
    return JSON.parse(JSON.stringify(adminStudentViewData));
  },
  async getTeacherView(id: string): Promise<AdminTeacherViewResponse> {
    if (!id) throw new Error("Teacher id is required.");
    if (apiRuntime.useBackend) {
      return http.get<AdminTeacherViewResponse>(`/admin/teachers/${id}/detail`);
    }
    await delay();
    return JSON.parse(JSON.stringify(adminTeacherViewData));
  },
  async getSubjectView(id: string): Promise<AdminSubjectViewResponse> {
    if (apiRuntime.useBackend) {
      return http.get<AdminSubjectViewResponse>(`/admin/subjects/${id}/detail`);
    }
    await delay();
    return JSON.parse(JSON.stringify(adminSubjectViewData));
  },
  async getSubmissionView(id: string): Promise<AdminSubmissionViewResponse> {
    if (!id) throw new Error("Submission id is required.");
    if (apiRuntime.useBackend) {
      const row = await http.get<any>(`/admin/submissions/${id}/detail`);
      return {
        title: row.title,
        subtitle: row.subtitle,
        status: row.status,
        details: row.details || [],
        files: (row.files || []).map((f: any) => ({
          name: f.name || f.fileName || f,
          href: buildStoredFileDownloadUrl(f.relativePath),
        })),
        timeline: row.timeline || [],
        feedback: row.feedback || "No feedback yet.",
        adminNote: row.adminNote || "",
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(adminSubmissionViewData));
  },
};


export const adminOpsService = {
  async getAcademicSettings(): Promise<AcademicSettingsResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.get<any>("/admin/settings/academic");
      return normalizeAcademicSettingsResponse(response);
    }
    await delay();
    return JSON.parse(JSON.stringify(academicSettingsStore));
  },
  async saveAcademicSettings(payload: AcademicSettingsResponse): Promise<AcademicSettingsResponse> {
    if (apiRuntime.useBackend) {
      const response = await http.post<any>("/admin/settings/academic", {
        schoolYear: payload.schoolYear,
        semester: payload.semester,
        submissionStart: payload.periodStart,
        submissionEnd: payload.periodEnd,
        latePolicy: payload.latePolicy,
        lateDeduction: payload.lateDeduction,
      });
      return normalizeAcademicSettingsResponse(response);
    }
    await delay(180);
    Object.assign(academicSettingsStore, normalizeAcademicSettingsResponse(payload));
    return JSON.parse(JSON.stringify(academicSettingsStore));
  },
  async getSystemSettings(): Promise<SystemSettingsResponse> {
    if (apiRuntime.useBackend) {
      return normalizeSystemSettingsResponse(
        await http.get<SystemSettingsResponse>("/admin/settings/system"),
      );
    }
    await delay();
    return normalizeSystemSettingsResponse(systemSettingsStore);
  },
  async saveSystemSettings(payload: SystemSettingsResponse): Promise<SystemSettingsResponse> {
    if (apiRuntime.useBackend) {
      return normalizeSystemSettingsResponse(
        await http.post<SystemSettingsResponse>("/admin/settings/system", payload),
      );
    }
    requireBackendApi();
    await delay(180);
    Object.assign(systemSettingsStore, normalizeSystemSettingsResponse(payload));
    return normalizeSystemSettingsResponse(systemSettingsStore);
  },
  async getBranding(): Promise<BrandingResponse> {
    if (apiRuntime.useBackend) {
      return normalizeBrandingResponse(await http.get<BrandingResponse>("/admin/branding"));
    }
    await delay();
    return normalizeBrandingResponse(brandingStore);
  },
  async uploadBrandingAsset(
    kind: "logo" | "icon" | "favicon",
    payload: { fileName: string; mimeType: string; contentBase64: string },
  ): Promise<BrandingResponse> {
    if (apiRuntime.useBackend) {
      return normalizeBrandingResponse(await http.post<BrandingResponse>(`/admin/branding/${kind}`, payload));
    }
    requireBackendApi();
    await delay(200);
    const dataUrl = `data:${payload.mimeType};base64,${payload.contentBase64}`;
    Object.assign(brandingStore, {
      ...brandingStore,
      ...(kind === "logo" ? { logoUrl: dataUrl } : null),
      ...(kind === "icon" ? { iconUrl: dataUrl } : null),
      ...(kind === "favicon" ? { faviconUrl: dataUrl } : null),
      updatedAt: new Date().toISOString(),
    });
    return normalizeBrandingResponse(brandingStore);
  },
  async saveBranding(payload?: { brandName?: string | null }): Promise<BrandingResponse> {
    if (apiRuntime.useBackend) {
      return normalizeBrandingResponse(await http.patch<BrandingResponse>("/admin/branding", payload ?? {}));
    }
    await delay(120);
    Object.assign(brandingStore, {
      ...brandingStore,
      brandName: String(payload?.brandName ?? brandingStore.brandName).trim() || brandingStore.brandName,
      updatedAt: new Date().toISOString(),
    });
    return normalizeBrandingResponse(brandingStore);
  },
  async resetBranding(): Promise<BrandingResponse> {
    if (apiRuntime.useBackend) {
      return normalizeBrandingResponse(await http.delete<BrandingResponse>("/admin/branding/reset"));
    }
    await delay(180);
    Object.assign(brandingStore, normalizeBrandingResponse(defaultBrandingResponse));
    return normalizeBrandingResponse(brandingStore);
  },
  async getSystemTools(): Promise<SystemToolRecord[]> {
    if (apiRuntime.useBackend) {
      return http.get<SystemToolRecord[]>("/admin/system-tools");
    }
    requireBackendApi();
    await delay();
    return JSON.parse(JSON.stringify(systemToolsStore));
  },
  async runSystemTool(
    toolId: string,
    payload: Record<string, unknown> = {},
  ): Promise<SystemToolRunResponse> {
    if (apiRuntime.useBackend) {
      return http.post<SystemToolRunResponse>(`/admin/system-tools/${toolId}/run`, payload);
    }
    requireBackendApi();
    await delay(200);
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const target = systemToolsStore.find((tool) => tool.id === toolId);
    if (target) {
      target.lastRun = now;
      target.lastRunAt = new Date().toISOString();
      target.status = target.danger ? 'Completed with review' : 'Completed';
    }
    return {
      tools: JSON.parse(JSON.stringify(systemToolsStore)),
      result: {
        toolId,
        title: target?.title ?? toolId,
        status: target?.danger ? 'Completed with review' : 'Completed',
        summary: `${target?.title ?? toolId} finished successfully.`,
        details: [
          `Updated at ${now}.`,
          'Execution summary was returned from the local data store.',
        ],
        ranAt: new Date().toISOString(),
        preview: undefined,
      },
    };
  },
  async downloadSystemToolArtifact(artifactPath: string) {
    const response = await http.getBlob("/admin/system-tools/artifact", { path: artifactPath });
    const fallbackName = artifactPath.split("/").pop() || "artifact.json";
    downloadBlobFile(response.blob, response.fileName || fallbackName);
  },
  async importBackupPackage(file: File) {
    if (!/\.json$/i.test(file.name)) {
      throw new Error("Backup package must be a JSON file.");
    }
    return http.post<SystemToolRunResult>("/admin/system-tools/backups/import", {
      fileName: file.name,
      contentBase64: await fileToBase64(file),
    });
  },
  async getBulkMoveData(): Promise<BulkMoveDataResponse> {
    if (apiRuntime.useBackend) {
      return http.get<BulkMoveDataResponse>("/admin/bulk-move");
    }
    await delay();
    return JSON.parse(JSON.stringify(bulkMoveStore));
  },
  async moveStudents(sourceSectionId: string, destSectionId: string, ids: string[]): Promise<BulkMoveDataResponse> {
    if (apiRuntime.useBackend) {
      return http.post<BulkMoveDataResponse>("/admin/bulk-move", { sourceSectionId, destSectionId, ids });
    }
    await delay(220);
    const sourceSection = bulkMoveStore.sections.find((s) => s.id === sourceSectionId);
    const destSection = bulkMoveStore.sections.find((s) => s.id === destSectionId);
    if (!sourceSection || !destSection) return JSON.parse(JSON.stringify(bulkMoveStore));
    const moving = sourceSection.students.filter((s) => ids.includes(s.id));
    sourceSection.students = sourceSection.students.filter((s) => !ids.includes(s.id));
    destSection.students = [...destSection.students, ...moving];
    return JSON.parse(JSON.stringify(bulkMoveStore));
  },
};

export const brandingService = {
  async getBranding(): Promise<BrandingResponse> {
    if (apiRuntime.useBackend) {
      return normalizeBrandingResponse(await http.get<BrandingResponse>("/branding"));
    }
    await delay();
    return normalizeBrandingResponse(brandingStore);
  },
};
