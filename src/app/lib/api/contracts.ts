import type { AppRole, AuthSession } from "../mockAuth";

export type StudentStatus =
  | "Active"
  | "Inactive"
  | "Restricted"
  | "Disabled"
  | "Archived"
  | "Graduated"
  | "Pending Setup"
  | "Pending Activation"
  | "Pending Password Setup";

export interface StudentDashboardKpi {
  label: string;
  value: string;
  tone: "blue" | "amber" | "teal" | "emerald";
  icon: "book" | "clock" | "check" | "star";
}

export interface DeadlineItem {
  id: number;
  activityId?: string;
  subjectId?: string;
  submissionId?: string;
  title: string;
  subject: string;
  due: string;
  overdue: boolean;
  daysLeft: number;
  window?: string;
  status?: string;
}

export interface SubmissionSummaryItem {
  id: string;
  title: string;
  subject: string;
  date: string;
  status: string;
  grade: string;
}

export interface NotificationItem {
  id: number;
  text: string;
  time: string;
  type: "feedback" | "overdue" | "grade" | "info";
}

export interface StudentDashboardResponse {
  greeting: string;
  subtext: string;
  kpis: StudentDashboardKpi[];
  deadlines: DeadlineItem[];
  recentSubmissions: SubmissionSummaryItem[];
  notifications: NotificationItem[];
}

export interface CalendarEventItem {
  id: number;
  activityId?: string;
  subjectId?: string;
  submissionId?: string;
  date: string;
  displayDate?: string;
  title: string;
  subject: string;
  type: "Individual" | "Group";
  window: string;
  status: string;
}

export interface StudentSubmissionRow {
  id: string;
  activityId?: string;
  subjectId?: string;
  activityTitle?: string;
  title: string;
  subject: string;
  type: "Individual" | "Group";
  due: string;
  submitted: string;
  status: string;
  grade: string;
  feedback: string;
  description?: string;
  notes?: string;
  externalLinks?: string[];
  groupName?: string;
  leader?: string;
  members?: string[];
  submittedBy?: string;
  files?: string[];
}

export interface TeacherSubmissionRow {
  subjectId?: string;
  id: string;
  title: string;
  owner: string;
  studentId?: string;
  subject: string;
  section: string;
  activity: string;
  activityId?: string;
  type: "Individual" | "Group";
  due: string;
  submitted: string;
  status: string;
  grade: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  module: string;
  user: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  target: string;
  time: string;
  role: "Admin" | "Teacher" | "Student";
  ip: string;
  entityId: string;
  result: "Success" | "Queued" | "Failed";
  session: string;
  details: string;
  before?: string;
  after?: string;
}

export interface ReportMetricCard {
  label: string;
  value: string;
  delta: string;
  good: boolean;
}

export interface CompletionRatePoint {
  name: string;
  rate: number;
}

export interface TrendPoint {
  month: string;
  late?: number;
  days?: number;
}

export interface ReportTableRow {
  subject: string;
  section: string;
  completionRate: string;
  pending: number;
  graded: number;
  avgReview: string;
}

export interface AdminReportsResponse {
  metrics: ReportMetricCard[];
  completionData: CompletionRatePoint[];
  lateData: TrendPoint[];
  turnaroundData: TrendPoint[];
  tableRows: ReportTableRow[];
}



export interface AdminDashboardKpi {
  label: string;
  value: string;
  icon: "users" | "book" | "layers" | "grid" | "file" | "inbox";
  color: string;
  bg: string;
  delta: string;
}

export interface AdminDashboardTrendPoint {
  month: string;
  count: number;
}

export interface AdminDashboardStatusPoint {
  name: string;
  value: number;
  fill: string;
}

export interface AdminDashboardActivityItem {
  action: string;
  user: string;
  target: string;
  time: string;
  type: string;
}

export interface AdminDashboardSystemItem {
  label: string;
  status: string;
  good: boolean;
}

export interface AdminDashboardCurrentTerm {
  schoolYear: string;
  semester: string;
  detail: string;
}

