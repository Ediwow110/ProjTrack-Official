import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AdminModule } from './admin/admin.module';
import { ProfileModule } from './profile/profile.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { AccessModule } from './access/access.module';
import { BackupsModule } from './backups/backups.module';
import { BrandingModule } from './branding/branding.module';

@Module({
  imports: [PrismaModule, AccessModule, RepositoriesModule, AuthModule, StudentsModule, AuditLogsModule, MailModule, NotificationsModule, DashboardModule, SubjectsModule, SubmissionsModule, AdminModule, ProfileModule, FilesModule, BackupsModule, HealthModule, BrandingModule],
})
export class AppModule {}
