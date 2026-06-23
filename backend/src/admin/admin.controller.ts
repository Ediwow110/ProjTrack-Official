import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import {
  UseGuards,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminSectionsService } from './admin-sections.service';
import { AdminSubjectsService } from './admin-subjects.service';
import { AdminSubmissionsService } from './admin-submissions.service';
import { AdminGroupsService } from './admin-groups.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminCalendarService } from './admin-calendar.service';
import { AdminAuditLogsService } from './admin-audit-logs.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminSystemToolsService } from './admin-system-tools.service';
import { AdminReportsService } from './admin-reports.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import {
  AcademicSettingsDto,
  AdminSubmissionCreateDto,
  AdminSubmissionUpdateDto,
  AnnouncementDto,
  AssignGroupLeaderDto,
  BroadcastDto,
  BulkMoveDto,
  CreateAcademicYearDto,
  CreateAcademicYearLevelDto,
  CreateCourseDto,
  CreateAdminDto,
  CreateSectionDto,
  IdsDto,
  ImportSystemToolBackupDto,
  NoteDto,
  StudentMutationDto,
  SubjectMutationDto,
  SystemSettingsDto,
  SystemToolRunDto,
  TeacherMutationDto,
} from './dto/admin-mutation.dto';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly adminSections: AdminSectionsService,
    private readonly adminSubjects: AdminSubjectsService,
    private readonly adminSubmissions: AdminSubmissionsService,
    private readonly adminGroups: AdminGroupsService,
    private readonly adminNotifications: AdminNotificationsService,
    private readonly adminCalendar: AdminCalendarService,
    private readonly adminAuditLogs: AdminAuditLogsService,
    private readonly adminSettings: AdminSettingsService,
    private readonly adminSystemTools: AdminSystemToolsService,
    private readonly adminReports: AdminReportsService,
  ) {}

  private actorContext(req: any) {
    return {
      actorUserId: String(req?.user?.sub ?? '').trim() || undefined,
      actorEmail: String(req?.user?.email ?? '').trim() || undefined,
      actorRole: String(req?.user?.role ?? 'ADMIN').trim() || 'ADMIN',
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent']
        ? String(req.headers['user-agent'])
        : undefined,
    };
  }

  @Get('users')
  users(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminUsers.users(search, role, status);
  }

  @Post('users/admins')
  createAdmin(@Body() body: CreateAdminDto, @Req() req: any) {
    return this.adminUsers.createAdmin(body, this.actorContext(req));
  }

  @Post('users/:id/activate')
  activateUser(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.activateUser(id, this.actorContext(req));
  }

  @Post('users/:id/deactivate')
  deactivateUser(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.deactivateUser(id, this.actorContext(req));
  }

  @Post('users/:id/send-reset-link')
  sendUserResetLink(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.sendUserResetLink(id, this.actorContext(req));
  }

  @Post('users/:id/resend-activation')
  resendUserActivation(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.resendUserActivation(id, this.actorContext(req));
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @Query('confirmation') confirmation?: string,
    @Req() req?: any,
  ) {
    return this.adminUsers.deleteUser(id, confirmation, this.actorContext(req));
  }

  @Get('teachers')
  teachers(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminUsers.teachers(search, status);
  }

  @Get('departments')
  departments(@Query('search') search?: string) {
    return this.adminSettings.departments(search);
  }

  @Post('departments')
  createDepartment(@Body() body: CreateDepartmentDto, @Req() req: any) {
    return this.adminSettings.createDepartment(body, this.actorContext(req));
  }

  @Get('departments/:id')
  departmentDetail(@Param('id') id: string) {
    return this.adminSettings.department(id);
  }

  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() body: UpdateDepartmentDto, @Req() req: any) {
    return this.adminSettings.updateDepartment(id, body, this.actorContext(req));
  }

  @Delete('departments/:id')
  deleteDepartment(@Param('id') id: string, @Query('confirmation') confirmation?: string, @Req() req?: any) {
    return this.adminSettings.deleteDepartment(id, confirmation, this.actorContext(req));
  }

  @Get('sections')
  sections(@Query('search') search?: string, @Query('academicYearId') academicYearId?: string) {
    return this.adminSections.sections(search, academicYearId);
  }

  @Post('sections')
  createSection(@Body() body: CreateSectionDto) {
    return this.adminSections.createSection(body);
  }

  @Get('sections/:id/master-list')
  sectionMasterList(@Param('id') id: string) {
    return this.adminSections.sectionMasterList(id);
  }

  @Get('sections/:id/master-list/export')
  async sectionMasterListExport(@Param('id') id: string, @Res() res: any) {
    const result = await this.adminSections.sectionMasterListExport(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=\"${result.fileName}\"`);
    return res.send(result.buffer);
  }

  @Get('academic-years')
  academicYears(@Query('search') search?: string) {
    return this.adminSettings.academicYears(search);
  }

  @Post('academic-years')
  createAcademicYear(@Body() body: CreateAcademicYearDto) {
    return this.adminSettings.createAcademicYear(body);
  }

  @Post('academic-years/:id/year-levels')
  createAcademicYearLevel(@Param('id') id: string, @Body() body: CreateAcademicYearLevelDto) {
    return this.adminSettings.createAcademicYearLevel({ ...body, academicYearId: id, courseId: body.courseId });
  }


  @Delete('academic-years/:id')
  deleteAcademicYear(@Param('id') id: string, @Req() req?: any) {
    return this.adminSettings.deleteAcademicYear(id, this.actorContext(req));
  }

  @Delete('academic-years/:yearId/year-levels/:levelId')
  deleteAcademicYearLevel(
    @Param('yearId') yearId: string,
    @Param('levelId') levelId: string,
    @Req() req?: any,
  ) {
    return this.adminSettings.deleteAcademicYearLevel(levelId, this.actorContext(req));
  }


  @Get('academic-years/:yearId/courses')
  listCourses(@Param('yearId') yearId: string) {
    return this.adminSettings.listCourses(yearId);
  }

  @Post('academic-years/:yearId/courses')
  createCourse(@Param('yearId') yearId: string, @Body() body: CreateCourseDto, @Req() req?: any) {
    return this.adminSettings.createCourse({ ...body, academicYearId: yearId }, this.actorContext(req));
  }

  @Delete('academic-years/:yearId/courses/:courseId')
  deleteCourse(
    @Param('yearId') yearId: string,
    @Param('courseId') courseId: string,
    @Req() req?: any,
  ) {
    return this.adminSettings.deleteCourse(courseId, this.actorContext(req));
  }

  @Delete('sections/:id')
  deleteSection(@Param('id') id: string, @Req() req?: any) {
    return this.adminSections.deleteSection(id, this.actorContext(req));
  }

  @Get('students')
  students(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminUsers.students(search, status);
  }

  @Post('students')
  createStudent(@Body() body: StudentMutationDto) {
    return this.adminUsers.createStudent(body);
  }

  @Post('teachers')
  createTeacher(@Body() body: TeacherMutationDto) {
    return this.adminUsers.createTeacher(body);
  }

  @Post('subjects')
  createSubject(@Body() body: SubjectMutationDto) {
    return this.adminSubjects.createSubject(body);
  }

  @Get('subjects')
  subjects(@Query('search') search?: string) {
    return this.adminSubjects.subjects(search);
  }

  @Post('students/:id/deactivate')
  deactivateStudent(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.deactivateStudent(id, this.actorContext(req));
  }

  @Get('students/:id/detail')
  studentDetail(@Param('id') id: string) {
    return this.adminUsers.studentDetail(id);
  }

  @Post('students/:id')
  updateStudent(@Param('id') id: string, @Body() body: StudentMutationDto) {
    return this.adminUsers.updateStudent(id, body);
  }

  @Post('teachers/:id/activate')
  activateTeacher(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.activateTeacher(id, this.actorContext(req));
  }

  @Post('teachers/:id/send-reset-link')
  sendTeacherResetLink(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.sendTeacherResetLink(id, this.actorContext(req));
  }

  @Post('teachers/:id/deactivate')
  deactivateTeacher(@Param('id') id: string, @Req() req: any) {
    return this.adminUsers.deactivateTeacher(id, this.actorContext(req));
  }

  @Get('teachers/:id/detail')
  teacherDetail(@Param('id') id: string) {
    return this.adminUsers.teacherDetail(id);
  }

  @Post('teachers/:id')
  updateTeacher(@Param('id') id: string, @Body() body: TeacherMutationDto) {
    return this.adminUsers.updateTeacher(id, body);
  }

  @Get('subjects/:id/detail')
  subjectDetail(@Param('id') id: string) {
    return this.adminSubjects.subjectDetail(id);
  }

  @Post('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() body: SubjectMutationDto) {
    return this.adminSubjects.updateSubject(id, body);
  }

  @Get('submissions/:id/detail')
  submissionDetail(@Param('id') id: string) {
    return this.adminSubmissions.submissionDetail(id);
  }

  @Get('submissions')
  submissions(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('subjectId') subjectId?: string,
    @Query('studentId') studentId?: string,
    @Query('section') section?: string,
  ) {
    return this.adminSubmissions.submissions(search, status, subjectId, studentId, section);
  }

  @Post('submissions')
  createSubmission(@Body() body: AdminSubmissionCreateDto, @Req() req: any) {
    return this.adminSubmissions.createSubmission(body, this.actorContext(req));
  }

  @Patch('submissions/:id')
  updateSubmission(@Param('id') id: string, @Body() body: AdminSubmissionUpdateDto, @Req() req: any) {
    return this.adminSubmissions.updateSubmission(id, body, this.actorContext(req));
  }

  @Delete('submissions/:id')
  deleteSubmission(
    @Param('id') id: string,
    @Query('confirmation') confirmation?: string,
    @Req() req?: any,
  ) {
    return this.adminSubmissions.deleteSubmission(id, confirmation, this.actorContext(req));
  }

  @Post('submissions/:id/note')
  saveSubmissionNote(@Param('id') id: string, @Body() body: NoteDto) {
    return this.adminSubmissions.saveSubmissionNote(id, body?.note ?? '');
  }

  @Get('requests')
  requests(@Query('status') status?: string) {
    return this.adminReports.requests(status);
  }

  @Post('requests/:id/approve')
  approveRequest(@Param('id') id: string) {
    return this.adminReports.requestAction(id, 'Approved');
  }

  @Post('requests/:id/reject')
  rejectRequest(@Param('id') id: string) {
    return this.adminReports.requestAction(id, 'Rejected');
  }

  @Get('settings/academic')
  getAcademicSettings() {
    return this.adminSettings.getAcademicSettings();
  }

  @Post('settings/academic')
  saveAcademicSettings(@Body() body: AcademicSettingsDto, @Req() req: any) {
    return this.adminSettings.saveAcademicSettings(body, this.actorContext(req));
  }

  @Get('settings/system')
  getSystemSettings() {
    return this.adminSettings.getSystemSettings();
  }

  @Post('settings/system')
  saveSystemSettings(@Body() body: SystemSettingsDto, @Req() req: any) {
    return this.adminSettings.saveSystemSettings(body, this.actorContext(req));
  }

  @Get('system-tools')
  getSystemTools() {
    return this.adminSystemTools.getSystemTools();
  }

  @Post('system-tools/:id/run')
  runSystemTool(@Param('id') id: string, @Body() body: SystemToolRunDto, @Req() req: any) {
    return this.adminSystemTools.runSystemTool(id, body, this.actorContext(req));
  }

  @Get('system-tools/artifact')
  downloadSystemToolArtifact(@Query('path') path: string, @Res() res: any) {
    const artifact = this.adminSystemTools.downloadSystemToolArtifact(path);
    return res.download(artifact.absolutePath, artifact.fileName);
  }

  @Post('system-tools/backups/import')
  importSystemToolBackup(@Body() body: ImportSystemToolBackupDto) {
    return this.adminSystemTools.importSystemToolBackup(body.fileName, body.contentBase64);
  }

  @Get('bulk-move')
  getBulkMoveData() {
    return this.adminSections.getBulkMoveData();
  }

  @Post('bulk-move')
  moveStudents(@Body() body: BulkMoveDto) {
    return this.adminSections.moveStudents(body.sourceSectionId ?? body.source, body.destSectionId ?? body.dest, body.ids);
  }

  @Get('reports/summary')
  reportSummary(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.adminReports.reportSummary(section, subjectId);
  }

  @Get('reports/current-view')
  reportCurrentView(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.adminReports.reportCurrentView(section, subjectId);
  }

  @Get('reports/export')
  reportExport(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.adminReports.reportExport(section, subjectId);
  }

  @Get('reports/dashboard')
  reportDashboard(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.adminReports.reportDashboard(section, subjectId);
  }

  @Get('groups')
  groups(@Query('section') section?: string, @Query('status') status?: string) {
    return this.adminGroups.groups(section, status);
  }

  @Get('groups/:id')
  groupDetail(@Param('id') id: string) {
    return this.adminGroups.groupDetail(id);
  }

  @Post('groups/:id/approve')
  approveGroup(@Param('id') id: string) {
    return this.adminGroups.approveGroup(id);
  }

  @Post('groups/:id/lock')
  lockGroup(@Param('id') id: string) {
    return this.adminGroups.lockGroup(id);
  }

  @Post('groups/:id/unlock')
  unlockGroup(@Param('id') id: string) {
    return this.adminGroups.unlockGroup(id);
  }

  @Post('groups/:id/leader')
  assignGroupLeader(@Param('id') id: string, @Body() body: AssignGroupLeaderDto) {
    return this.adminGroups.assignGroupLeader(id, body?.memberId);
  }

  @Post('groups/:id/members/:memberId/remove')
  removeGroupMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.adminGroups.removeGroupMember(id, memberId);
  }

  @Get('notifications')
  notifications(@Query('role') role?: string, @Query('type') type?: string) {
    return this.adminNotifications.notificationsList(role, type);
  }

  @Post('notifications/read-all')
  markAllNotificationsRead(@Req() req: any) {
    return this.adminNotifications.markAllNotificationsRead(this.actorContext(req));
  }

  @Post('notifications/delete')
  deleteNotifications(@Body() body: IdsDto) {
    return this.adminNotifications.deleteNotifications(body?.ids ?? []);
  }

  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.adminNotifications.markNotificationRead(id);
  }

  @Post('notifications/broadcast')
  broadcast(@Body() body: BroadcastDto) {
    return this.adminNotifications.broadcast(body);
  }

  @Get('announcements')
  announcements() {
    return this.adminNotifications.announcements();
  }

  @Post('announcements')
  createAnnouncement(@Body() body: AnnouncementDto) {
    return this.adminNotifications.createAnnouncement(body);
  }

  @Post('announcements/delete')
  deleteAnnouncements(@Body() body: IdsDto) {
    return this.adminNotifications.deleteAnnouncements(body?.ids ?? []);
  }

  @Get('calendar/events')
  calendarEvents(@Query('audience') audience?: string, @Query('section') section?: string) {
    return this.adminCalendar.calendarEvents(audience, section);
  }

  @Get('calendar/events/:id')
  calendarEventDetail(@Param('id') id: string) {
    return this.adminCalendar.calendarEventDetail(id);
  }

  @Get('audit-logs')
  auditLogs(
    @Query('module') module?: string,
    @Query('role') role?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminAuditLogs.auditList(
      module,
      role,
      take ? Number(take) : undefined,
      skip ? Number(skip) : undefined,
      from,
      to,
    );
  }

  @Get('audit-logs/:id')
  auditLogDetail(@Param('id') id: string) {
    return this.adminAuditLogs.auditDetail(id);
  }
}