export interface AdminDashboardResponse {
  title: string;
  subtitle: string;
  kpis: AdminDashboardKpi[];
  submissionTrend: AdminDashboardTrendPoint[];
  statusDist: AdminDashboardStatusPoint[];
  recentActivity: AdminDashboardActivityItem[];
  systemStatus: AdminDashboardSystemItem[];
  currentTerm?: AdminDashboardCurrentTerm;
}

export interface AdminSubmissionRecord {
  id: string;
  title: string;
  student: string;
  teacher: string;
  subject: string;
  section: string;
  due: string;
  submitted: string;
  status: string;
  grade: string;
  statusKey?: string;
  subjectCode?: string;
  taskId?: string;
  taskTitle?: string;
  subjectId?: string;
  studentId?: string | null;
  studentNumber?: string | null;
  groupId?: string | null;
  ownerLabel?: string;
  feedback?: string;
  notes?: string;
  externalLinks?: string[];
}

export interface AdminSubmissionUpsertInput {
  taskId: string;
  subjectId: string;
  studentId?: string;
  groupId?: string;
  title: string;
  status: string;
  grade?: string;
  feedback?: string;
  notes?: string;
  submittedAt?: string;
  externalLinks?: string[];
}

export interface StudentSubmitActivitySubmissionContext {
  submissionMode: "individual" | "group";
  accessLabel: string;
  availabilityMessage: string;
  group?: {
    id?: string;
    name?: string;
    leader?: string;
    members: string[];
  } | null;
}

export interface StudentSubmitActivityItem {
  id?: string;
  subjectId?: string;
  title: string;
  type: "individual" | "group";
  due: string;
  rules: string[];
  groupId?: string;
  groupName?: string;
  members?: string[];
  canSubmit?: boolean;
  submissionContext?: StudentSubmitActivitySubmissionContext;
}

export interface StudentSubmitCatalogResponse {
  subjects: string[];
  activities: Record<string, StudentSubmitActivityItem[]>;
}

export interface TeacherSubmissionTimelineItem {
  action: string;
  by: string;
  time: string;
  type: string;
}

export interface TeacherSubmissionFileItem {
  name: string;
  size: string;
  href?: string;
}

export interface TeacherSubmissionReviewResponse {
  title: string;
  subject: string;
  section: string;
  due: string;
  student: string;
  studentId: string;
  initials: string;
  description: string;
  files: TeacherSubmissionFileItem[];
  timeline: TeacherSubmissionTimelineItem[];
  status: string;
  activity: string;
  activityId?: string;
  submittedAt: string;
  late: string;
  type?: "Individual" | "Group";
  groupName?: string;
  submittedBy?: string;
  groupMembers?: string[];
  feedback?: string;
  grade?: string | number;
  allowedActions?: {
    canMarkReviewed: boolean;
    canGrade: boolean;
    canRequestRevision: boolean;
    canReopen: boolean;
    final: boolean;
    reason?: string;
  };
}

export interface AdminNotificationRecord {
  id: string;
  userId?: string | null;
  dedupeKey?: string | null;
  date: string;
  type: "account" | "request" | "system";
  read: boolean;
  title: string;
  body: string;
  time: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  role: string;
  status: string;
  statusKey?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  office?: string;
  createdAt: string;
  updatedAt: string;
  profileLabel: string;
  studentNumber?: string | null;
  employeeId?: string | null;
  isSeedCandidate?: boolean;
}

export interface AdminCreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  office?: string;
  sendActivationEmail?: boolean;
}


export interface AdminStudentRecord {
  id: string;
  studentId?: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  academicYear?: string;
  yearLevel?: string;
  course?: string;
  name: string;
  email: string;
  sectionId?: string;
  section: string;
  status: StudentStatus;
  createdBy: string;
  lastActive: string;
}

export interface AdminStudentUpsertInput {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  email: string;
  studentNumber: string;
  section: string;
  academicYearId?: string;
  academicYear?: string;
  course?: string;
  yearLevel?: string;
  yearLevelId?: string;
  yearLevelName?: string;
}

export interface AdminStudentImportPreviewRow {
  sourceIndex?: number;
  student_id: string;
  last_name: string;
  first_name: string;
  middle_initial?: string;
  year_level?: string;
  section: string;
  course?: string;
  academic_year?: string;
  email: string;
  status: StudentStatus;
  validationErrors: string[];
}

