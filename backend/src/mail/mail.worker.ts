import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmailJobStatus, EmailJobType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { MAIL_FAILURE_REASONS, MAIL_TAGS } from '../common/constants/mail.constants';
import {
  MAIL_LIMIT_DEFAULTS,
  MAIL_RETRY_DELAYS_MS,
  MAIL_SENDER_CONFIRMATION_RETRY_DELAYS_MS,
} from '../common/constants/mail-policy.constants';
import {
  MAIL_QUEUE_DEFAULTS,
  MAIL_QUEUE_ENV_KEYS,
  mailProcessingStaleMs,
  mailProcessingWarningMs,
  mailWorkerHeartbeatStaleMs,
  mailWorkerPollMs,
} from '../common/constants/queue.constants';
import { buildUnsubscribeLink } from '../common/utils/frontend-links';
import { PrismaService } from '../prisma/prisma.service';
import { MailLimitService } from './mail-limit.service';
import { renderMailTemplate } from './mail.templates';
import { MailService } from './mail.service';
import { MailTransportService } from './mail.transport.service';

const MAIL_WORKER_HEARTBEAT_KEY = 'mail';

function envNumber(keys: readonly string[], fallback: number) {
  for (const key of keys) {
    const parsed = Number(process.env[key]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
}

export function isMailWorkerEnabled(env: NodeJS.ProcessEnv = process.env) {
  return /^(1|true|yes|on)$/i.test(String(env.MAIL_WORKER_ENABLED ?? '').trim());
}

export { mailWorkerPollMs };

export function buildDueEmailJobWhere(input: {
  type: EmailJobType;
  now: Date;
}): Prisma.EmailJobWhereInput {
  return {
    archivedAt: null,
    type: input.type,
    status: { in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] },
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: input.now } }],
  };
}

