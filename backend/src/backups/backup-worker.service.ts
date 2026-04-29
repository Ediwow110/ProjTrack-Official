import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupRetentionService } from './backup-retention.service';

@Injectable()
export class BackupWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupWorkerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly backups: BackupsService,
    private readonly retention: BackupRetentionService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Backup worker is disabled. Set BACKUP_WORKER_ENABLED=true in one worker process to enable automatic backups.');
      return;
    }
    this.logger.log('Backup worker is enabled. Loading persisted automatic backup schedule.');
    this.timer = setInterval(() => {
      this.tick().catch((error) => this.logger.error('Backup worker tick failed.', error as Error));
    }, this.pollMs());
    this.tick().catch((error) => this.logger.error('Initial backup worker tick failed.', error as Error));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  status() {
    return {
      enabled: this.isEnabled(),
      running: Boolean(this.timer),
      pollMs: this.pollMs(),
    };
  }

  private async tick() {
    const settings = await this.backups.getBackupSettings();
    this.logger.log(
      `Backup schedule loaded: enabled=${settings.enabled}, frequency=${settings.frequency}, time=${settings.timeOfDay}, timezone=${settings.timezone}, next=${settings.nextScheduledBackup || 'none'}.`,
    );
    const result = await this.backups.createAutomaticBackupIfDue();
    if (result.ran) {
      await this.retention.cleanupExpired({
        retentionDays: settings.retentionDays,
        retentionCount: settings.retentionCount,
      });
      this.logger.log('Backup retention applied after automatic backup run.');
      return;
    }
    this.logger.log(`Automatic backup not run: ${result.reason}`);
  }

  private isEnabled() {
    return String(process.env.BACKUP_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  private pollMs() {
    return Math.max(10_000, Number(process.env.BACKUP_WORKER_POLL_MS || 60_000));
  }
}