export interface AdminSubjectRecord {
  id?: string;
  code: string;
  name: string;
  teacher: string;
  sections: string[];
  activities: number;
  students: number;
  status: string;
}



export interface AdminGroupRecord {
  id: string;
  name: string;
  subject: string;
  section: string;
  leader: string;
  members: string[];
  status: string;
  mode: string;
  code: string;
  leaderId?: string;
  memberDetails?: Array<{ id: string; name: string; isLeader: boolean }>;
}

export interface AdminAnnouncementRecord {
  id: string;
  title: string;
  audience: string;
  channel: string;
  status: string;
  when: string;
  body: string;
}

export interface AdminCalendarEvent {
  id: string;
  date: number;
  title: string;
  section: string;
  tone: string;
  type?: string;
  audience?: string;
  startsAt?: string;
  windowStatus?: string;
}

export interface TeacherSubjectSubmissionItem {
  id?: string;
  title: string;
  due: string;
  mode: "Individual" | "Group";
  window: string;
  status: string;
  submitted: number;
  total: number;
  late: number;
  instructions?: string;
  allowLateSubmission?: boolean;
  openAt?: string;
  closeAt?: string;
  maxFileSizeMb?: number;
  acceptedFileTypes?: string[];
  externalLinksAllowed?: boolean;
  notifyByEmail?: boolean;
}

export interface TeacherSubjectStudentItem {
  name: string;
  id: string;
  status: string;
  submitted: number;
  graded: number;
}

export interface TeacherSubjectGroupItem {
  id: string;
  name: string;
  code: string;
  status: string;
  section: string;
  leader: string;
  memberCount: number;
  members: string[];
  memberDetails: Array<{ id: string; name: string; isLeader: boolean }>;
}

export interface TeacherSubjectRuleItem {
  label: string;
  value: string;
}

export interface TeacherAnnouncementItem {
  id?: string;
  title: string;
  body: string;
  audience: string;
  sent: string;
}

export interface TeacherActivityLogItem {
  id?: string;
  time: string;
  action: string;
  details: string;
}

export interface TeacherSubjectResponse {
  groupEnabled?: boolean;
  code: string;
  name: string;
  status: string;
  section: string;
  studentsCount: number;
  term: string;
  overview: Array<{ l: string; v: string }>;
  submissions: TeacherSubjectSubmissionItem[];
  students: TeacherSubjectStudentItem[];
  groups: TeacherSubjectGroupItem[];
  rules: TeacherSubjectRuleItem[];
  announcements: TeacherAnnouncementItem[];
  logs: TeacherActivityLogItem[];
}

export interface StudentSubjectActivityItem {
  id: number;
  title: string;
  type: "Individual" | "Group";
  due: string;
  fileTypes: string;
  window: string;
  status: string;
  action: string;
  daysLeft: number;
}

export interface StudentSubjectMemberItem {
  name: string;
  role: string;
  status: string;
}

export interface StudentSubjectResponse {
  groupEnabled: boolean;
  code: string;
  name: string;
  teacher: string;
  section: string;
  term: string;
  activitiesCount: number;
  overview: Array<{ label: string; value: string }>;
  activities: StudentSubjectActivityItem[];
  group: {
    id?: string;
    name?: string;
    code: string;
    leader: string;
    membersCount: string;
    locked: string;
    status: string;
  } | null;
  members: StudentSubjectMemberItem[];
  recentActivity: string[];
}


export interface TeacherDashboardKpi {
  label: string;
  value: string;
  tone: "teal" | "blue" | "amber" | "emerald";
}

export interface TeacherDashboardChartItem {
  name: string;
  value: number;
  fill: string;
}

export interface TeacherPendingReviewItem {
  title: string;
  student: string;
  subject: string;
  submitted: string;
  status: string;
}

export interface TeacherDeadlineItem {
  activity: string;
  activityId?: string;
  subject: string;
  subjectId?: string;
  due: string;
  daysLeft: number;
  submitted: number;
  total: number;
}

export interface TeacherDashboardResponse {
  greeting: string;
  subtext: string;
  kpis: TeacherDashboardKpi[];
  chartData: TeacherDashboardChartItem[];
  pending: TeacherPendingReviewItem[];
  upcomingDeadlines: TeacherDeadlineItem[];
}

