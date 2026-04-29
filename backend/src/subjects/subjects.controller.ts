import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { SubjectsService } from './subjects.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Roles('STUDENT')
  @Get('student/subjects')
  studentSubjects(@Req() req: any) {
    return this.subjects.studentSubjects(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/subjects/:id')
  studentSubjectDetail(@Param('id') id: string, @Req() req: any) {
    return this.subjects.studentSubjectDetail(id, req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/submit-catalog')
  studentSubmitCatalog(@Req() req: any) {
    return this.subjects.studentSubmitCatalog(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/activities/:id/submission-context')
  submissionContext(@Param('id') id: string, @Req() req: any) {
    return this.subjects.studentSubmissionContext(id, req.user?.sub);
  }

  @Roles('STUDENT')
  @Post('student/groups')
  createGroup(@Body() body: { subjectId: string; name: string; leaderUserId?: string }, @Req() req: any) {
    return this.subjects.createGroup({ ...body, leaderUserId: req.user?.sub });
  }

  @Roles('STUDENT')
  @Post('student/groups/join-by-code')
  joinByCode(@Body() body: { subjectId?: string; code: string; userId?: string }, @Req() req: any) {
    return this.subjects.joinGroupByCode({ ...body, userId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Get('teacher/subjects')
  teacherSubjects(@Req() req: any) {
    return this.subjects.teacherSubjects(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/students')
  teacherStudents(@Req() req: any, @Query('search') search?: string, @Query('section') section?: string) {
    return this.subjects.teacherStudents(req.user?.sub, search, section);
  }

  @Roles('TEACHER')
  @Get('teacher/sections')
  teacherSections(@Req() req: any) {
    return this.subjects.teacherSections(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/sections/:id/master-list')
  teacherSectionMasterList(@Param('id') id: string, @Req() req: any) {
    return this.subjects.teacherSectionMasterList(id, req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/sections/:id/master-list/export')
  async teacherSectionMasterListExport(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const result = await this.subjects.teacherSectionMasterListExport(id, req.user?.sub);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=\"${result.fileName}\"`);
    return res.send(result.buffer);
  }

  @Roles('STUDENT')
  @Get('student/calendar/events')
  studentCalendar(@Req() req: any) {
    return this.subjects.studentCalendar(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/subjects/:id')
  teacherSubjectDetail(@Param('id') id: string, @Req() req: any) {
    return this.subjects.teacherSubjectDetail(id, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:id/submissions')
  createActivity(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.subjects.createTeacherActivity(id, { ...body, actorUserId: req.user?.sub });
  }


  @Roles('TEACHER')
  @Patch('teacher/subjects/:subjectId/submissions/:activityId')
  updateActivity(@Param('subjectId') subjectId: string, @Param('activityId') activityId: string, @Body() body: any, @Req() req: any) {
    return this.subjects.updateTeacherActivity(subjectId, activityId, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:subjectId/submissions/:activityId/reopen')
  reopenActivity(@Param('subjectId') subjectId: string, @Param('activityId') activityId: string, @Req() req: any) {
    return this.subjects.reopenTeacherActivity(subjectId, activityId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/approve')
  approveGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjects.teacherApproveGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/lock')
  lockGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjects.teacherLockGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/unlock')
  unlockGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjects.teacherUnlockGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/leader')
  assignGroupLeader(
    @Param('subjectId') subjectId: string,
    @Param('groupId') groupId: string,
    @Body() body: { memberId?: string },
    @Req() req: any,
  ) {
    return this.subjects.teacherAssignGroupLeader(subjectId, groupId, body.memberId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/members/:memberId/remove')
  removeGroupMember(
    @Param('subjectId') subjectId: string,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.subjects.teacherRemoveGroupMember(subjectId, groupId, memberId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:id/notify')
  notifyStudents(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.subjects.notifySubjectStudents(id, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:id/restrictions')
  updateRestrictions(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.subjects.updateRestrictions(id, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:id/reopen')
  reopen(@Param('id') id: string, @Req() req: any) {
    return this.subjects.reopenSubject(id, req.user?.sub);
  }
}
