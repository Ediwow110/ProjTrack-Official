import { Injectable } from '@nestjs/common';
import { EmailJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { MailLimitService } from '../mail/mail-limit.service';
import { MailTransportService } from '../mail/mail.transport.service';
import {
  MAIL_FAILURE_REASONS,
  MAIL_PROVIDER_NAMES,
} from '../common/constants/mail.constants';
import {
  mailProcessingWarningMs,
  mailQueuedWarningMs,
  mailWorkerHeartbeatStaleMs,
} from '../common/constants/queue.constants';
import { inspectRuntimeConfiguration } from '../config/runtime-safety';
import { BackupWorkerService } from '../backups/backup-worker.service';
import { BackupsService } from '../backups/backups.service';
import { MailWorker } from '../mail/mail.worker';
import {
  getMailSenderConfigIssues,
  publicMailSenderConfig,
} from '../mail/mail-sender-config';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly mailTransport: MailTransportService,
    private readonly mailLimits: MailLimitService,
    private readonly backups: BackupsService,
    private readonly backupWorker: BackupWorkerService,
    private readonly mailWorker: MailWorker,
  ) {}

  live() {
    return {
      ok: true,
      service: 'projtrack-backend',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const [database, storage, mail, configuration, backup] = await Promise.all([
      this.database(),
      Promise.resolve(this.files.healthCheck()),
      this.mailStatus(),
      Promise.resolve(this.configuration()),
      this.backupStatus(),
    ]);

    return {
      ok: database.ok && storage.ok && mail.ok && configuration.ok && backup.ok,
      service: 'projtrack-backend',
      checks: {
        database: database.ok,
        storage: storage.ok,
        mail: mail.ok,
        configuration: configuration.ok,
        backup: backup.ok,
      },
      timestamp: new Date().toISOString(),
    };
  }

  storage() {
    return this.files.healthCheck();
  }

  async mailStatus() {
    const now = new Date();
    const recentFailureThreshold = new Date(now.getTime() - 60 * 60 * 1000);
    const recentDeadThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const queuedWarningThreshold = new Date(now.getTime() - mailQueuedWarningMs());
    const processingWarningThreshold = new Date(now.getTime() - mailProcessingWarningMs());
    const activeProvider = this.mailTransport.getProviderName();
    const senderConfig = publicMailSenderConfig(process.env);
    const senderConfigIssues =
      activeProvider === MAIL_PROVIDER_NAMES.MAILRELAY
        ? getMailSenderConfigIssues(process.env)
        : [];
    const [
      transport,
      queued,
      processing,
      failed,
      dead,
      pausedLimitReached,
      archived,
      queuedTooLongCount,
      processingTooLongCount,
      recentDeadCount,
      sent24h,
      limits,
      latestFailure,
      latestSuccess,
      latestFailureAnyTime,
      latestProcessed,
      sharedWorkerHeartbeat,
    ] =
      await Promise.all([
      this.mailTransport.verifyTransport(),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.QUEUED, provider: activeProvider, archivedAt: null },
      }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.PROCESSING, provider: activeProvider, archivedAt: null },
      }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.FAILED, provider: activeProvider, archivedAt: null },
      }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.DEAD, provider: activeProvider, archivedAt: null },
      }),
      this.prisma.emailJob.count({
        where: {
          status: EmailJobStatus.PAUSED_LIMIT_REACHED,
          provider: activeProvider,
          archivedAt: null,
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          archivedAt: { not: null },
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: EmailJobStatus.QUEUED,
          updatedAt: { lt: queuedWarningThreshold },
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: EmailJobStatus.PROCESSING,
          lockedAt: { lt: processingWarningThreshold },
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: EmailJobStatus.DEAD,
          updatedAt: { gte: recentDeadThreshold },
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: EmailJobStatus.SENT,
          sentAt: {
            gte: recentDeadThreshold,
          },
        },
      }),
      this.mailLimits.getUsage(this.mailTransport.getProviderName()),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: { in: [EmailJobStatus.FAILED, EmailJobStatus.DEAD] },
          updatedAt: { gte: recentFailureThreshold },
          lastError: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          userEmail: true,
          subject: true,
          failureReason: true,
          lastError: true,
          updatedAt: true,
        },
      }),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          status: EmailJobStatus.SENT,
          sentAt: { not: null },
        },
        orderBy: { sentAt: 'desc' },
        select: {
          id: true,
          sentAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          archivedAt: null,
          status: { in: [EmailJobStatus.FAILED, EmailJobStatus.DEAD, EmailJobStatus.PAUSED_LIMIT_REACHED] },
          lastError: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          userEmail: true,
          subject: true,
          failureReason: true,
          lastError: true,
          updatedAt: true,
        },
      }),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          lastAttemptAt: { not: null },
        },
        orderBy: { lastAttemptAt: 'desc' },
        select: {
          id: true,
          status: true,
          lastAttemptAt: true,
          sentAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.workerHeartbeat.findUnique({
        where: { key: 'mail' },
        select: {
          workerId: true,
          provider: true,
          pollMs: true,
          heartbeatAt: true,
          lastProcessedJobAt: true,
        },
      }),
    ]);

    const recentFailure =
      latestFailure && latestFailure.lastError
        ? {
            id: latestFailure.id,
            status: latestFailure.status,
            recipientEmail: latestFailure.userEmail,
            subject: latestFailure.subject,
            failureReason: latestFailure.failureReason,
            message: latestFailure.lastError,
            updatedAt: latestFailure.updatedAt.toISOString(),
          }
        : null;

    const latestSuccessAt =
      latestSuccess?.sentAt instanceof Date
        ? latestSuccess.sentAt
        : latestSuccess?.updatedAt instanceof Date
          ? latestSuccess.updatedAt
          : null;
    const activeRecentFailure =
      recentFailure &&
      (!latestSuccessAt || latestFailure.updatedAt.getTime() >= latestSuccessAt.getTime())
        ? recentFailure
        : null;

    const heartbeatAgeSeconds =
      sharedWorkerHeartbeat?.heartbeatAt instanceof Date
        ? Math.max(0, Math.round((now.getTime() - sharedWorkerHeartbeat.heartbeatAt.getTime()) / 1000))
        : null;
    const heartbeatStaleMs = mailWorkerHeartbeatStaleMs(
      process.env,
      sharedWorkerHeartbeat?.pollMs || undefined,
    );
    const heartbeatProvider = sharedWorkerHeartbeat?.provider ?? null;
    const heartbeatProviderMatches =
      !heartbeatProvider || heartbeatProvider === activeProvider;
    const heartbeatFresh =
      Boolean(sharedWorkerHeartbeat?.heartbeatAt) &&
      now.getTime() - sharedWorkerHeartbeat.heartbeatAt.getTime() <= heartbeatStaleMs;
    const workerHealthy = heartbeatFresh && heartbeatProviderMatches;
    const queueDepth = queued + failed + processing + pausedLimitReached;
    const latestFailureDetail =
      latestFailureAnyTime && latestFailureAnyTime.lastError
        ? {
            id: latestFailureAnyTime.id,
            status: latestFailureAnyTime.status,
            recipientEmail: latestFailureAnyTime.userEmail,
            subject: latestFailureAnyTime.subject,
            failureReason: latestFailureAnyTime.failureReason,
            message: latestFailureAnyTime.lastError,
            updatedAt: latestFailureAnyTime.updatedAt.toISOString(),
          }
        : null;
    const alerts = this.mailAlerts({
      workerHealthy,
      heartbeatFresh,
      heartbeatProviderMatches,
      activeProvider,
      heartbeatProvider,
      workerHeartbeatAgeSeconds: heartbeatAgeSeconds,
      queueDepth,
      queuedTooLongCount,
      processingTooLongCount,
      recentDeadCount,
      latestFailureReason: latestFailureDetail?.failureReason ?? null,
      latestSafeProviderError: latestFailureDetail?.message ?? null,
    });
    const ok =
      transport.ok &&
      senderConfigIssues.length === 0 &&
      !activeRecentFailure &&
      processingTooLongCount === 0 &&
      workerHealthy;
    const workerExpected = true;
    const realDeliveryActive =
      activeProvider === MAIL_PROVIDER_NAMES.MAILRELAY &&
      transport.ok &&
      senderConfigIssues.length === 0 &&
      workerHealthy;
    const deliveryMode =
      activeProvider === MAIL_PROVIDER_NAMES.STUB
        ? 'local_stub'
        : activeProvider === MAIL_PROVIDER_NAMES.MAILRELAY
          ? 'mailrelay'
          : activeProvider;
    const detail = !transport.ok
      ? transport.detail
      : senderConfigIssues.length
        ? senderConfigIssues[0]
      : alerts[0]?.message
        ? alerts[0].message
      : activeRecentFailure
        ? `Recent mail delivery failure: ${activeRecentFailure.message}`
        : transport.detail;

    return {
      ...transport,
      providerName: activeProvider,
      providerConfigured: Boolean(transport.verified),
      deliveryMode,
      realDeliveryActive,
      localStub: activeProvider === MAIL_PROVIDER_NAMES.STUB,
      ok,
      detail,
      queued,
      processing,
      processingCount: processing,
      failed,
      dead,
      failedDeadCount: failed + dead,
      pausedLimitReached,
      archived,
      queueDepth,
      queuedTooLongCount,
      processingTooLongCount,
      recentDeadCount,
      sent24h,
      limits,
      workerExpected,
      workerHealthy,
      heartbeatFresh,
      heartbeatProviderMatches,
      workerHeartbeatAgeSeconds: heartbeatAgeSeconds,
      apiProcessWorkerEnabled: this.mailWorker.status().enabled,
      apiProcessWorkerRunning: this.mailWorker.status().running,
      dedicatedWorkerHealthy: workerHealthy,
      dedicatedWorkerProvider: heartbeatProvider,
      recentFailure: activeRecentFailure,
      recentFailureReason: activeRecentFailure?.failureReason ?? null,
      recentFailureSafeMessage: activeRecentFailure?.message ?? null,
      latestFailureReason: latestFailureDetail?.failureReason ?? null,
      latestSafeProviderError: latestFailureDetail?.message ?? null,
      senderConfig,
      senderConfigIssues,
      latestSentAt: latestSuccessAt?.toISOString() ?? null,
      lastSuccessfulSendAt: latestSuccessAt?.toISOString() ?? null,
      lastWorkerHeartbeatAt: sharedWorkerHeartbeat?.heartbeatAt?.toISOString() ?? null,
      latestProcessedJob: latestProcessed
        ? {
            id: latestProcessed.id,
            status: latestProcessed.status,
            lastAttemptAt: latestProcessed.lastAttemptAt?.toISOString() ?? null,
            sentAt: latestProcessed.sentAt?.toISOString() ?? null,
            updatedAt: latestProcessed.updatedAt.toISOString(),
          }
        : null,
      worker: {
        ...this.mailWorker.status(),
        workerId: sharedWorkerHeartbeat?.workerId ?? this.mailWorker.status().workerId,
        provider: sharedWorkerHeartbeat?.provider ?? activeProvider,
        pollMs: sharedWorkerHeartbeat?.pollMs ?? this.mailWorker.status().pollMs,
        lastHeartbeatAt:
          sharedWorkerHeartbeat?.heartbeatAt?.toISOString() ??
          this.mailWorker.status().lastHeartbeatAt,
        lastProcessedJobAt:
          sharedWorkerHeartbeat?.lastProcessedJobAt?.toISOString() ??
          this.mailWorker.status().lastProcessedJobAt,
        healthy: workerHealthy,
        heartbeatFresh,
        heartbeatProviderMatches,
        heartbeatAgeSeconds,
        heartbeatStaleAfterSeconds: Math.round(heartbeatStaleMs / 1000),
      },
      alerts,
    };
  }

  async backupStatus() {
    const history = await this.backups.listHistory();
    const latest = history.latestSuccessful;
    return {
      ok: Boolean(latest) || history.failedBackups === 0,
      latestSuccessful: latest,
      failedBackups: history.failedBackups,
      totalBackups: history.totalBackups,
      storageUsedBytes: history.storageUsedBytes,
      nextAutomaticBackup: history.nextAutomaticBackup,
      worker: this.backupWorker.status(),
      detail: latest
        ? `Latest successful backup completed at ${latest.completedAt || latest.startedAt}.`
        : 'No successful backup has been recorded yet.',
      timestamp: new Date().toISOString(),
    };
  }

  private mailAlerts(input: {
    workerHealthy: boolean;
    heartbeatFresh: boolean;
    heartbeatProviderMatches: boolean;
    activeProvider: string;
    heartbeatProvider: string | null;
    workerHeartbeatAgeSeconds: number | null;
    queueDepth: number;
    queuedTooLongCount: number;
    processingTooLongCount: number;
    recentDeadCount: number;
    latestFailureReason: string | null;
    latestSafeProviderError: string | null;
  }) {
    const alerts: Array<{
      code: string;
      severity: 'info' | 'warning' | 'error';
      message: string;
    }> = [];

    if (!input.heartbeatProviderMatches) {
      alerts.push({
        code: 'WORKER_PROVIDER_MISMATCH',
        severity: 'error',
        message: `Mail worker heartbeat is for provider ${input.heartbeatProvider || 'unknown'}, but the API is using provider ${input.activeProvider}. Start the dedicated worker with the same MAIL_PROVIDER and DATABASE_URL as the API.`,
      });
    } else if (!input.workerHealthy) {
      alerts.push({
        code: 'WORKER_DOWN',
        severity: 'error',
        message:
          input.workerHeartbeatAgeSeconds === null
            ? 'Mail worker heartbeat is missing. Start one dedicated mail worker process.'
            : `Mail worker heartbeat is stale (${input.workerHeartbeatAgeSeconds}s old). Restart the dedicated mail worker process.`,
      });
    }

    if (input.queuedTooLongCount > 0) {
      alerts.push({
        code: input.workerHealthy ? 'QUEUE_BACKLOG' : 'QUEUE_BACKLOG_WORKER_DOWN',
        severity: input.workerHealthy ? 'warning' : 'error',
        message: input.workerHealthy
          ? `${input.queuedTooLongCount} queued mail job(s) exceeded the queue warning threshold while the worker heartbeat is healthy.`
          : `${input.queuedTooLongCount} queued mail job(s) exceeded the queue warning threshold and the worker heartbeat is missing or stale.`,
      });
    }

    if (input.processingTooLongCount > 0) {
      alerts.push({
        code: 'PROCESSING_STUCK',
        severity: 'error',
        message: `${input.processingTooLongCount} mail job(s) have been processing for too long and need recovery attention.`,
      });
    }

    if (
      input.latestFailureReason === MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED ||
      input.latestFailureReason === MAIL_FAILURE_REASONS.ACCOUNT_RESTRICTED
    ) {
      alerts.push({
        code: 'SENDER_OR_ACCOUNT_BLOCKED',
        severity: 'error',
        message:
          input.latestFailureReason === MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED
            ? 'Mailrelay is rejecting the configured sender address. Confirm the sender or switch MAIL_FROM_* to a confirmed address.'
            : 'Mailrelay account access is restricted or under review. Resolve the provider-side restriction before retrying mail jobs.',
      });
    } else if (
      input.latestFailureReason === MAIL_FAILURE_REASONS.PROVIDER_REJECTED ||
      input.latestFailureReason === MAIL_FAILURE_REASONS.AUTH_FAILED ||
      input.latestFailureReason === MAIL_FAILURE_REASONS.INVALID_RECIPIENT
    ) {
      alerts.push({
        code: 'PROVIDER_REJECTING',
        severity: 'error',
        message:
          input.latestSafeProviderError ||
          'Mailrelay is rejecting emails. Inspect the latest safe provider error.',
      });
    } else if (input.latestFailureReason === MAIL_FAILURE_REASONS.RATE_LIMITED) {
      alerts.push({
        code: 'RATE_LIMITED',
        severity: 'warning',
        message:
          input.latestSafeProviderError ||
          'Mailrelay rate limiting was detected. The worker will retry when the limit window clears.',
      });
    }

    if (input.recentDeadCount > 0) {
      alerts.push({
        code: 'DEAD_JOBS_INCREASED',
        severity: 'warning',
        message: `${input.recentDeadCount} mail job(s) moved to DEAD in the last 24 hours. Review the failure reason before archiving them.`,
      });
    }

    if (alerts.length === 0 && input.queueDepth === 0) {
      alerts.push({
        code: 'MAIL_IDLE',
        severity: 'info',
        message: 'Mail queue is healthy and idle.',
      });
    }

    return alerts;
  }

  configuration() {
    return {
      service: 'projtrack-backend',
      ...inspectRuntimeConfiguration(process.env),
    };
  }

  async database() {
    const timestamp = new Date().toISOString();
    const persistenceMode = String(process.env.PERSISTENCE_MODE ?? 'prisma');

    if (!process.env.DATABASE_URL) {
      return {
        ok: false,
        configured: false,
        reachable: false,
        persistenceMode,
        detail: 'DATABASE_URL is not set.',
        migrationTablePresent: false,
        pendingMigrations: null as number | null,
        appliedMigrations: null as number | null,
        timestamp,
      };
    }

    try {
      const databaseInfo = await this.prisma.$queryRawUnsafe<Array<{
        currentDatabase: string;
        currentSchema: string;
        migrationsTable: string | null;
      }>>(
        'SELECT current_database() AS "currentDatabase", current_schema() AS "currentSchema", to_regclass(\'_prisma_migrations\')::text AS "migrationsTable"',
      );

      const info = databaseInfo[0];
      let pendingMigrations: number | null = null;
      let appliedMigrations: number | null = null;

      if (info?.migrationsTable) {
        const migrationInfo = await this.prisma.$queryRawUnsafe<Array<{
          appliedCount: number;
          unresolvedCount: number;
        }>>(
          'SELECT COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS "appliedCount", COUNT(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::int AS "unresolvedCount" FROM "_prisma_migrations"',
        );
        appliedMigrations = Number(migrationInfo[0]?.appliedCount ?? 0);
        pendingMigrations = Number(migrationInfo[0]?.unresolvedCount ?? 0);
      }

      const migrationTablePresent = Boolean(info?.migrationsTable);
      const ok = migrationTablePresent && pendingMigrations === 0;

      return {
        ok,
        configured: true,
        reachable: true,
        persistenceMode,
        currentDatabase: info?.currentDatabase ?? '',
        currentSchema: info?.currentSchema ?? '',
        migrationTablePresent,
        pendingMigrations,
        appliedMigrations,
        detail: !migrationTablePresent
          ? 'Database is reachable, but the Prisma migrations table is missing.'
          : pendingMigrations === 0
            ? `Connected to ${info.currentDatabase}.${info.currentSchema}; ${appliedMigrations} migration(s) applied.`
            : `Connected to ${info.currentDatabase}.${info.currentSchema}; ${pendingMigrations} migration record(s) still need attention.`,
        timestamp,
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        reachable: false,
        persistenceMode,
        detail: `Database probe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        migrationTablePresent: false,
        pendingMigrations: null as number | null,
        appliedMigrations: null as number | null,
        timestamp,
      };
    }
  }
}