export interface TeacherSubjectCard {
  id?: string;
  code: string;
  name: string;
  section: string;
  students: number;
  activities: number;
  pending: number;
}

export interface TeacherStudentRecord {
  id: string;
  studentId?: string;
  academicYear?: string;
  name: string;
  email: string;
  section: string;
  subjects: number;
  status: string;
}

export interface StudentSubjectCard {
  id: string;
  code: string;
  name: string;
  teacher: string;
  section: string;
  term: string;
  activities: number;
  status: string;
}

export interface StudentPortalNotification {
  id: string;
  date: string;
  type: "feedback" | "grade" | "overdue" | "deadline" | "account" | "info";
  read: boolean;
  title: string;
  body: string;
  time: string;
}

export interface AdminTeacherRecord {
  id: string;
  name: string;
  email: string;
  dept: string;
  employeeId?: string | null;
  subjects: number;
  students: number;
  status: string;
  lastActive?: string;
}

export interface AdminTeacherUpsertInput {
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  department?: string;
}

export interface AdminDepartmentRecord {
  id: string;
  name: string;
  description?: string;
  teachers: number;
  subjects: number;
}

export interface AdminDepartmentCreateInput {
  name: string;
  description?: string;
}

export interface AdminSectionRecord {
  id: string;
  code: string;
  program: string;
  yearLevel: string;
  yearLevelId?: string;
  yearLevelName?: string;
  yearLevelLabel?: string;
  adviser: string;
  description?: string;
  students: number;
  subjects: number;
  ay: string;
  academicYear?: string;
  academicYearId?: string;
  academicYearStatus?: string;
  status: string;
}

export interface AdminSectionCreateInput {
  code: string;
  program: string;
  yearLevel: string;
  yearLevelId?: string;
  yearLevelName?: string;
  academicYearId?: string;
  academicYear?: string;
  adviserName?: string;
  description?: string;
}

export interface AdminAcademicYearLevelRecord {
  id: string;
  name: string;
  sectionCount: number;
  studentCount: number;
}

export interface AdminAcademicYearRecord {
  id: string;
  name: string;
  status: string;
  sectionCount: number;
  studentCount: number;
  courseCount: number;
  yearLevelCount: number;
  yearLevels: AdminAcademicYearLevelRecord[];
}

export interface SectionMasterListStudentRecord {
  id: string;
  studentId: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
}

export interface SectionMasterListResponse {
  section: {
    id: string;
    name: string;
    academicYear: string;
    yearLevel: string;
    adviser?: string;
    course?: string;
    subjectCount?: number;
    studentCount?: number;
  };
  rows: SectionMasterListStudentRecord[];
}

export interface AdminRequestRecord {
  id: string;
  requester: string;
  role: "Student" | "Teacher" | "Admin";
  type: string;
  subject: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
  details: string;
}

export interface SignInPayload {
  role: AppRole;
  identifier: string;
  password: string;
}

export interface SignInResponse {
  session: AuthSession;
  redirectTo: string;
}


export interface StudentProfileResponse {
  initials: string;
  fullName: string;
  roleLabel: string;
  avatarRelativePath?: string;
  summary: Array<{ label: string; value: string; tone?: string }>;
  form: { firstName: string; lastName: string; email: string; phone: string; avatarRelativePath?: string };
}

export interface TeacherProfileResponse {
  initials: string;
  fullName: string;
  roleLabel: string;
  avatarRelativePath?: string;
  summary: Array<{ label: string; value: string; tone?: string }>;
  form: { firstName: string; lastName: string; email: string; phone: string; office: string; avatarRelativePath?: string };
}

export interface AdminProfileResponse {
  initials: string;
  fullName: string;
  roleLabel: string;
  avatarRelativePath?: string;
  summary: Array<{ label: string; value: string; tone?: string }>;
  form: { firstName: string; lastName: string; email: string; phone: string; office: string; avatarRelativePath?: string };
}

export interface TeacherPortalNotification {
  id: string;
  date: string;
  type: "submit" | "deadline" | "grade" | "info";
  read: boolean;
  title: string;
  body: string;
  time: string;
}

