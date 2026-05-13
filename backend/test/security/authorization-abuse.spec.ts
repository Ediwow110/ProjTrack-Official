import 'reflect-metadata';
import { ROLES_KEY } from '../../src/auth/guards/roles.decorator';
import { AdminController } from '../../src/admin/admin.controller';
import { FilesController } from '../../src/files/files.controller';
import { SubmissionsController } from '../../src/submissions/submissions.controller';
import { ProfileController } from '../../src/profile/profile.controller';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { HealthController } from '../../src/health/health.controller';

function classRoles(controller: Function): string[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, controller);
}

function methodRoles(controller: Function, methodName: string): string[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, controller.prototype[methodName]);
}

describe('authorization abuse guardrails', () => {
  it('keeps the entire admin controller admin-only', () => {
    expect(classRoles(AdminController)).toEqual(['ADMIN']);
  });

  it('keeps file upload/download routes restricted to authenticated app roles', () => {
    expect(methodRoles(FilesController, 'uploadMultipart')).toEqual(['STUDENT', 'TEACHER', 'ADMIN']);
    expect(methodRoles(FilesController, 'uploadBase64')).toEqual(['STUDENT', 'TEACHER', 'ADMIN']);
    expect(methodRoles(FilesController, 'bySubmission')).toEqual(['STUDENT', 'TEACHER', 'ADMIN']);
    expect(methodRoles(FilesController, 'meta')).toEqual(['STUDENT', 'TEACHER', 'ADMIN']);
    expect(methodRoles(FilesController, 'download')).toEqual(['STUDENT', 'TEACHER', 'ADMIN']);
  });

  it('keeps file listing and deletion away from students', () => {
    expect(methodRoles(FilesController, 'list')).toEqual(['TEACHER', 'ADMIN']);
    expect(methodRoles(FilesController, 'remove')).toEqual(['TEACHER', 'ADMIN']);
  });

  it('keeps student submission routes student-only', () => {
    expect(methodRoles(SubmissionsController, 'studentList')).toEqual(['STUDENT']);
    expect(methodRoles(SubmissionsController, 'studentDetail')).toEqual(['STUDENT']);
    expect(methodRoles(SubmissionsController, 'submit')).toEqual(['STUDENT']);
  });

  it('keeps teacher submission routes teacher-only', () => {
    expect(methodRoles(SubmissionsController, 'teacherList')).toEqual(['TEACHER']);
    expect(methodRoles(SubmissionsController, 'teacherExport')).toEqual(['TEACHER']);
    expect(methodRoles(SubmissionsController, 'teacherDetail')).toEqual(['TEACHER']);
    expect(methodRoles(SubmissionsController, 'review')).toEqual(['TEACHER']);
  });

  it('keeps profile routes role-specific instead of broadly authenticated', () => {
    expect(methodRoles(ProfileController, 'studentProfile')).toEqual(['STUDENT']);
    expect(methodRoles(ProfileController, 'updateStudentProfile')).toEqual(['STUDENT']);
    expect(methodRoles(ProfileController, 'changeStudentPassword')).toEqual(['STUDENT']);
    expect(methodRoles(ProfileController, 'teacherProfile')).toEqual(['TEACHER']);
    expect(methodRoles(ProfileController, 'updateTeacherProfile')).toEqual(['TEACHER']);
    expect(methodRoles(ProfileController, 'changeTeacherPassword')).toEqual(['TEACHER']);
    expect(methodRoles(ProfileController, 'adminProfile')).toEqual(['ADMIN']);
    expect(methodRoles(ProfileController, 'updateAdminProfile')).toEqual(['ADMIN']);
    expect(methodRoles(ProfileController, 'changeAdminPassword')).toEqual(['ADMIN']);
  });

  it('keeps dashboard routes role-specific', () => {
    expect(methodRoles(DashboardController, 'studentSummary')).toEqual(['STUDENT']);
    expect(methodRoles(DashboardController, 'studentCharts')).toEqual(['STUDENT']);
    expect(methodRoles(DashboardController, 'upcoming')).toEqual(['STUDENT']);
    expect(methodRoles(DashboardController, 'teacherSummary')).toEqual(['TEACHER']);
    expect(methodRoles(DashboardController, 'adminSummary')).toEqual(['ADMIN']);
    expect(methodRoles(DashboardController, 'adminActivity')).toEqual(['ADMIN']);
  });

  it('keeps sensitive health detail routes admin-only', () => {
    expect(methodRoles(HealthController, 'storage')).toEqual(['ADMIN']);
    expect(methodRoles(HealthController, 'mail')).toEqual(['ADMIN']);
    expect(methodRoles(HealthController, 'configuration')).toEqual(['ADMIN']);
    expect(methodRoles(HealthController, 'database')).toEqual(['ADMIN']);
    expect(methodRoles(HealthController, 'backups')).toEqual(['ADMIN']);
  });
});
