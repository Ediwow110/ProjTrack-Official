import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BackupStorageService } from './backup-storage.service';

@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BackupStorageService,
  ) {}

  async cleanupExpired(options: { retentionDays?: number; retentionCount?: number } = {}) {
    const retentionDays = Math.max(1, Number(options.retentionDays ?? process.env.BACKUP_RETENTION_DAYS ?? 30));
    const retentionCount = Math.max(1, Number(options.retentionCount ?? process.env.BACKUP_RETENTION_COUNT ?? 10));
    const now = new Date();
    const ageCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const latestSuccessful = await this.prisma.backupRun.findFirst({
      where: { status: 'COMPLETED', deletedAt: null },
      orderBy: { completedAt: 'desc' },
    });
    const visibleRuns = await this.prisma.backupRun.findMany({
      where: {
        deletedAt: null,
        isProtected: false,
        status: { not: 'RUNNING' },
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      take: 500,
    });

    const successfulRuns = visibleRuns.filter((run) => run.status === 'COMPLETED');
    const keepSuccessfulIds = new Set(
      successfulRuns.slice(0, retentionCount).map((run) => run.id),
    );
    if (latestSuccessful) keepSuccessfulIds.add(latestSuccessful.id);

    const expired = visibleRuns.filter((run) => {
      if (latestSuccessful?.id === run.id) return false;
      if (run.status === 'COMPLETED' && keepSuccessfulIds.has(run.id)) return false;
      const completedOrStartedAt = run.completedAt ?? run.startedAt;
      const ageExpired = completedOrStartedAt.getTime() < ageCutoff.getTime();
      const rowExpired = Boolean(run.expiresAt && run.expiresAt.getTime() < now.getTime());
      const countExpired = run.status === 'COMPLETED' && !keepSuccessfulIds.has(run.id);
      return ageExpired || rowExpired || countExpired;
    }).slice(0, 50);

    let deleted = 0;
    const failures: Array<{ id: string; reason: string }> = [];
    for (const run of expired) {
      if (latestSuccessful?.id === run.id) continue;
      try {
        if (run.fileName) this.storage.delete(run.fileName);
        await this.prisma.backupRun.update({
          where: { id: run.id },
          data: { deletedAt: new Date() },
        });
        deleted += 1;
        this.logger.log(`Backup retention retired ${run.id} (${run.fileName || 'no artifact'}).`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Backup retention could not delete ${run.id}: ${reason}`);
        failures.push({ id: run.id, reason });
      }
    }
    return {
      success: failures.length === 0,
      deleted,
      failed: failures.length,
      failures,
      retentionDays,
      retentionCount,
    };
  }
}