export interface AdminStudentViewResponse {
  initials: string;
  name: string;
  subtitle: string;
  status: string;
  form: AdminStudentUpsertInput;
  accountDetails: Array<{ label: string; value: string }>;
  assignedSubjects: string[];
  stats: Array<{ l: string; v: string }>;
  recentSubmissions: Array<{ title: string; subject: string; date: string; status: string }>;
}

export interface AdminTeacherViewResponse {
  initials: string;
  name: string;
  subtitle: string;
  status: string;
  form: AdminTeacherUpsertInput;
  accountDetails: Array<{ label: string; value: string }>;
  stats: Array<{ l: string; v: string }>;
  handledSubjects: Array<{ code: string; name: string; section: string; students: number }>;
}

export interface AdminSubjectUpsertInput {
  code: string;
  name: string;
  teacherId: string;
  status: string;
  groupEnabled: boolean;
  allowLateSubmission: boolean;
  sectionCodes: string[];
}

export interface AdminSubjectViewResponse {
  code: string;
  name: string;
  term: string;
  status: string;
  form: AdminSubjectUpsertInput & { teacherName?: string };
  details: Array<{ l: string; v: string }>;
  stats: Array<{ l: string; v: string }>;
}

export interface AdminSubmissionFileItem {
  name: string;
  href?: string;
}

export interface AdminSubmissionViewResponse {
  title: string;
  subtitle: string;
  status: string;
  details: Array<{ l: string; v: string }>;
  files: AdminSubmissionFileItem[];
  timeline: Array<{ e: string; t: string }>;
  feedback: string;
  adminNote?: string;
}


export interface AcademicSettingsResponse {
  schoolYear: string;
  semester: string;
  periodStart: string;
  periodEnd: string;
  latePolicy: string;
  lateDeduction: string;
  allowedTypes: string[];
}

export interface SystemSettingsResponse {
  schoolName: string;
  email: string;
  notifEmail: string;
  minPassLen: string;
  maxFailedLogins: string;
  sessionTimeout: string;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  twoFactorAdmin: boolean;
  backupFrequency: string;
  accountAccessEmailsEnabled: boolean;
  classroomActivityEmailsEnabled: boolean;
  classroomActivitySystemNotificationsEnabled: boolean;
}

export interface SystemToolRecord {
  id: string;
  title: string;
  desc: string;
  btn: string;
  danger: boolean;
  tone: string;
  status: string;
  lastRun: string;
  lastRunAt?: string;
}

export interface SeedCleanupUserPreview {
  id: string;
  email: string;
  role: string;
  name: string;
  studentNumber?: string | null;
  employeeId?: string | null;
}

export interface SeedCleanupSubjectPreview {
  id: string;
  code: string;
  name: string;
}

export interface SeedCleanupTaskPreview {
  id: string;
  title: string;
  subjectId: string;
}

export interface SeedCleanupGroupPreview {
  id: string;
  name: string;
  inviteCode: string;
  subjectId: string;
}

export interface SeedCleanupSubmissionPreview {
  id: string;
  title: string;
  studentId?: string | null;
  groupId?: string | null;
  subjectId: string;
}

export interface SeedCleanupNotificationPreview {
  id: string;
  userId: string;
  title: string;
}

export interface SeedCleanupMailJobPreview {
  id: string;
  email: string;
  idempotencyKey?: string | null;
}

export interface SeedCleanupPreview {
  summary: string;
  safeToExecute: boolean;
  totalRecords: number;
  nonZeroEntityCount: number;
  confirmationWord: string;
  backupRequired: boolean;
  envGuards: {
    allowSeedDataCleanup: boolean;
    production: boolean;
    allowProductionAdminToolRuns: boolean | null;
  };
  counts: {
    users: number;
    studentProfiles: number;
    teacherProfiles: number;
    subjects: number;
    activities: number;
    groups: number;
    submissions: number;
    notifications: number;
    mailJobs: number;
  };
  details: string[];
  executionDetails: string[];
  users: SeedCleanupUserPreview[];
  subjects: SeedCleanupSubjectPreview[];
  tasks: SeedCleanupTaskPreview[];
  groups: SeedCleanupGroupPreview[];
  submissions: SeedCleanupSubmissionPreview[];
  notifications: SeedCleanupNotificationPreview[];
  mailJobs: SeedCleanupMailJobPreview[];
}

