import { Global, Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { SubjectRepository } from './subject.repository';
import { SubmissionRepository } from './submission.repository';
import { NotificationRepository } from './notification.repository';
import { AuditLogRepository } from './audit-log.repository';
import { AdminOpsRepository } from './admin-ops.repository';
import { AdminReportsRepository } from './admin-reports.repository';

@Global()
@Module({
  providers: [
    UserRepository,
    SubjectRepository,
    SubmissionRepository,
    NotificationRepository,
    AuditLogRepository,
    AdminOpsRepository,
    AdminReportsRepository,
  ],
  exports: [
    UserRepository,
    SubjectRepository,
    SubmissionRepository,
    NotificationRepository,
    AuditLogRepository,
    AdminOpsRepository,
    AdminReportsRepository,
  ],
})
export class RepositoriesModule {}
