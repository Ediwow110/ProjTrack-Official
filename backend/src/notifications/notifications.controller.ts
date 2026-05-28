import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private parseOptionalPositiveInt(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(0, Math.floor(parsed));
  }

  @Roles('STUDENT')
  @Get('student/notifications')
  studentNotifications(
    @Req() req: any,
    @Query('take') take: string | undefined,
    @Query('skip') skip: string | undefined,
  ) {
    return this.notifications.listForUser(req.user?.sub, {
      take: this.parseOptionalPositiveInt(take),
      skip: this.parseOptionalPositiveInt(skip),
    });
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
  teacherNotifications(
    @Req() req: any,
    @Query('take') take: string | undefined,
    @Query('skip') skip: string | undefined,
  ) {
    return this.notifications.listForUser(req.user?.sub, {
      take: this.parseOptionalPositiveInt(take),
      skip: this.parseOptionalPositiveInt(skip),
    });
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
