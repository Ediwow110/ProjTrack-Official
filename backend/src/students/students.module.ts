import { Module } from '@nestjs/common';
import { AdminStudentsController } from './admin-students.controller';
import { AdminStudentsService } from './admin-students.service';
import { ImportFileService } from './import-file.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AuditLogsModule, MailModule, NotificationsModule, RepositoriesModule, AdminModule],
  controllers: [AdminStudentsController],
  providers: [AdminStudentsService, ImportFileService],
  exports: [AdminStudentsService],
})
export class StudentsModule {}
