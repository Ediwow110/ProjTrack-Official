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
    this.logger.warn('Data deletion execution worker enabled. Destructive path is gated by backup verification and dry-run.');
    this.timer = setInterval(() => {
      this.tick().catch((e) => this.logger.error('Execution worker tick failed', e as Error));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    const pending = await this.execution.findBackupVerifiedExecutions(5);
    for (const exec of pending) {
      this.logger.log(`Worker auto-triggering execution for ${exec.id} (request ${exec.requestId})`);
      try {
        await this.execution.attemptExecution(exec.id);
        this.logger.log(`Worker completed execution for ${exec.id}`);
      } catch (err) {
        this.logger.error(`Worker execution failed for ${exec.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Admin-triggered scan: find and execute all BACKUP_VERIFIED executions.
   * Returns the number of executions attempted.
   */
  async scanAndExecute(): Promise<number> {
    const pending = await this.execution.findBackupVerifiedExecutions(20);
    for (const exec of pending) {
      try {
        await this.execution.attemptExecution(exec.id);
        this.logger.log(`scanAndExecute completed for ${exec.id}`);
      } catch (err) {
        this.logger.error(`scanAndExecute failed for ${exec.id}: ${(err as Error).message}`);
      }
    }
    return pending.length;
  }
}
