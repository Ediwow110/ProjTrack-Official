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
import { AdminService } from './admin.service';
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
  constructor(private readonly admin: AdminService) {}

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
    return this.admin.users(search, role, status);
  }

  @Post('users/admins')
  createAdmin(@Body() body: CreateAdminDto, @Req() req: any) {
    return this.admin.createAdmin(body, this.actorContext(req));
  }

  @Post('users/:id/activate')
  activateUser(@Param('id') id: string, @Req() req: any) {
    return this.admin.activateUser(id, this.actorContext(req));
  }

  @Post('users/:id/deactivate')
  deactivateUser(@Param('id') id: string, @Req() req: any) {
    return this.admin.deactivateUser(id, this.actorContext(req));
  }

  @Post('users/:id/send-reset-link')
  sendUserResetLink(@Param('id') id: string, @Req() req: any) {
    return this.admin.sendUserResetLink(id, this.actorContext(req));
  }

  @Post('users/:id/resend-activation')
  resendUserActivation(@Param('id') id: string, @Req() req: any) {
    return this.admin.resendUserActivation(id, this.actorContext(req));
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @Query('confirmation') confirmation?: string,
    @Req() req?: any,
  ) {
    return this.admin.deleteUser(id, confirmation, this.actorContext(req));
  }

  @Get('teachers')
  teachers(@Query('search') search?: string, @Query('status') status?: string) {
    return this.admin.teachers(search, status);
  }

  @Get('departments')
  departments(@Query('search') search?: string) {
    return this.admin.departments(search);
  }

  @Post('departments')
  createDepartment(@Body() body: CreateDepartmentDto, @Req() req: any) {
    return this.admin.createDepartment(body, this.actorContext(req));
  }

  @Get('departments/:id')
  departmentDetail(@Param('id') id: string) {
    return this.admin.department(id);
  }

  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() body: UpdateDepartmentDto, @Req() req: any) {
    return this.admin.updateDepartment(id, body, this.actorContext(req));
  }

  @Delete('departments/:id')
  deleteDepartment(@Param('id') id: string, @Query('confirmation') confirmation?: string, @Req() req?: any) {
    return this.admin.deleteDepartment(id, confirmation, this.actorContext(req));
  }

  @Get('sections')
  sections(@Query('search') search?: string, @Query('academicYearId') academicYearId?: string) {
    return this.admin.sections(search, academicYearId);
  }

  @Post('sections')
  createSection(@Body() body: CreateSectionDto) {
    return this.admin.createSection(body);
  }

  @Get('sections/:id/master-list')
  sectionMasterList(@Param('id') id: string) {
    return this.admin.sectionMasterList(id);
  }

  @Get('sections/:id/master-list/export')
  async sectionMasterListExport(@Param('id') id: string, @Res() res: any) {
    const result = await this.admin.sectionMasterListExport(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=\"${result.fileName}\"`);
    return res.send(result.buffer);
  }

  @Get('academic-years')
  academicYears(@Query('search') search?: string) {
    return this.admin.academicYears(search);
  }

  @Post('academic-years')
  createAcademicYear(@Body() body: CreateAcademicYearDto) {
    return this.admin.createAcademicYear(body);
  }

  @Post('academic-years/:id/year-levels')
  createAcademicYearLevel(@Param('id') id: string, @Body() body: CreateAcademicYearLevelDto) {
    return this.admin.createAcademicYearLevel({ ...body, academicYearId: id });
  }

  @Get('students')
  students(@Query('search') search?: string, @Query('status') status?: string) {
    return this.admin.students(search, status);
  }

  @Post('students')
  createStudent(@Body() body: StudentMutationDto) {
    return this.admin.createStudent(body);
  }

  @Post('teachers')
  createTeacher(@Body() body: TeacherMutationDto) {
    return this.admin.createTeacher(body);
  }

  @Post('subjects')
  createSubject(@Body() body: SubjectMutationDto) {
    return this.admin.createSubject(body);
  }

  @Get('subjects')
  subjects(@Query('search') search?: string) {
    return this.admin.subjects(search);
  }

  @Post('students/:id/deactivate')
  deactivateStudent(@Param('id') id: string, @Req() req: any) {
    return this.admin.deactivateStudent(id, this.actorContext(req));
  }

  @Get('students/:id/detail')
  studentDetail(@Param('id') id: string) {
    return this.admin.studentDetail(id);
  }

  @Post('students/:id')
  updateStudent(@Param('id') id: string, @Body() body: StudentMutationDto) {
    return this.admin.updateStudent(id, body);
  }

  @Post('teachers/:id/activate')
  activateTeacher(@Param('id') id: string, @Req() req: any) {
    return this.admin.activateTeacher(id, this.actorContext(req));
  }

  @Post('teachers/:id/send-reset-link')
  sendTeacherResetLink(@Param('id') id: string, @Req() req: any) {
    return this.admin.sendTeacherResetLink(id, this.actorContext(req));
  }

  @Post('teachers/:id/deactivate')
  deactivateTeacher(@Param('id') id: string, @Req() req: any) {
    return this.admin.deactivateTeacher(id, this.actorContext(req));
  }

  @Get('teachers/:id/detail')
  teacherDetail(@Param('id') id: string) {
    return this.admin.teacherDetail(id);
  }

  @Post('teachers/:id')
  updateTeacher(@Param('id') id: string, @Body() body: TeacherMutationDto) {
    return this.admin.updateTeacher(id, body);
  }

  @Get('subjects/:id/detail')
  subjectDetail(@Param('id') id: string) {
    return this.admin.subjectDetail(id);
  }

  @Post('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() body: SubjectMutationDto) {
    return this.admin.updateSubject(id, body);
  }

  @Get('submissions/:id/detail')
  submissionDetail(@Param('id') id: string) {
    return this.admin.submissionDetail(id);
  }

  @Get('submissions')
  submissions(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('subjectId') subjectId?: string,
    @Query('studentId') studentId?: string,
    @Query('section') section?: string,
  ) {
    return this.admin.submissions(search, status, subjectId, studentId, section);
  }

  @Post('submissions')
  createSubmission(@Body() body: AdminSubmissionCreateDto, @Req() req: any) {
    return this.admin.createSubmission(body, this.actorContext(req));
  }

  @Patch('submissions/:id')
  updateSubmission(@Param('id') id: string, @Body() body: AdminSubmissionUpdateDto, @Req() req: any) {
    return this.admin.updateSubmission(id, body, this.actorContext(req));
  }

  @Delete('submissions/:id')
  deleteSubmission(
    @Param('id') id: string,
    @Query('confirmation') confirmation?: string,
    @Req() req?: any,
  ) {
    return this.admin.deleteSubmission(id, confirmation, this.actorContext(req));
  }

  @Post('submissions/:id/note')
  saveSubmissionNote(@Param('id') id: string, @Body() body: NoteDto) {
    return this.admin.saveSubmissionNote(id, body?.note ?? '');
  }

  @Get('requests')
  requests(@Query('status') status?: string) {
    return this.admin.requests(status);
  }

  @Post('requests/:id/approve')
  approveRequest(@Param('id') id: string) {
    return this.admin.requestAction(id, 'Approved');
  }

  @Post('requests/:id/reject')
  rejectRequest(@Param('id') id: string) {
    return this.admin.requestAction(id, 'Rejected');
  }

  @Get('settings/academic')
  getAcademicSettings() {
    return this.admin.getAcademicSettings();
  }

  @Post('settings/academic')
  saveAcademicSettings(@Body() body: AcademicSettingsDto, @Req() req: any) {
    return this.admin.saveAcademicSettings(body, this.actorContext(req));
  }

  @Get('settings/system')
  getSystemSettings() {
    return this.admin.getSystemSettings();
  }

  @Post('settings/system')
  saveSystemSettings(@Body() body: SystemSettingsDto, @Req() req: any) {
    return this.admin.saveSystemSettings(body, this.actorContext(req));
  }

  @Get('system-tools')
  getSystemTools() {
    return this.admin.getSystemTools();
  }

  @Post('system-tools/:id/run')
  runSystemTool(@Param('id') id: string, @Body() body: SystemToolRunDto, @Req() req: any) {
    return this.admin.runSystemTool(id, body, this.actorContext(req));
  }

  @Get('system-tools/artifact')
  downloadSystemToolArtifact(@Query('path') path: string, @Res() res: any) {
    const artifact = this.admin.downloadSystemToolArtifact(path);
    return res.download(artifact.absolutePath, artifact.fileName);
  }

  @Post('system-tools/backups/import')
  importSystemToolBackup(@Body() body: ImportSystemToolBackupDto) {
    return this.admin.importSystemToolBackup(body.fileName, body.contentBase64);
  }

  @Get('bulk-move')
  getBulkMoveData() {
    return this.admin.getBulkMoveData();
  }

  @Post('bulk-move')
  moveStudents(@Body() body: BulkMoveDto) {
    return this.admin.moveStudents(body.sourceSectionId ?? body.source, body.destSectionId ?? body.dest, body.ids);
  }

  @Get('reports/summary')
  reportSummary(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.admin.reportSummary(section, subjectId);
  }

  @Get('reports/current-view')
  reportCurrentView(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.admin.reportCurrentView(section, subjectId);
  }

  @Get('reports/export')
  reportExport(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.admin.reportExport(section, subjectId);
  }

  @Get('reports/dashboard')
  reportDashboard(@Query('section') section?: string, @Query('subjectId') subjectId?: string) {
    return this.admin.reportDashboard(section, subjectId);
  }

  @Get('groups')
  groups(@Query('section') section?: string, @Query('status') status?: string) {
    return this.admin.groups(section, status);
  }

  @Get('groups/:id')
  groupDetail(@Param('id') id: string) {
    return this.admin.groupDetail(id);
  }

  @Post('groups/:id/approve')
  approveGroup(@Param('id') id: string) {
    return this.admin.approveGroup(id);
  }

  @Post('groups/:id/lock')
  lockGroup(@Param('id') id: string) {
    return this.admin.lockGroup(id);
  }

  @Post('groups/:id/unlock')
  unlockGroup(@Param('id') id: string) {
    return this.admin.unlockGroup(id);
  }

  @Post('groups/:id/leader')
  assignGroupLeader(@Param('id') id: string, @Body() body: AssignGroupLeaderDto) {
    return this.admin.assignGroupLeader(id, body?.memberId);
  }

  @Post('groups/:id/members/:memberId/remove')
  removeGroupMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.admin.removeGroupMember(id, memberId);
  }

  @Get('notifications')
  notifications(@Query('role') role?: string, @Query('type') type?: string) {
    return this.admin.notificationsList(role, type);
  }

  @Post('notifications/read-all')
  markAllNotificationsRead(@Req() req: any) {
    return this.admin.markAllNotificationsRead(this.actorContext(req));
  }

  @Post('notifications/delete')
  deleteNotifications(@Body() body: IdsDto) {
    return this.admin.deleteNotifications(body?.ids ?? []);
  }

  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.admin.markNotificationRead(id);
  }

  @Post('notifications/broadcast')
  broadcast(@Body() body: BroadcastDto) {
    return this.admin.broadcast(body);
  }

  @Get('announcements')
  announcements() {
    return this.admin.announcements();
  }

  @Post('announcements')
  createAnnouncement(@Body() body: AnnouncementDto) {
    return this.admin.createAnnouncement(body);
  }

  @Post('announcements/delete')
  deleteAnnouncements(@Body() body: IdsDto) {
    return this.admin.deleteAnnouncements(body?.ids ?? []);
  }

  @Get('calendar/events')
  calendarEvents(@Query('audience') audience?: string, @Query('section') section?: string) {
    return this.admin.calendarEvents(audience, section);
  }

  @Get('calendar/events/:id')
  calendarEventDetail(@Param('id') id: string) {
    return this.admin.calendarEventDetail(id);
  }

  @Get('audit-logs')
  auditLogs(@Query('module') module?: string, @Query('role') role?: string) {
    return this.admin.auditList(module, role);
  }

  @Get('audit-logs/:id')
  auditLogDetail(@Param('id') id: string) {
    return this.admin.auditDetail(id);
  }
}