@Injectable()
export class MailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailWorker.name);
  private readonly workerId = `mail-worker:${randomUUID()}`;
  private readonly pollMs = mailWorkerPollMs();
  private readonly processingWarningMs = mailProcessingWarningMs();
  private readonly staleLockMs = mailProcessingStaleMs();
  private readonly heartbeatStaleMs = mailWorkerHeartbeatStaleMs(process.env, this.pollMs);
  private timer: NodeJS.Timeout | null = null;
  private lastHeartbeatAt: Date | null = null;
  private lastProcessedJobAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly transport: MailTransportService,
    private readonly mailLimits: MailLimitService,
  ) {}

  async onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log(
        `Mail worker is disabled for this process. provider=${this.transport.getProviderName()} pollMs=${this.pollMs}. Set MAIL_WORKER_ENABLED=true in one dedicated worker process to process queued mail.`,
      );
      return;
    }

    const existingHeartbeat = await this.readSharedHeartbeat();
    if (
      existingHeartbeat &&
      existingHeartbeat.workerId !== this.workerId &&
      Date.now() - existingHeartbeat.heartbeatAt.getTime() <= this.heartbeatStaleMs
    ) {
      this.logger.warn(
        `Another mail worker heartbeat is still fresh. existingWorkerId=${existingHeartbeat.workerId} heartbeatAt=${existingHeartbeat.heartbeatAt.toISOString()}. Keep one dedicated worker in production unless multi-worker locking is intentionally verified.`,
      );
    }

    this.logger.log(
      `Mail worker enabled. provider=${this.transport.getProviderName()} workerId=${this.workerId} pollMs=${this.pollMs}.`,
    );

    this.timer = setInterval(() => {
      this.processDueJobs().catch((error) => {
        this.logger.error('Mail worker pass failed.', error as Error);
      });
    }, this.pollMs);

    void this.processDueJobs();
  }

  isEnabled() {
    return isMailWorkerEnabled();
  }

  status() {
    return {
      enabled: this.isEnabled(),
      workerId: this.isEnabled() ? this.workerId : null,
      pollMs: this.pollMs,
      running: Boolean(this.timer),
      lastHeartbeatAt: this.lastHeartbeatAt?.toISOString() ?? null,
      lastProcessedJobAt: this.lastProcessedJobAt?.toISOString() ?? null,
      processingWarningMs: this.processingWarningMs,
      processingStaleMs: this.staleLockMs,
      heartbeatStaleMs: this.heartbeatStaleMs,
    };
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processDueJobs() {
    const now = new Date();
    const previousHeartbeat = await this.readSharedHeartbeat();

    this.lastHeartbeatAt = now;
    await this.writeHeartbeat(now);
    await this.recoverStaleLocks(previousHeartbeat, now);

    const transactionalProcessed = await this.processQueueType(
      EmailJobType.TRANSACTIONAL,
      this.perRunLimit(MAIL_QUEUE_ENV_KEYS.TX_PER_MIN, MAIL_QUEUE_DEFAULTS.TX_PER_MIN),
    );
    const bulkProcessed = await this.processQueueType(
      EmailJobType.BULK,
      this.perRunLimit(MAIL_QUEUE_ENV_KEYS.BULK_PER_MIN, MAIL_QUEUE_DEFAULTS.BULK_PER_MIN),
    );

    await this.writeHeartbeat(new Date());

    const processed = transactionalProcessed + bulkProcessed;
    if (processed > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'mail.worker_pass_completed',
          workerId: this.workerId,
          provider: this.transport.getProviderName(),
          processed,
          transactionalProcessed,
          bulkProcessed,
        }),
      );
    }
  }

  private async processQueueType(type: EmailJobType, take: number) {
    const now = new Date();
    const activeProvider = this.transport.getProviderName();
    const rows = await this.prisma.emailJob.findMany({
      where: buildDueEmailJobWhere({ type, now }),
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.max(take, take * 4),
    });

    let processed = 0;

    for (const row of rows.filter((job) => job.attempts < job.maxAttempts).slice(0, take)) {
      const claimed = await this.prisma.emailJob.updateMany({
        where: {
          id: row.id,
          archivedAt: null,
          type,
          status: { in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] },
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
        },
        data: {
          status: EmailJobStatus.PROCESSING,
          provider: activeProvider,
          lockedAt: new Date(),
          lockedBy: this.workerId,
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
        },
      });

      if (!claimed.count) continue;
      this.logger.log(
        JSON.stringify({
          event: 'mail.job_claimed',
          jobId: row.id,
          type,
          provider: activeProvider,
          workerId: this.workerId,
          attempt: row.attempts + 1,
          maxAttempts: row.maxAttempts,
        }),
      );

      const job = await this.prisma.emailJob.findUnique({ where: { id: row.id } });
      if (!job) continue;

      await this.processClaimedJob(job);
      processed += 1;
    }

    return processed;
  }

  private async processClaimedJob(job: {
    id: string;
    type: EmailJobType;
    status: EmailJobStatus;
    userEmail: string;
    recipientName: string | null;
    subject: string | null;
    templateKey: string;
    payload: unknown;
    attempts: number;
    maxAttempts: number;
    campaignId: string | null;
    batchKey: string | null;
  }) {
    try {
      let payload = ((job.payload as Record<string, unknown>) || {}) as Record<string, unknown>;

      if (job.type === EmailJobType.BULK) {
        if (await this.mailService.isSuppressed(job.userEmail)) {
          await this.prisma.emailJob.update({
            where: { id: job.id },
            data: {
              status: EmailJobStatus.CANCELLED,
              lastError: 'Recipient is suppressed or unsubscribed from bulk mail.',
              failureReason: null,
              retryableFailure: null,
              lockedAt: null,
              lockedBy: null,
            },
          });
          return;
        }

        if (!payload.unsubscribeUrl) {
          const unsubscribe = await this.mailService.getOrCreateUnsubscribeToken(
            job.userEmail,
            job.campaignId,
          );
          payload = {
            ...payload,
            unsubscribeUrl: buildUnsubscribeLink(unsubscribe.token),
          };
        }
      }

      const rendered = renderMailTemplate(job.templateKey, payload);
      const limitCheck = await this.mailLimits.checkBeforeSend(
        this.transport.getProviderName(),
        job.type,
      );
      if (!limitCheck.allowed) {
        await this.pauseJobForLimit(job, limitCheck.reason, limitCheck.detail);
        if (job.type === EmailJobType.BULK) {
          await this.pausePendingBulkJobs(job, limitCheck.reason, limitCheck.detail);
        }
        return;
      }

      const resolvedSubject = String(job.subject || rendered.subject || '').trim();
      const resolvedHtml = String(rendered.html || '').trim();
      const resolvedText = String(rendered.text || '').trim();
      if (!resolvedSubject) {
        throw new BadRequestException(
          `Mail subject is required before provider send. jobId=${job.id} templateKey=${job.templateKey}`,
        );
      }
      if (!resolvedHtml && !resolvedText) {
        throw new BadRequestException(
          `Rendered mail body is empty before provider send. jobId=${job.id} templateKey=${job.templateKey}`,
        );
      }
      this.logger.log(
        JSON.stringify({
          event: 'mail.job_rendered',
          jobId: job.id,
          templateKey: job.templateKey,
          workerId: this.workerId,
        }),
      );

      const delivery = await this.transport.sendRenderedMessage({
        to: job.userEmail,
        originalTo: job.userEmail,
        recipientName: job.recipientName,
        subject: resolvedSubject,
        html: resolvedHtml,
        text: resolvedText,
        templateKey: job.templateKey,
        mailCategory:
          typeof payload.mailCategory === 'string'
            ? String(payload.mailCategory)
            : undefined,
        tags: {
          [MAIL_TAGS.TEMPLATE]: job.templateKey,
          [MAIL_TAGS.TRANSACTIONAL]: String(job.type === EmailJobType.TRANSACTIONAL),
          [MAIL_TAGS.BULK]: String(job.type === EmailJobType.BULK),
        },
      });

      const acceptedAt = new Date();
      await this.prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.SENT,
          subject: resolvedSubject,
          payload: payload as Prisma.InputJsonValue,
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
          sentAt: acceptedAt,
          lastError: null,
          failureReason: null,
          retryableFailure: null,
          lockedAt: null,
          lockedBy: null,
          scheduledAt: null,
        },
      });
      this.lastProcessedJobAt = acceptedAt;
      this.logger.log(
        JSON.stringify({
          event: 'mail.job_sent',
          jobId: job.id,
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
          workerId: this.workerId,
        }),
      );
    } catch (error) {
      const classification = this.transport.classifyError(error);
      const shouldRetry = classification.retryable && job.attempts < job.maxAttempts;
      const exhaustedRetries = classification.retryable && !shouldRetry;
      const safeMessage =
        classification.reason ||
        'Mailrelay returned an unclassified provider error. Inspect the safe provider message before retrying this job.';
      const message = exhaustedRetries
        ? this.truncate(
            `Retry budget exhausted after ${job.attempts}/${job.maxAttempts} attempts. ${safeMessage}`,
          )
        : safeMessage;
      const failureReason =
        classification.failureReason || MAIL_FAILURE_REASONS.UNKNOWN_PROVIDER_ERROR;

      await this.prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? EmailJobStatus.FAILED : EmailJobStatus.DEAD,
          lastError: message,
          failureReason,
          retryableFailure: classification.retryable,
          lockedAt: null,
          lockedBy: null,
          scheduledAt: shouldRetry
            ? new Date(Date.now() + this.retryDelayMs(job.attempts, failureReason))
            : null,
        },
      });
      this.logger.error(
        JSON.stringify({
          event: 'mail.job_failed',
          jobId: job.id,
          provider: this.transport.getProviderName(),
          failureReason,
          retryable: classification.retryable,
          status: shouldRetry ? EmailJobStatus.FAILED : EmailJobStatus.DEAD,
          message,
        }),
      );
      this.lastProcessedJobAt = new Date();
    }
  }

  private async recoverStaleLocks(
    previousHeartbeat:
      | {
          workerId: string;
          heartbeatAt: Date;
        }
      | null
      | undefined,
    now: Date,
  ) {
    const staleLockThreshold = new Date(now.getTime() - this.staleLockMs);
    const heartbeatRecoveryThreshold = new Date(now.getTime() - this.processingWarningMs);
    const heartbeatWasStale =
      !previousHeartbeat ||
      now.getTime() - previousHeartbeat.heartbeatAt.getTime() > this.heartbeatStaleMs;

    const staleJobs = await this.prisma.emailJob.findMany({
      where: {
        archivedAt: null,
        status: EmailJobStatus.PROCESSING,
        OR: [
          { lockedAt: { lt: staleLockThreshold } },
          heartbeatWasStale ? { lockedAt: { lt: heartbeatRecoveryThreshold } } : undefined,
        ].filter(Boolean) as Prisma.EmailJobWhereInput[],
      },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
        lockedAt: true,
      },
    });

    for (const job of staleJobs) {
      const lockedAt = job.lockedAt ?? now;
      const staleReason = heartbeatWasStale
        ? 'Recovered a stale PROCESSING job after the mail worker heartbeat went stale.'
        : 'Recovered a stale PROCESSING job after it exceeded the processing stale threshold.';
      const recoverable = job.attempts < job.maxAttempts;

      await this.prisma.emailJob.updateMany({
        where: {
          id: job.id,
          status: EmailJobStatus.PROCESSING,
          lockedAt,
        },
        data: recoverable
          ? {
              status: EmailJobStatus.QUEUED,
              lockedAt: null,
              lockedBy: null,
              lastError: `${staleReason} Requeued automatically.`,
              failureReason: MAIL_FAILURE_REASONS.WORKER_STALE_PROCESSING,
              retryableFailure: true,
              scheduledAt: null,
            }
          : {
              status: EmailJobStatus.DEAD,
              lockedAt: null,
              lockedBy: null,
              lastError: `${staleReason} Retry budget exhausted; confirm delivery outcome before manually retrying this job.`,
              failureReason: MAIL_FAILURE_REASONS.WORKER_STALE_PROCESSING,
              retryableFailure: true,
              scheduledAt: null,
            },
      });
    }
  }

  private async readSharedHeartbeat() {
    return this.prisma.workerHeartbeat.findUnique({
      where: { key: MAIL_WORKER_HEARTBEAT_KEY },
      select: {
        workerId: true,
        heartbeatAt: true,
      },
    });
  }

  private async writeHeartbeat(heartbeatAt: Date) {
    await this.prisma.workerHeartbeat.upsert({
      where: { key: MAIL_WORKER_HEARTBEAT_KEY },
      update: {
        workerId: this.workerId,
        provider: this.transport.getProviderName(),
        pollMs: this.pollMs,
        heartbeatAt,
        lastProcessedJobAt: this.lastProcessedJobAt,
      },
      create: {
        key: MAIL_WORKER_HEARTBEAT_KEY,
        workerId: this.workerId,
        provider: this.transport.getProviderName(),
        pollMs: this.pollMs,
        heartbeatAt,
        lastProcessedJobAt: this.lastProcessedJobAt,
      },
    });
  }

  private perRunLimit(envKeys: readonly string[], defaultPerMinute: number) {
    const isTransactional =
      envKeys.includes('MAILRELAY_TX_PER_MIN') || envKeys.includes('MAIL_TX_PER_MIN');
    const fallback = isTransactional
      ? MAIL_LIMIT_DEFAULTS.TX_PER_MIN
      : envKeys.includes('MAILRELAY_BULK_PER_MIN') || envKeys.includes('MAIL_BULK_PER_MIN')
        ? MAIL_LIMIT_DEFAULTS.BULK_PER_MIN
        : defaultPerMinute;
    const perMinute = Math.max(1, envNumber(envKeys, fallback));
    return Math.max(1, Math.floor(perMinute / 4));
  }

  private retryDelayMs(attempt: number, failureReason?: string) {
    const delays =
      failureReason === MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED
        ? MAIL_SENDER_CONFIRMATION_RETRY_DELAYS_MS
        : MAIL_RETRY_DELAYS_MS;
    return delays[Math.max(0, Math.min(attempt - 1, delays.length - 1))];
  }

  private truncate(value: string, max = 600) {
    const normalized = String(value ?? '').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max)}...`;
  }

  private async pauseJobForLimit(
    job: { id: string; attempts?: number },
    reason: string | null,
    detail: string,
  ) {
    await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.PAUSED_LIMIT_REACHED,
        attempts: Math.max(0, Number(job.attempts ?? 0) - 1),
        lastError: detail,
        failureReason: reason,
        retryableFailure: true,
        lockedAt: null,
        lockedBy: null,
        scheduledAt: null,
      },
    });
  }

  private async pausePendingBulkJobs(
    job: {
      id: string;
      campaignId: string | null;
      batchKey: string | null;
    },
    reason: string | null,
    detail: string,
  ) {
    const where: Prisma.EmailJobWhereInput = {
      archivedAt: null,
      id: { not: job.id },
      type: EmailJobType.BULK,
      status: { in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] },
    };

    if (job.batchKey) {
      where.batchKey = job.batchKey;
    } else if (job.campaignId) {
      where.campaignId = job.campaignId;
    } else {
      return;
    }

    await this.prisma.emailJob.updateMany({
      where,
      data: {
        status: EmailJobStatus.PAUSED_LIMIT_REACHED,
        lastError: detail,
        failureReason: reason,
        retryableFailure: true,
        lockedAt: null,
        lockedBy: null,
        scheduledAt: null,
      },
    });
  }
}
