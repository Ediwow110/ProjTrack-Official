import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import ProtectedPortal from "./components/ProtectedPortal";

import { PortalLayout } from "./layouts/PortalLayout";

const LoginSelector = lazy(() => import("./pages/auth/LoginSelector"));
const StudentLogin = lazy(() => import("./pages/auth/StudentLogin"));
const TeacherLogin = lazy(() => import("./pages/auth/TeacherLogin"));
const AdminLogin = lazy(() => import("./pages/auth/AdminLogin"));
const ActivateAccountPage = lazy(() => import("./pages/auth/ActivateAccountPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));

const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentSubjects = lazy(() => import("./pages/student/Subjects"));
const StudentSubjectDetails = lazy(() => import("./pages/student/SubjectDetails"));
const StudentSubmitProject = lazy(() => import("./pages/student/SubmitProject"));
const StudentMySubmissions = lazy(() => import("./pages/student/MySubmissions"));
const StudentSubmissionDetail = lazy(() => import("./pages/student/SubmissionDetail"));
const StudentNotifications = lazy(() => import("./pages/student/Notifications"));
const StudentCalendar = lazy(() => import("./pages/student/Calendar"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));

const TeacherDashboard = lazy(() => import("./pages/teacher/Dashboard"));
const TeacherSubjects = lazy(() => import("./pages/teacher/Subjects"));
const TeacherSubjectView = lazy(() => import("./pages/teacher/SubjectView"));
const TeacherStudents = lazy(() => import("./pages/teacher/Students"));
const TeacherSubmissions = lazy(() => import("./pages/teacher/Submissions"));
const TeacherSubmissionReview = lazy(() => import("./pages/teacher/SubmissionReview"));
const TeacherNotifications = lazy(() => import("./pages/teacher/Notifications"));
const TeacherProfile = lazy(() => import("./pages/teacher/Profile"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminStudentView = lazy(() => import("./pages/admin/StudentView"));
const AdminTeachers = lazy(() => import("./pages/admin/Teachers"));
const AdminTeacherView = lazy(() => import("./pages/admin/TeacherView"));
const AdminDepartments = lazy(() => import("./pages/admin/Departments"));
const AdminSubjects = lazy(() => import("./pages/admin/Subjects"));
const AdminSubjectView = lazy(() => import("./pages/admin/SubjectView"));
const AdminSections = lazy(() => import("./pages/admin/Sections"));
const AdminSubmissions = lazy(() => import("./pages/admin/Submissions"));
const AdminSubmissionView = lazy(() => import("./pages/admin/SubmissionView"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminAcademicSettings = lazy(() => import("./pages/admin/AcademicSettings"));
const AdminRequests = lazy(() => import("./pages/admin/Requests"));
const AdminNotifications = lazy(() => import("./pages/admin/Notifications"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminSystemTools = lazy(() => import("./pages/admin/SystemTools"));
const AdminBulkMoveStudents = lazy(() => import("./pages/admin/BulkMoveStudents"));
const AdminGroups = lazy(() => import("./pages/admin/Groups"));
const AdminAnnouncements = lazy(() => import("./pages/admin/Announcements"));
const AdminCalendar = lazy(() => import("./pages/admin/Calendar"));
const AdminMailJobs = lazy(() => import("./pages/admin/MailJobs"));
const AdminFileInventory = lazy(() => import("./pages/admin/FileInventory"));
const AdminSystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const AdminReleaseStatus = lazy(() => import("./pages/admin/ReleaseStatus"));
const AdminBootstrapGuide = lazy(() => import("./pages/admin/BootstrapGuide"));
const AdminProfile = lazy(() => import("./pages/admin/Profile"));

function page(element: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] p-6 flex items-center justify-center text-sm text-slate-400">
          Loading page…
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/student/login" replace /> },
  { path: "/login", element: <Navigate to="/student/login" replace /> },
  { path: "/portals", element: page(<LoginSelector />) },
  { path: "/student/login", element: page(<StudentLogin />) },
  { path: "/teacher/login", element: page(<TeacherLogin />) },
  { path: "/admin/login", element: page(<AdminLogin />) },
  { path: "/login/student", element: <Navigate to="/student/login" replace /> },
  { path: "/login/teacher", element: <Navigate to="/teacher/login" replace /> },
  { path: "/login/admin", element: <Navigate to="/admin/login" replace /> },
  { path: "/auth/activate", element: page(<ActivateAccountPage />) },
  { path: "/auth/forgot-password", element: page(<ForgotPasswordPage />) },
  { path: "/auth/reset-password", element: page(<ResetPasswordPage />) },

  {
    path: "/student",
    element: <ProtectedPortal role="student"><PortalLayout role="student" /></ProtectedPortal>,
    children: [
      { index: true, element: <Navigate to="/student/dashboard" replace /> },
      { path: "dashboard", element: page(<StudentDashboard />) },
      { path: "subjects", element: page(<StudentSubjects />) },
      { path: "subjects/:id", element: page(<StudentSubjectDetails />) },
      { path: "submit", element: page(<StudentSubmitProject />) },
      { path: "submissions", element: page(<StudentMySubmissions />) },
      { path: "submissions/:id", element: page(<StudentSubmissionDetail />) },
      { path: "calendar", element: page(<StudentCalendar />) },
      { path: "notifications", element: page(<StudentNotifications />) },
      { path: "profile", element: page(<StudentProfile />) },
    ],
  },
  {
    path: "/teacher",
    element: <ProtectedPortal role="teacher"><PortalLayout role="teacher" /></ProtectedPortal>,
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      { path: "dashboard", element: page(<TeacherDashboard />) },
      { path: "subjects", element: page(<TeacherSubjects />) },
      { path: "subjects/:id", element: page(<TeacherSubjectView />) },
      { path: "students", element: page(<TeacherStudents />) },
      { path: "submissions", element: page(<TeacherSubmissions />) },
      { path: "submissions/:id", element: page(<TeacherSubmissionReview />) },
      { path: "notifications", element: page(<TeacherNotifications />) },
      { path: "profile", element: page(<TeacherProfile />) },
    ],
  },
  {
    path: "/admin",
    element: <ProtectedPortal role="admin"><PortalLayout role="admin" /></ProtectedPortal>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: page(<AdminDashboard />) },
      { path: "students", element: page(<AdminStudents />) },
      { path: "students/:id", element: page(<AdminStudentView />) },
      { path: "teachers", element: page(<AdminTeachers />) },
      { path: "teachers/:id", element: page(<AdminTeacherView />) },
      { path: "departments", element: page(<AdminDepartments />) },
      { path: "subjects", element: page(<AdminSubjects />) },
      { path: "subjects/:id", element: page(<AdminSubjectView />) },
      { path: "sections", element: page(<AdminSections />) },
      { path: "submissions", element: page(<AdminSubmissions />) },
      { path: "submissions/:id", element: page(<AdminSubmissionView />) },
      { path: "reports", element: page(<AdminReports />) },
      { path: "academic-settings", element: page(<AdminAcademicSettings />) },
      { path: "requests", element: page(<AdminRequests />) },
      { path: "notifications", element: page(<AdminNotifications />) },
      { path: "audit-logs", element: page(<AdminAuditLogs />) },
      { path: "settings", element: page(<AdminSettings />) },
      { path: "system-tools", element: page(<AdminSystemTools />) },
      { path: "groups", element: page(<AdminGroups />) },
      { path: "announcements", element: page(<AdminAnnouncements />) },
      { path: "calendar", element: page(<AdminCalendar />) },
      { path: "mail-jobs", element: page(<AdminMailJobs />) },
      { path: "file-inventory", element: page(<AdminFileInventory />) },
      { path: "system-health", element: page(<AdminSystemHealth />) },
      { path: "release-status", element: page(<AdminReleaseStatus />) },
      { path: "bootstrap-guide", element: page(<AdminBootstrapGuide />) },
      { path: "profile", element: page(<AdminProfile />) },
      { path: "bulk-move", element: page(<AdminBulkMoveStudents />) },
    ],
  },
  { path: "/dashboard", element: <Navigate to="/student/dashboard" replace /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
