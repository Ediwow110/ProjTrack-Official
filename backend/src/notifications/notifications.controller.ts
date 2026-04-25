import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles('STUDENT')
  @Get('student/notifications')
  studentNotifications(@Req() req: any) {
    return this.notifications.listForUser(req.user?.sub);
  }

  @Roles('STUDENT')
  @Post('student/notifications/:id/read')
  studentMarkRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user?.sub, id);
  }

  @Roles('STUDENT')
  @Post('student/notifications/mark-all-read')
  studentMarkAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/notifications')
  teacherNotifications(@Req() req: any) {
    return this.notifications.listForUser(req.user?.sub);
  }

  @Roles('TEACHER')
  @Post('teacher/notifications/:id/read')
  teacherMarkRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user?.sub, id);
  }

  @Roles('TEACHER')
  @Post('teacher/notifications/mark-all-read')
  teacherMarkAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user?.sub);
  }
}
