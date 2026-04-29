import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupRetentionService } from './backup-retention.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupWorkerService } from './backup-worker.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupWorkerService, BackupRetentionService, BackupStorageService],
  exports: [BackupsService, BackupWorkerService, BackupRetentionService],
})
export class BackupsModule {}
