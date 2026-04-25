import { Global, Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { RepositoriesModule } from '../repositories/repositories.module';

@Global()
@Module({
  imports: [RepositoriesModule],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
