import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailJobStatus, EmailJobType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  DEFAULT_MAIL_MAX_ATTEMPTS,
  MAIL_IDEMPOTENCY_WINDOWS_MS,
} from '../common/constants/mail-policy.constants';
import {
  MAIL_CATEGORY_KEYS,
  MAIL_SUPPRESSION_REASONS,
  MAIL_TEMPLATE_KEYS,
} from '../common/constants/mail.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MailLimitService } from './mail-limit.service';
import { MailProviderRouterService } from './mail-provider-router.service';
import { MailTransportService } from './mail.transport.service';

type QueueMailInput = {
  to?: string;
  userEmail?: string;
  recipientName?: string;
  subject?: string;
  templateKey: string;
  payload: Record<string, unknown>;
  scheduledAt?: Date | string | null;
  maxAttempts?: number;
  campaignId?: string;
  batchKey?: string;
  idempotencyKey?: string;
  idempotencyUntil?: Date | string | null;
};

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function scheduledDate(value?: Date | string | null) {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

function mergePayload(
  payload: Record<string, unknown>,
  extra: Record<string, unknown>,
) {
  return {
    ...payload,
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)),
  };
}

function toStatusLabel(status: EmailJobStatus | string | null | undefined) {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

function toTypeLabel(type: EmailJobType | string | null | undefined) {
  return String(type ?? '')
    .trim()
    .toLowerCase();
}

function asPayloadRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: MailTransportService,
    private readonly limits: MailLimitService,
    private readonly router: MailProviderRouterService,
  ) {}

  async queue(input: QueueMailInput & { type?: 'transactional' | 'bulk' }) {
    if (String(input.type ?? 'transactional').toLowerCase() === 'bulk') {
      return this.queueBulkInvitation(input);
    }
    return this.queueTransactional(input);
  }

  async queueTransactional(input: QueueMailInput) {
    return this.createJob(EmailJobType.TRANSACTIONAL, input);
  }

  async queueBulkInvitation(input: QueueMailInput) {
    return this.createJob(EmailJobType.BULK, {
      ...input,
      payload: mergePayload(input.payload, {
        mailCategory:
          typeof input.payload?.mailCategory === 'string'
            ? input.payload.mailCategory
            : MAIL_CATEGORY_KEYS.INVITE,
      }),
    });
  }

  async queuePasswordReset(input: {
    to: string;
    recipientName?: string;
    firstName?: string;
    resetLink: string;
    expiresAt: Date | string;
    publicRef: string;
    firstTimeSetup?: boolean;
  }) {
    return this.queueTransactional({
      to: input.to,
      recipientName: input.recipientName,
      templateKey: MAIL_TEMPLATE_KEYS.PASSWORD_RESET,
      payload: {
        resetLink: input.resetLink,
        firstName: input.firstName,
        mailCategory: MAIL_CATEGORY_KEYS.AUTH,
        expiresAt:
          input.expiresAt instanceof Date
            ? input.expiresAt.toISOString()
            : String(input.expiresAt),
        isFirstTimeSetup: Boolean(input.firstTimeSetup),
      },
      idempotencyKey: `mail:password-reset:${input.publicRef}`,
      idempotencyUntil: new Date(Date.now() + MAIL_IDEMPOTENCY_WINDOWS_MS.PASSWORD_RESET),
    });
  }

  async queueAccountActivation(input: {
    to: string;
    recipientName?: string;
    firstName?: string;
    activationLink: string;
    publicRef: string;
  }) {
    return this.queueTransactional({
      to: input.to,
      recipientName: input.recipientName,
      templateKey: MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION,
      payload: {
        activationLink: input.activationLink,
        firstName: input.firstName,
        mailCategory: MAIL_CATEGORY_KEYS.AUTH,
      },
      idempotencyKey: `mail:account-activation:${input.publicRef}`,
      idempotencyUntil: new Date(Date.now() + MAIL_IDEMPOTENCY_WINDOWS_MS.ACCOUNT_ACTIVATION),
    });
  }

  async queueInvitation(input: QueueMailInput) {
    const userEmail = normalizeEmail(input.userEmail || input.to || '');
    const campaign = input.campaignId?.trim() || input.batchKey?.trim() || 'direct';
    return this.queueBulkInvitation({
      ...input,
      templateKey: input.templateKey || MAIL_TEMPLATE_KEYS.BULK_INVITATION,
      payload: mergePayload(input.payload, { mailCategory: MAIL_CATEGORY_KEYS.INVITE }),
      idempotencyKey:
        input.idempotencyKey || `mail:invitation:${campaign}:${userEmail}`,
      idempotencyUntil:
        input.idempotencyUntil ||
        new Date(Date.now() + MAIL_IDEMPOTENCY_WINDOWS_MS.INVITATION),
    });
  }

  async suppress(email: string, reason = 'Suppressed by user request.', source = 'manual') {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new BadRequestException('Email is required.');
    return this.prisma.emailSuppression.upsert({
      where: { email: normalized },
      update: {
        reason,
        source,
        suppressedAt: new Date(),
      },
      create: {
        email: normalized,
        reason,
        source,
      },
    });
  }

  async isSuppressed(email: string) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    const existing = await this.prisma.emailSuppression.findUnique({
      where: { email: normalized },
    });
    return Boolean(existing);
  }

  async getOrCreateUnsubscribeToken(email: string, campaignId?: string | null) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new BadRequestException('Email is required.');

    const existing = await this.prisma.emailUnsubscribe.findFirst({
      where: {
        email: normalized,
        campaignId: campaignId ?? null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    return this.prisma.emailUnsubscribe.create({
      data: {
        email: normalized,
        campaignId: campaignId ?? null,
        token: randomUUID(),
      },
    });
  }

  async unsubscribeByToken(token: string) {
    const normalizedToken = String(token ?? '').trim();
    if (!normalizedToken) {
      throw new BadRequestException('Unsubscribe token is required.');
    }

    const existing = await this.prisma.emailUnsubscribe.findUnique({
      where: { token: normalizedToken },
    });
    if (!existing) {
      throw new NotFoundException('Unsubscribe token not found.');
    }

    const unsubscribedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.emailUnsubscribe.update({
        where: { token: normalizedToken },
        data: { unsubscribedAt },
      }),
      this.prisma.emailSuppression.upsert({
        where: { email: existing.email },
        update: {
          reason: MAIL_SUPPRESSION_REASONS.UNSUBSCRIBED,
          source: 'unsubscribe',
          suppressedAt: unsubscribedAt,
        },
        create: {
          email: existing.email,
          reason: MAIL_SUPPRESSION_REASONS.UNSUBSCRIBED,
          source: 'unsubscribe',
          suppressedAt: unsubscribedAt,
        },
      }),
    ]);

    return {
      success: true,
      email: existing.email,
      unsubscribedAt: unsubscribedAt.toISOString(),
    };
  }

  async listJobs() {
    const rows = await this.prisma.emailJob.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.serializeJob(row));
  }

  async retryJob(id: string) {
    const job = await this.prisma.emailJob.findUnique({ where: { id: String(id) } });
    if (!job) {
      throw new NotFoundException('Mail job not found.');
    }

    await this.transport.ensureReadyForQueue();

    const next = await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.QUEUED,
        scheduledAt: new Date(),
        attempts: 0,
        lastError: null,
        failureReason: null,
        providerMessageId: null,
        deliveredAt: null,
        lockedAt: null,
        lockedBy: null,
        sentAt: null,
      },
    });

    return this.serializeJob(next);
  }

  async resumePausedJobs(input?: { campaignId?: string; batchKey?: string }) {
    await this.transport.ensureReadyForQueue();

    const where: Prisma.EmailJobWhereInput = {
      status: EmailJobStatus.PAUSED_LIMIT_REACHED,
    };

    const batchKey = String(input?.batchKey ?? '').trim();
    const campaignId = String(input?.campaignId ?? '').trim();
    if (batchKey) where.batchKey = batchKey;
    if (campaignId) where.campaignId = campaignId;

    const result = await this.prisma.emailJob.updateMany({
      where,
      data: {
        status: EmailJobStatus.QUEUED,
        scheduledAt: new Date(),
        attempts: 0,
        lastAttemptAt: null,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        failureReason: null,
      },
    });

    return {
      success: true,
      resumed: result.count,
      filter: {
        campaignId: campaignId || null,
        batchKey: batchKey || null,
      },
    };
  }

  async healthCheck() {
    const [transportStatus, queued, dead, pausedLimitReached, sent24h, limits] = await Promise.all([
      this.transport.verifyTransport(),
      this.prisma.emailJob.count({ where: { status: EmailJobStatus.QUEUED } }),
      this.prisma.emailJob.count({ where: { status: EmailJobStatus.DEAD } }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.PAUSED_LIMIT_REACHED },
      }),
      this.prisma.emailJob.count({
        where: {
          status: EmailJobStatus.SENT,
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.limits.getUsage(this.transport.getProviderName()),
    ]);

    return {
      ok: transportStatus.ok,
      provider: transportStatus.provider,
      verified: transportStatus.verified,
      from: transportStatus.from,
      detail: transportStatus.detail,
      queued,
      dead,
      pausedLimitReached,
      sent24h,
      limits,
      timestamp: transportStatus.timestamp,
    };
  }

  private async createJob(type: EmailJobType, input: QueueMailInput) {
    const userEmail = normalizeEmail(input.userEmail || input.to || '');
    if (!userEmail) {
      throw new BadRequestException('Missing email recipient.');
    }

    await this.transport.ensureReadyForQueue();

    const now = new Date();
    const scheduledAt = scheduledDate(input.scheduledAt);
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const idempotencyUntil = input.idempotencyUntil
      ? scheduledDate(input.idempotencyUntil)
      : null;

    if (idempotencyKey) {
      const existing = await this.prisma.emailJob.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        const isReusableWindow =
          Boolean(existing.idempotencyUntil && existing.idempotencyUntil > now) &&
          (existing.status === EmailJobStatus.QUEUED ||
            existing.status === EmailJobStatus.PROCESSING ||
            existing.status === EmailJobStatus.FAILED ||
            existing.status === EmailJobStatus.PAUSED_LIMIT_REACHED ||
            existing.status === EmailJobStatus.SENT);

        if (isReusableWindow || existing.status === EmailJobStatus.PROCESSING) {
          return this.serializeJob(existing);
        }

        const refreshed = await this.prisma.emailJob.update({
          where: { id: existing.id },
          data: {
            type,
            status: EmailJobStatus.QUEUED,
            userEmail,
            recipientName: input.recipientName?.trim() || null,
            subject: input.subject?.trim() || null,
            templateKey: input.templateKey,
            payload: input.payload as Prisma.InputJsonValue,
            attempts: 0,
            maxAttempts: input.maxAttempts ?? DEFAULT_MAIL_MAX_ATTEMPTS,
            scheduledAt,
            campaignId: input.campaignId?.trim() || null,
            batchKey: input.batchKey?.trim() || null,
            provider: this.transport.getProviderName(),
            idempotencyUntil,
            lastAttemptAt: null,
            lastError: null,
            failureReason: null,
            providerMessageId: null,
            deliveredAt: null,
            sentAt: null,
            lockedAt: null,
            lockedBy: null,
          },
        });

        return this.serializeJob(refreshed);
      }
    }

    const created = await this.prisma.emailJob.create({
      data: {
        type,
        status: EmailJobStatus.QUEUED,
        userEmail,
        recipientName: input.recipientName?.trim() || null,
        subject: input.subject?.trim() || null,
        templateKey: input.templateKey,
        payload: input.payload as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAIL_MAX_ATTEMPTS,
        scheduledAt,
        campaignId: input.campaignId?.trim() || null,
        batchKey: input.batchKey?.trim() || null,
        provider: this.transport.getProviderName(),
        idempotencyKey,
        idempotencyUntil,
      },
    });

    return this.serializeJob(created);
  }

  private serializeJob(created: any) {
    const payload = asPayloadRecord(created.payload);
    const preview = (() => {
      try {
        return this.router.resolve({
          to: created.userEmail,
          originalTo: created.userEmail,
          recipientName: created.recipientName,
          subject: created.subject || '(queued mail)',
          html: '',
          text: '',
          templateKey: created.templateKey,
          mailCategory:
            typeof payload.mailCategory === 'string'
              ? String(payload.mailCategory)
              : undefined,
        });
      } catch {
        return {
          to: created.userEmail,
          routedToTestmail: false,
          fromEmail: null,
          fromName: null,
        };
      }
    })();

    return {
      ...created,
      type: toTypeLabel(created.type),
      status: toStatusLabel(created.status),
      emailType: created.templateKey,
      provider: created.provider || this.transport.getProviderName(),
      failureReason: created.failureReason || null,
      originalRecipient: created.userEmail,
      deliveryRecipient: preview.to,
      routedToTestmail: preview.routedToTestmail,
      fromEmail: preview.fromEmail,
      fromName: preview.fromName,
      failureHint: this.failureHint(created.lastError, created.failureReason),
      scheduledAt: created.scheduledAt,
      nextAttemptAt: created.scheduledAt,
    };
  }

  private failureHint(lastError: unknown, failureReason: unknown) {
    const message = String(lastError ?? '').trim().toLowerCase();
    const reason = String(failureReason ?? '').trim().toUpperCase();

    if (!message && !reason) {
      return null;
    }

    if (message.includes("sender email isn't confirmed")) {
      return 'Confirm the configured sender email in Mailrelay before retrying this job.';
    }

    if (message.includes('currently under review')) {
      return 'Mailrelay has temporarily paused this account for review. Contact Mailrelay support, then retry the job after they clear the account.';
    }

    if (message.includes('dkim is not configured')) {
      return 'Add and verify the Mailrelay DKIM DNS record for projtrack.codes before retrying this job.';
    }

    if (message.includes('blocked testmail recipient in production')) {
      return 'Production safety blocked a testmail.app recipient. Use a real recipient email in production.';
    }

    if (reason === 'SENDER_MONTHLY_LIMIT_REACHED') {
      return 'The configured Sender.net monthly limit was reached before this job could be sent.';
    }

    if (reason === 'SENDER_DAILY_SAFETY_LIMIT_REACHED') {
      return 'The configured Sender.net daily safety limit was reached before this job could be sent.';
    }

    if (reason === 'SENDER_RATE_LIMIT_REACHED') {
      return 'Sender.net rate limiting paused this job. Resume it after the limit window clears.';
    }

    if (message.includes('sender_api_key is missing')) {
      return 'Set SENDER_API_KEY in the backend environment before retrying this job.';
    }

    if (message.includes('sender_api_url is missing')) {
      return 'Set SENDER_API_URL in the backend environment before retrying this job.';
    }

    if (
      message.includes('verified domain') ||
      message.includes('from email address must match') ||
      message.includes('from.email')
    ) {
      return 'Verify the Sender.net sending domain and make sure the From address matches that verified domain before retrying this job.';
    }

    if (reason === 'MAILRELAY_MONTHLY_LIMIT_REACHED') {
      return 'The configured Mailrelay monthly limit was reached before this job could be sent.';
    }

    if (reason === 'MAILRELAY_DAILY_SAFETY_LIMIT_REACHED') {
      return 'The configured Mailrelay daily safety limit was reached before this job could be sent.';
    }

    if (reason === 'MAILRELAY_RATE_LIMIT_REACHED') {
      return 'Mailrelay rate limiting paused this job. Resume it after the limit window clears.';
    }

    if (message.includes('mailrelay_api_key is missing')) {
      return 'Set MAILRELAY_API_KEY in the backend environment before retrying this job.';
    }

    return null;
  }
}
