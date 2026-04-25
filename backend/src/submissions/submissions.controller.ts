import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { SubmissionsService } from './submissions.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Roles('STUDENT')
  @Get('student/submissions')
  studentList(@Req() req: any, @Query('status') status?: string) {
    return this.submissions.studentList(req.user?.sub, status);
  }

  @Roles('STUDENT')
  @Get('student/submissions/:id')
  studentDetail(@Param('id') id: string, @Req() req: any) {
    return this.submissions.studentDetail(id, req.user?.sub);
  }

  @Roles('STUDENT')
  @Post('student/submissions')
  submit(@Body() body: any, @Req() req: any) {
    return this.submissions.submit({ ...body, userId: req.user?.sub });
  }

  @Roles('TEACHER')
  @Get('teacher/submissions')
  teacherList(@Req() req: any, @Query('section') section?: string, @Query('status') status?: string, @Query('subjectId') subjectId?: string) {
    return this.submissions.teacherList({ teacherId: req.user?.sub, section, status, subjectId });
  }

  @Roles('TEACHER')
  @Get('teacher/submissions/export')
  teacherExport(@Req() req: any, @Query('section') section?: string, @Query('status') status?: string, @Query('subjectId') subjectId?: string) {
    return this.submissions.teacherExport({ teacherId: req.user?.sub, section, status, subjectId });
  }

  @Roles('TEACHER')
  @Get('teacher/submissions/:id')
  teacherDetail(@Param('id') id: string, @Req() req: any) {
    return this.submissions.teacherDetail(id, req.user?.sub);
  }

  @Roles('TEACHER')
  @Patch('teacher/submissions/:id/review')
  review(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.submissions.review(id, { ...body, actorUserId: req.user?.sub });
  }
}
