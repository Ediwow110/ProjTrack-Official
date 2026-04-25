import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('STUDENT')
  @Get('student/dashboard/summary')
  studentSummary(@Req() req: any) {
    return this.dashboard.studentSummary(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/dashboard/charts')
  studentCharts(@Req() req: any) {
    return this.dashboard.studentCharts(req.user?.sub);
  }

  @Roles('STUDENT')
  @Get('student/dashboard/upcoming-deadlines')
  upcoming(@Req() req: any) {
    return this.dashboard.upcomingDeadlines(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/dashboard/summary')
  teacherSummary(@Req() req: any) {
    return this.dashboard.teacherSummary(req.user?.sub);
  }

  @Roles('ADMIN')
  @Get('admin/dashboard/summary')
  adminSummary() {
    return this.dashboard.adminSummary();
  }

  @Roles('ADMIN')
  @Get('admin/dashboard/activity')
  adminActivity() {
    return this.dashboard.adminActivity();
  }
}
