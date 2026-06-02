import { Module } from '@nestjs/common';
import { DataDeletionController } from './data-deletion.controller';
import { DataDeletionService } from './data-deletion.service';
import { DataDeletionExecutionController } from './data-deletion-execution.controller';
import { DataDeletionExecutionService } from './data-deletion-execution.service';
import { DataDeletionExecutionWorkerService } from './data-deletion-execution.worker';

@Module({
  controllers: [DataDeletionController, DataDeletionExecutionController],
  providers: [DataDeletionService, DataDeletionExecutionService, DataDeletionExecutionWorkerService],
  exports: [DataDeletionService, DataDeletionExecutionService],
})
export class DataDeletionModule {}
