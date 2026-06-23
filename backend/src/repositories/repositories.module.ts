import { Global, Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { SubjectRepository } from './subject.repository';
import { SubmissionRepository } from './submission.repository';
import { NotificationRepository } from './notification.repository';
import { AuditLogRepository } from './audit-log.repository';
import { AdminReportsRepository } from './admin-reports.repository';
import { SystemToolsRepository } from './system-tools.repository';
import { AcademicStructureRepository } from './academic-structure.repository';
import { SettingsRepository } from './settings.repository';
import { AnnouncementsRepository } from './announcements.repository';
import { RequestRepository } from './request.repository';

@Global()
@Module({
  providers: [
    UserRepository,
    SubjectRepository,
    SubmissionRepository,
    NotificationRepository,
    AuditLogRepository,
    AdminReportsRepository,
    SystemToolsRepository,
    AcademicStructureRepository,
    SettingsRepository,
    AnnouncementsRepository,
    RequestRepository,
  ],
  exports: [
    UserRepository,
    SubjectRepository,
    SubmissionRepository,
    NotificationRepository,
    AuditLogRepository,
    AdminReportsRepository,
    SystemToolsRepository,
    AcademicStructureRepository,
    SettingsRepository,
    AnnouncementsRepository,
    RequestRepository,
  ],
})
export class RepositoriesModule {}
