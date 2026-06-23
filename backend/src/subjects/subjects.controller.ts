import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { StudentSubjectsService } from './student-subjects.service';
import { TeacherSubjectsService } from './teacher-subjects.service';
import { SubjectGroupsService } from './subject-groups.service';
import {
  CreateGroupDto,
  JoinGroupByCodeDto,
  MemberIdDto,
  NotifySubjectDto,
  SubjectRestrictionsDto,
  TeacherActivityDto,
} from './dto/subject-action.dto';

const DEFAULT_TEACHER_STUDENTS_TAKE = 100;
const MAX_TEACHER_STUDENTS_TAKE = 500;
const DEFAULT_TEACHER_SECTIONS_TAKE = 100;
const MAX_TEACHER_SECTIONS_TAKE = 500;

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function parseBoundedTake(value: unknown, fallback: number, max: number) {
  const parsed = parsePositiveInt(value, fallback);
  return Math.max(1, Math.min(parsed, max));
}

@UseGuards(JwtAuthGuard)
@Controller()
export class SubjectsController {
  constructor(
    private readonly studentSubjectsService: StudentSubjectsService,
    private readonly teacherSubjectsService: TeacherSubjectsService,
    private readonly subjectGroupsService: SubjectGroupsService,
  ) {}

  @Roles('STUDENT')
  @Get('student/subjects')
  studentSubjects(@Req() req: any) {
    return this.studentSubjectsService.studentSubjects(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/subjects/:id')
  studentSubjectDetail(@Param('id') id: string, @Req() req: any) {
    return this.studentSubjectsService.studentSubjectDetail(id, req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/submit-catalog')
  studentSubmitCatalog(@Req() req: any) {
    return this.studentSubjectsService.studentSubmitCatalog(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/activities/:id/submission-context')
  submissionContext(@Param('id') id: string, @Req() req: any) {
    return this.studentSubjectsService.studentSubmissionContext(id, req.user?.sub);
  }

  @Roles('STUDENT')
  @Post('student/groups')
  createGroup(@Body() body: CreateGroupDto, @Req() req: any) {
    return this.subjectGroupsService.createGroup({ ...body, leaderUserId: req.user?.sub });
  }

  @Roles('STUDENT')
  @Post('student/groups/join-by-code')
  joinByCode(@Body() body: JoinGroupByCodeDto, @Req() req: any) {
    return this.subjectGroupsService.joinGroupByCode({ ...body, userId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Get('teacher/subjects')
  teacherSubjects(@Req() req: any) {
    return this.teacherSubjectsService.teacherSubjects(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/students')
  async teacherStudents(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('section') section?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const boundedTake = parseBoundedTake(take, DEFAULT_TEACHER_STUDENTS_TAKE, MAX_TEACHER_STUDENTS_TAKE);
    const boundedSkip = parsePositiveInt(skip, 0);
    return this.teacherSubjectsService.teacherStudents(req.user?.sub, search, section, { take: boundedTake, skip: boundedSkip });
  }

  @Roles('TEACHER')
  @Get('teacher/sections')
  async teacherSections(@Req() req: any, @Query('take') take?: string, @Query('skip') skip?: string) {
    const boundedTake = parseBoundedTake(take, DEFAULT_TEACHER_SECTIONS_TAKE, MAX_TEACHER_SECTIONS_TAKE);
    const boundedSkip = parsePositiveInt(skip, 0);
    // rows.slice(boundedSkip, boundedSkip + boundedTake)
    return this.teacherSubjectsService.teacherSections(req.user?.sub, { take: boundedTake, skip: boundedSkip });
  }

  @Roles('TEACHER')
  @Get('teacher/sections/:id/master-list')
  teacherSectionMasterList(@Param('id') id: string, @Req() req: any) {
    return this.teacherSubjectsService.teacherSectionMasterList(id, req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/sections/:id/master-list/export')
  async teacherSectionMasterListExport(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const result = await this.teacherSubjectsService.teacherSectionMasterListExport(id, req.user?.sub);
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
    return this.studentSubjectsService.studentCalendar(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/subjects/:id')
  teacherSubjectDetail(@Param('id') id: string, @Req() req: any) {
    return this.teacherSubjectsService.teacherSubjectDetail(id, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:id/submissions')
  createActivity(@Param('id') id: string, @Body() body: TeacherActivityDto, @Req() req: any) {
    return this.teacherSubjectsService.createTeacherActivity(id, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:subjectId/submissions/:activityId')
  updateActivity(@Param('subjectId') subjectId: string, @Param('activityId') activityId: string, @Body() body: TeacherActivityDto, @Req() req: any) {
    return this.teacherSubjectsService.updateTeacherActivity(subjectId, activityId, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:subjectId/submissions/:activityId/reopen')
  reopenActivity(@Param('subjectId') subjectId: string, @Param('activityId') activityId: string, @Req() req: any) {
    return this.teacherSubjectsService.reopenTeacherActivity(subjectId, activityId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/approve')
  approveGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjectGroupsService.teacherApproveGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/lock')
  lockGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjectGroupsService.teacherLockGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/unlock')
  unlockGroup(@Param('subjectId') subjectId: string, @Param('groupId') groupId: string, @Req() req: any) {
    return this.subjectGroupsService.teacherUnlockGroup(subjectId, groupId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/leader')
  assignGroupLeader(
    @Param('subjectId') subjectId: string,
    @Param('groupId') groupId: string,
    @Body() body: MemberIdDto,
    @Req() req: any,
  ) {
    return this.subjectGroupsService.teacherAssignGroupLeader(subjectId, groupId, body.memberId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:subjectId/groups/:groupId/members/:memberId/remove')
  removeGroupMember(
    @Param('subjectId') subjectId: string,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.subjectGroupsService.teacherRemoveGroupMember(subjectId, groupId, memberId, req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/subjects/:id/notify')
  notifyStudents(@Param('id') id: string, @Body() body: NotifySubjectDto, @Req() req: any) {
    return this.teacherSubjectsService.notifySubjectStudents(id, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:id/restrictions')
  updateRestrictions(@Param('id') id: string, @Body() body: SubjectRestrictionsDto, @Req() req: any) {
    return this.teacherSubjectsService.updateRestrictions(id, { ...body, actorUserId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Patch('teacher/subjects/:id/reopen')
  reopen(@Param('id') id: string, @Req() req: any) {
    return this.teacherSubjectsService.reopenSubject(id, req.user?.sub);
  }
}
