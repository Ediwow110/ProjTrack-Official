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
    this.logger.warn('Data deletion execution worker enabled. Currently only supports dry-run; destructive path is blocked in this release.');
    this.timer = setInterval(() => {
      this.tick().catch((e) => this.logger.error('Execution worker tick failed', e as Error));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    // Placeholder: in future could scan for APPROVED + verified backup after retention window and queue.
    // For this PR, no-op to avoid any auto execution.
    this.logger.debug('Execution worker tick (dry-run only mode, no-op).');
  }
}
