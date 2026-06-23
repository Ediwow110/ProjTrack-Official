import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuditLogsService } from './admin-audit-logs.service';
import { AdminSystemToolsService } from './admin-system-tools.service';
import { AdminUsersService } from './admin-users.service';
import { AdminSectionsService } from './admin-sections.service';
import { AdminSubjectsService } from './admin-subjects.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminSubmissionsService } from './admin-submissions.service';
import { AdminCalendarService } from './admin-calendar.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminGroupsService } from './admin-groups.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogsModule, MailModule, NotificationsModule],
  controllers: [AdminController],
  providers: [
    AdminAuditLogsService,
    AdminSystemToolsService,
    AdminSettingsService,
    AdminUsersService,
    AdminSectionsService,
    AdminSubjectsService,
    AdminSubmissionsService,
    AdminCalendarService,
    AdminNotificationsService,
    AdminReportsService,
    AdminGroupsService,
  ],
  exports: [
    AdminAuditLogsService,
    AdminSystemToolsService,
    AdminSettingsService,
    AdminUsersService,
    AdminSectionsService,
    AdminSubjectsService,
    AdminSubmissionsService,
    AdminCalendarService,
    AdminNotificationsService,
    AdminReportsService,
    AdminGroupsService,
  ],
})
export class AdminModule {}