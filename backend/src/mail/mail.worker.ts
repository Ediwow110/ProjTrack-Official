import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmailJobStatus, EmailJobType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  MAIL_FAILURE_REASONS,
  MAIL_PROVIDER_NAMES,
  MAIL_TAGS,
} from '../common/constants/mail.constants';
import {
  MAIL_LIMIT_DEFAULTS,
  MAIL_RETRY_DELAYS_MS,
} from '../common/constants/mail-policy.constants';
import {
  MAIL_QUEUE_DEFAULTS,
  MAIL_QUEUE_ENV_KEYS,
} from '../common/constants/queue.constants';
import { buildUnsubscribeLink } from '../common/utils/frontend-links';
import { PrismaService } from '../prisma/prisma.service';
import { MailLimitService } from './mail-limit.service';
import { renderMailTemplate } from './mail.templates';
import { MailService } from './mail.service';
import { MailTransportService } from './mail.transport.service';

function envNumber(keys: readonly string[], fallback: number) {
  for (const key of keys) {
    const parsed = Number(process.env[key]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
}

@Injectable()
export class MailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailWorker.name);
  private readonly workerId = `mail-worker:${randomUUID()}`;
  private readonly pollMs = MAIL_QUEUE_DEFAULTS.POLL_MS;
  private readonly staleLockMs = MAIL_QUEUE_DEFAULTS.STALE_LOCK_MS;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly transport: MailTransportService,
    private readonly mailLimits: MailLimitService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.processDueJobs().catch((error) => {
        this.logger.error('Mail worker pass failed.', error as Error);
      });
    }, this.pollMs);

    void this.processDueJobs();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processDueJobs() {
    await this.recoverStaleLocks();
    await this.processQueueType(
      EmailJobType.TRANSACTIONAL,
      this.perRunLimit(MAIL_QUEUE_ENV_KEYS.TX_PER_MIN, MAIL_QUEUE_DEFAULTS.TX_PER_MIN),
    );
    await this.processQueueType(
      EmailJobType.BULK,
      this.perRunLimit(MAIL_QUEUE_ENV_KEYS.BULK_PER_MIN, MAIL_QUEUE_DEFAULTS.BULK_PER_MIN),
    );
  }

  private async processQueueType(type: EmailJobType, take: number) {
    const now = new Date();
    const rows = await this.prisma.emailJob.findMany({
      where: {
        type,
        status: { in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] },
        scheduledAt: { lte: now },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take,
    });

    for (const row of rows) {
      const claimed = await this.prisma.emailJob.updateMany({
        where: {
          id: row.id,
          status: { in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] },
        },
        data: {
          status: EmailJobStatus.PROCESSING,
          lockedAt: new Date(),
          lockedBy: this.workerId,
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
        },
      });

      if (!claimed.count) continue;

      const job = await this.prisma.emailJob.findUnique({ where: { id: row.id } });
      if (!job) continue;

      await this.processClaimedJob(job);
    }
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
              lockedAt: null,
              lockedBy: null,
            },
          });
          return;
        }

        if (!payload.unsubscribeUrl) {
          const unsubscribe = await this.mailService.getOrCreateUnsubscribeToken(job.userEmail, job.campaignId);
          payload = {
            ...payload,
            unsubscribeUrl: buildUnsubscribeLink(unsubscribe.token),
          };
        }
      }

      const rendered = renderMailTemplate(job.templateKey, payload);
      const limitCheck = await this.mailLimits.checkBeforeSend(this.transport.getProviderName(), job.type);
      if (!limitCheck.allowed) {
        await this.pauseJobForLimit(job, limitCheck.reason, limitCheck.detail);
        if (job.type === EmailJobType.BULK) {
          await this.pausePendingBulkJobs(job, limitCheck.reason, limitCheck.detail);
        }
        return;
      }

      const delivery = await this.transport.sendRenderedMessage({
        to: job.userEmail,
        originalTo: job.userEmail,
        recipientName: job.recipientName,
        subject: job.subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
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

      await this.prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.SENT,
          subject: job.subject || rendered.subject,
          payload: payload as Prisma.InputJsonValue,
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
          sentAt: new Date(),
          lastError: null,
          failureReason: null,
          lockedAt: null,
          lockedBy: null,
          scheduledAt: null,
        },
      });
    } catch (error) {
      const classification = this.transport.classifyError(error);
      const shouldRetry = classification.retryable && job.attempts < job.maxAttempts;
      const message = classification.reason || (error instanceof Error ? error.message : 'Unknown mail delivery failure');
      const failureReason = this.failureReasonForError(classification);
      await this.prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? EmailJobStatus.FAILED : EmailJobStatus.DEAD,
          lastError: message,
          failureReason,
          lockedAt: null,
          lockedBy: null,
          scheduledAt: shouldRetry ? new Date(Date.now() + this.retryDelayMs(job.attempts)) : null,
        },
      });
      this.logger.error(`Mail job ${job.id} failed for ${job.userEmail}: ${message}`);
    }
  }

  private async recoverStaleLocks() {
    const threshold = new Date(Date.now() - this.staleLockMs);
    await this.prisma.emailJob.updateMany({
      where: {
        status: EmailJobStatus.PROCESSING,
        lockedAt: { lt: threshold },
      },
      data: {
        status: EmailJobStatus.FAILED,
        lockedAt: null,
        lockedBy: null,
        lastError: 'Recovered from a stale mail worker lock.',
        failureReason: null,
        scheduledAt: new Date(),
      },
    });
  }

  private perRunLimit(envKeys: readonly string[], defaultPerMinute: number) {
    const isTransactional = envKeys.includes('MAILRELAY_TX_PER_MIN') || envKeys.includes('MAIL_TX_PER_MIN');
    const fallback = isTransactional
      ? MAIL_LIMIT_DEFAULTS.TX_PER_MIN
      : envKeys.includes('MAILRELAY_BULK_PER_MIN') || envKeys.includes('MAIL_BULK_PER_MIN')
        ? MAIL_LIMIT_DEFAULTS.BULK_PER_MIN
        : defaultPerMinute;
    const perMinute = Math.max(1, envNumber(envKeys, fallback));
    return Math.max(1, Math.floor(perMinute / 4));
  }

  private retryDelayMs(attempt: number) {
    return MAIL_RETRY_DELAYS_MS[Math.max(0, Math.min(attempt - 1, MAIL_RETRY_DELAYS_MS.length - 1))];
  }

  private failureReasonForError(classification: {
    reason?: string;
    statusCode?: number;
  }) {
    const provider = this.transport.getProviderName();

    if (provider === MAIL_PROVIDER_NAMES.MAILRELAY) {
      if (
        classification.statusCode === 429 ||
        String(classification.reason ?? '').toLowerCase().includes('rate limit')
      ) {
        return MAIL_FAILURE_REASONS.MAILRELAY_RATE_LIMIT_REACHED;
      }

      return MAIL_FAILURE_REASONS.MAILRELAY_API_ERROR;
    }

    if (provider === MAIL_PROVIDER_NAMES.SENDER) {
      if (
        classification.statusCode === 429 ||
        String(classification.reason ?? '').toLowerCase().includes('rate limit')
      ) {
        return MAIL_FAILURE_REASONS.SENDER_RATE_LIMIT_REACHED;
      }

      return MAIL_FAILURE_REASONS.SENDER_API_ERROR;
    }

    if (provider !== MAIL_PROVIDER_NAMES.MAILRELAY) {
      return null;
    }

    return null;
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
        lockedAt: null,
        lockedBy: null,
        scheduledAt: null,
      },
    });
  }
}
