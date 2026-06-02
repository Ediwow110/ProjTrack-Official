import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataDeletionExecutionService } from './data-deletion-execution.service';

@Injectable()
export class DataDeletionExecutionWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataDeletionExecutionWorkerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly execution: DataDeletionExecutionService,
  ) {}

  onModuleInit() {
    const enabled = process.env.DATA_DELETION_EXECUTION_ENABLED === 'true';
    if (!enabled) {
      this.logger.log('Data deletion execution worker disabled (DATA_DELETION_EXECUTION_ENABLED != true). Dry-run and admin triggers only.');
      return;
    }
    this.logger.warn('Data deletion execution rollout is manual-only. Background auto-execution remains disabled even when the feature flag is true.');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    this.logger.warn('Data deletion background execution tick is disabled during the manual-only rollout.');
  }

  /**
   * Bulk execution remains disabled during Phase 7D initial rollout.
   * Use the per-request admin execution endpoint instead.
   */
  async scanAndExecute(): Promise<number> {
    this.logger.warn('Bulk data deletion scan is disabled during the manual-only rollout. Use the per-request admin execution endpoint.');
    return 0;
  }
}