export interface SystemToolRunResult {
  toolId: string;
  title: string;
  status: string;
  summary: string;
  details: string[];
  artifactPath?: string;
  ranAt: string;
  preview?: SeedCleanupPreview;
}

export interface SystemToolRunResponse {
  tools: SystemToolRecord[];
  result: SystemToolRunResult;
}

export interface BulkMoveStudent {
  id: string;
  name: string;
  studentNumber?: string;
}

export interface BulkMoveSectionRecord {
  id: string;
  academicYearId: string;
  academicYear: string;
  academicYearStatus?: string;
  course: string;
  yearLevel: string;
  yearLevelId?: string;
  yearLevelName?: string;
  adviser?: string;
  code: string;
  students: BulkMoveStudent[];
}

export interface BulkMoveAcademicYearRecord {
  id: string;
  name: string;
  status: string;
}

export interface BulkMoveDataResponse {
  academicYears: BulkMoveAcademicYearRecord[];
  sections: BulkMoveSectionRecord[];
}

export interface TeacherAssignedSectionRecord {
  id: string;
  code: string;
  academicYear: string;
  yearLevel: string;
  course: string;
  students: number;
  subjects: number;
  adviser?: string;
}


export interface MailJobRecipient {
  email: string;
  userId?: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
  fullName?: string;
  studentId?: string;
  teacherId?: string;
  employeeId?: string;
  isExternal: boolean;
}

export interface MailJobRecord {
  id: string;
  to: string;
  recipient?: MailJobRecipient;
  deliveryRecipient?: string;
  routedToTestmail?: boolean;
  fromEmail?: string;
  template: string;
  status: "queued" | "processing" | "sent" | "failed" | "dead" | "cancelled";
  createdAt: string;
  sentAt?: string;
  archivedAt?: string;
  provider?: string;
  attempts?: number;
  maxAttempts?: number;
  retryableFailure?: boolean;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastError?: string;
  failureHint?: string;
  failureReason?: string;
  providerMessageId?: string;
}

export interface MailRuntimeStatus {
  provider: string;
  workerHealthy?: boolean;
  workerHeartbeatAgeSeconds?: number | null;
  workerEnabled: boolean | null;
  workerRunning: boolean | null;
  workerId?: string | null;
  workerPollMs?: number | null;
  workerLastHeartbeatAt?: string | null;
  workerLastProcessedAt?: string | null;
  queueDepth: number;
  queuedCount?: number;
  processingCount: number;
  queuedTooLongCount?: number;
  processingTooLongCount?: number;
  failedCount: number;
  deadCount: number;
  archivedCount?: number;
  recentDeadCount?: number;
  pausedLimitReached: number;
  sent24h: number;
  latestSentAt?: string | null;
  latestProcessedAt?: string | null;
  latestFailureReason?: string | null;
  latestSafeProviderError?: string | null;
  recentFailureReason?: string | null;
  recentFailureSafeMessage?: string | null;
  senderConfig?: {
    fromName?: string | null;
    admin?: string | null;
    noreply?: string | null;
    invite?: string | null;
    notification?: string | null;
    support?: string | null;
  };
  senderConfigIssues?: string[];
  alerts?: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
  detail?: string;
}


export interface SystemHealthRecord {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  checkedAt: string;
}

export interface BackupRunRecord {
  id: string;
  status: string;
  trigger: string;
  backupType: string;
  fileName?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  storage: string;
  isProtected: boolean;
  startedAt: string;
  completedAt?: string | null;
  deletedAt?: string | null;
  error?: string | null;
}

export interface BackupHistoryResponse {
  latestSuccessful: BackupRunRecord | null;
  oldestAvailable: BackupRunRecord | null;
  totalBackups: number;
  failedBackups: number;
  storageUsedBytes: number;
  nextAutomaticBackup?: string | null;
  rows: BackupRunRecord[];
}


export interface ReleaseStatusItem {
  area: string;
  status: "done" | "in_progress" | "pending";
  detail: string;
}


export interface BootstrapStepItem {
  title: string;
  status: "ready" | "action_needed" | "info";
  detail: string;
}
