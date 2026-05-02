import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailJobStatus, EmailJobType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  DEFAULT_MAIL_MAX_ATTEMPTS,
  MAIL_IDEMPOTENCY_WINDOWS_MS,
} from '../common/constants/mail-policy.constants';
import {
  MAIL_CATEGORY_KEYS,
  MAIL_FAILURE_REASONS,
  MAIL_NON_RETRYABLE_FAILURE_REASONS,
  MAIL_RETRYABLE_FAILURE_REASONS,
  MAIL_SUPPRESSION_REASONS,
  MAIL_TEMPLATE_KEYS,
} from '../common/constants/mail.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MailLimitService } from './mail-limit.service';
import { MailProviderRouterService } from './mail-provider-router.service';
import { MailTransportService } from './mail.transport.service';
import { validateMailTemplatePayload } from './mail.templates';
import { isSenderNotConfirmedMessage } from './providers/provider-error-classification';

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

type MailJobRecipientIdentity = {
  email: string;
  userId?: string;
  role?: string;
  fullName?: string;
  studentId?: string;
  teacherId?: string;
  employeeId?: string;
  isExternal: boolean;
};

type SafeMailRecipientUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  status: string;
  studentProfile: {
    id: string;
    studentNumber: string;
  } | null;
  teacherProfile: {
    id: string;
    employeeId: string | null;
    department: string | null;
  } | null;
};

type MailJobListOptions = {
  includeArchived?: boolean;
};

type RetryMailJobOptions = {
  force?: boolean;
};

type ArchiveMailJobsInput = {
  olderThanDays?: number;
};

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeMailSubject(value?: string | null) {
  const subject = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return subject ? subject.slice(0, 160) : null;
}

function scheduledDate(value?: Date | string | null) {
  if (!value) return null;
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

function truncate(value: string, max = 600) {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)));
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
    activationUrl: string;
    publicRef: string;
  }) {
    return this.queueTransactional({
      to: input.to,
      recipientName: input.recipientName,
      templateKey: MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION,
      subject: "Activate your ProjTrack account",
      payload: {
        activationUrl: input.activationUrl,
        firstName: input.firstName,
        mailCategory: MAIL_CATEGORY_KEYS.AUTH,
      },
      idempotencyKey: `mail:account-activation:${input.publicRef}`,
      idempotencyUntil: new Date(Date.now() + MAIL_IDEMPOTENCY_WINDOWS_MS.ACCOUNT_ACTIVATION),
    });
  }

  async queueStudentSetupInvitation(input: {
    to: string;
    recipientName?: string;
    firstName?: string;
    activationUrl: string;
    publicRef: string;
  }) {
    return this.queueTransactional({
      to: input.to,
      recipientName: input.recipientName,
      templateKey: MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION,
      subject: "Activate your ProjTrack account",
      payload: {
        activationUrl: input.activationUrl,
        firstName: input.firstName,
        mailCategory: MAIL_CATEGORY_KEYS.INVITE,
      },
      idempotencyKey: `mail:student-setup-invite:${input.publicRef}`,
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

  async listJobs(input?: MailJobListOptions) {
    const rows = await this.prisma.emailJob.findMany({
      where: input?.includeArchived ? undefined : { archivedAt: null },
      orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
    });
    const identities = await this.recipientIdentitiesForJobs(rows);

    return rows.map((row) =>
      this.serializeJob(row, identities.get(normalizeEmail(row.userEmail))),
    );
  }

  async retryJob(id: string, options?: RetryMailJobOptions) {
    const job = await this.prisma.emailJob.findUnique({ where: { id: String(id) } });
    if (!job) {
      throw new NotFoundException('Mail job not found.');
    }

    await this.transport.ensureReadyForQueue();
    const next = await this.retryExistingJob(job, options);

    return this.serializeJob(next);
  }

  async retryJobs(ids: string[], options?: RetryMailJobOptions) {
    const normalizedIds = normalizeIds(ids);
    if (!normalizedIds.length) {
      throw new BadRequestException('Select at least one mail job to retry.');
    }

    await this.transport.ensureReadyForQueue();
    const jobs = await this.prisma.emailJob.findMany({
      where: { id: { in: normalizedIds } },
      orderBy: { createdAt: 'desc' },
    });

    const foundIds = new Set(jobs.map((job) => job.id));
    const retried: string[] = [];
    const blocked: Array<{ id: string; reason: string }> = [];
    const missing = normalizedIds.filter((id) => !foundIds.has(id));

    for (const job of jobs) {
      try {
        await this.retryExistingJob(job, options);
        retried.push(job.id);
      } catch (error) {
        blocked.push({
          id: job.id,
          reason: error instanceof Error ? error.message : 'Unable to retry this job.',
        });
      }
    }

    return {
      success: blocked.length === 0,
      retriedCount: retried.length,
      blockedCount: blocked.length,
      missingCount: missing.length,
      retriedIds: retried,
      blocked,
      missingIds: missing,
    };
  }

  async queueAdminTestEmail(to: string) {
    const normalized = normalizeEmail(to);
    if (!normalized) {
      throw new BadRequestException('Recipient email is required.');
    }
    const job = await this.queueTransactional({
      to: normalized,
      recipientName: 'ProjTrack Mail Test',
      subject: 'ProjTrack Mailrelay test',
      templateKey: MAIL_TEMPLATE_KEYS.BROADCAST,
      payload: {
        name: 'ProjTrack administrator',
        title: 'ProjTrack Mailrelay test',
        body: 'This is a production mail configuration test generated from the ProjTrack admin mail operations page.',
        mailCategory: MAIL_CATEGORY_KEYS.ADMIN,
      },
      idempotencyKey: `mail:test:${normalized}:${Date.now()}`,
    });
    return {
      success: true,
      queued: true,
      provider: this.transport.getProviderName(),
      status: job.status,
      jobId: job.id,
      providerMessageId: job.providerMessageId || null,
      latestSafeProviderError: job.lastError || null,
      detail: 'Queued. Waiting for mail worker.',
    };
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
        scheduledAt: null,
        attempts: 0,
        lastAttemptAt: null,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        failureReason: null,
        retryableFailure: null,
        archivedAt: null,
        provider: this.transport.getProviderName(),
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

  async cancelJob(id: string) {
    const job = await this.prisma.emailJob.findUnique({ where: { id: String(id) } });
    if (!job) {
      throw new NotFoundException('Mail job not found.');
    }
    if (job.status === EmailJobStatus.SENT) {
      throw new BadRequestException('Sent mail jobs cannot be cancelled.');
    }
    if (job.status !== EmailJobStatus.QUEUED) {
      throw new BadRequestException('Only queued mail jobs can be cancelled.');
    }

    const updated = await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.CANCELLED,
        scheduledAt: null,
        lastError: 'Cancelled by admin.',
        failureReason: null,
        retryableFailure: null,
        lockedAt: null,
        lockedBy: null,
      },
    });

    return this.serializeJob(updated);
  }

  async archiveJob(id: string) {
    const job = await this.prisma.emailJob.findUnique({ where: { id: String(id) } });
    if (!job) {
      throw new NotFoundException('Mail job not found.');
    }
    if (
      job.status !== EmailJobStatus.SENT &&
      job.status !== EmailJobStatus.DEAD &&
      job.status !== EmailJobStatus.CANCELLED
    ) {
      throw new BadRequestException('Only sent, dead, or cancelled mail jobs can be archived.');
    }

    const archived = await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        archivedAt: job.archivedAt ?? new Date(),
      },
    });

    return this.serializeJob(archived);
  }

  async archiveOldJobs(input?: ArchiveMailJobsInput) {
    const olderThanDays = Math.max(1, Math.min(365, Number(input?.olderThanDays ?? 30) || 30));
    const olderThan = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.emailJob.updateMany({
      where: {
        archivedAt: null,
        status: { in: [EmailJobStatus.SENT, EmailJobStatus.DEAD, EmailJobStatus.CANCELLED] },
        OR: [
          { sentAt: { lt: olderThan } },
          { sentAt: null, updatedAt: { lt: olderThan } },
        ],
      },
      data: {
        archivedAt: new Date(),
      },
    });

    return {
      success: true,
      archivedCount: result.count,
      olderThanDays,
    };
  }

  async healthCheck() {
    const [transportStatus, queued, dead, pausedLimitReached, sent24h, limits] = await Promise.all([
      this.transport.verifyTransport(),
      this.prisma.emailJob.count({ where: { status: EmailJobStatus.QUEUED, archivedAt: null } }),
      this.prisma.emailJob.count({ where: { status: EmailJobStatus.DEAD, archivedAt: null } }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.PAUSED_LIMIT_REACHED, archivedAt: null },
      }),
      this.prisma.emailJob.count({
        where: {
          archivedAt: null,
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

  private async retryExistingJob(job: any, options?: RetryMailJobOptions) {
    this.assertRetryAllowed(job, options);

    const previousPayload = asPayloadRecord(job.payload);
    const retriedAt = new Date().toISOString();
    const previousErrorContext =
      job.lastError || job.failureReason
        ? mergePayload(previousPayload, {
            previousLastError: job.lastError ?? undefined,
            previousFailureReason: job.failureReason ?? undefined,
            previousStatus: job.status,
            previousAttempts: job.attempts ?? 0,
            retriedAt,
          })
      : mergePayload(previousPayload, {
          previousAttempts: job.attempts ?? 0,
          retriedAt,
        });

    const currentSubject = String(job.subject ?? '').trim();
    let restoredSubject: string | undefined;

    if (!currentSubject) {
      // Restore subjects for legacy dead jobs created before template guardrails so retries do not requeue permanently unsendable mail.
      const subjectByTemplateKey: Record<string, string> = {
        'account-activation': 'Activate your ProjTrack account',
        'password-reset': 'Reset your ProjTrack password',
      };

      restoredSubject = subjectByTemplateKey[String(job.templateKey ?? '')];
    }

    return this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.QUEUED,
        scheduledAt: null,
        attempts: 0,
        payload: previousErrorContext as Prisma.InputJsonValue,
        lastError: null,
        failureReason: null,
        retryableFailure: null,
        providerMessageId: null,
        deliveredAt: null,
        lockedAt: null,
        lockedBy: null,
        sentAt: null,
        archivedAt: null,
        provider: this.transport.getProviderName(),
        ...(restoredSubject ? { subject: restoredSubject } : {}),
      },
    });
  }

  private async createJob(type: EmailJobType, input: QueueMailInput) {
    const userEmail = normalizeEmail(input.userEmail || input.to || '');
    if (!userEmail) {
      throw new BadRequestException('Missing email recipient.');
    }
    const safePayload = validateMailTemplatePayload(
      input.templateKey,
      mergePayload(input.payload, {
        firstName:
          typeof input.payload?.firstName === 'string' && input.payload.firstName.trim()
            ? input.payload.firstName
            : input.recipientName,
      }),
    );

    await this.transport.ensureReadyForQueue();

    const now = new Date();
    const scheduledAt = scheduledDate(input.scheduledAt);
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const safeSubject = normalizeMailSubject(input.subject);
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
            subject: safeSubject,
            templateKey: input.templateKey,
            payload: safePayload as Prisma.InputJsonValue,
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
            retryableFailure: null,
            providerMessageId: null,
            deliveredAt: null,
            sentAt: null,
            lockedAt: null,
            lockedBy: null,
            archivedAt: null,
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
        subject: safeSubject,
        templateKey: input.templateKey,
        payload: safePayload as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAIL_MAX_ATTEMPTS,
        scheduledAt,
        campaignId: input.campaignId?.trim() || null,
        batchKey: input.batchKey?.trim() || null,
        provider: this.transport.getProviderName(),
        idempotencyKey,
        idempotencyUntil,
        retryableFailure: null,
        archivedAt: null,
      },
    });

    return this.serializeJob(created);
  }

  private async recipientIdentitiesForJobs(rows: Array<{ userEmail: string }>) {
    const emails = Array.from(
      new Set(rows.map((row) => normalizeEmail(row.userEmail)).filter(Boolean)),
    );
    const identities = new Map<string, MailJobRecipientIdentity>();
    if (!emails.length) {
      return identities;
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: emails.map((email) => ({
          email: { equals: email, mode: Prisma.QueryMode.insensitive },
        })),
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        studentProfile: {
          select: {
            id: true,
            studentNumber: true,
          },
        },
        teacherProfile: {
          select: {
            id: true,
            employeeId: true,
            department: true,
          },
        },
      },
    });

    for (const user of users) {
      identities.set(
        normalizeEmail(user.email),
        this.recipientIdentityFromUser(user as SafeMailRecipientUser),
      );
    }

    return identities;
  }

  private assertRetryAllowed(job: any, options?: RetryMailJobOptions) {
    if (!job) {
      throw new NotFoundException('Mail job not found.');
    }
    if (job.status === EmailJobStatus.SENT) {
      throw new BadRequestException('Sent mail jobs cannot be retried.');
    }
    if (job.status === EmailJobStatus.CANCELLED) {
      throw new BadRequestException('Cancelled mail jobs cannot be retried.');
    }
    if (
      job.status !== EmailJobStatus.FAILED &&
      job.status !== EmailJobStatus.DEAD &&
      job.status !== EmailJobStatus.PAUSED_LIMIT_REACHED
    ) {
      throw new BadRequestException('Only failed, dead, or paused mail jobs can be retried.');
    }

    const explicitForce = Boolean(options?.force);
    if (job.status === EmailJobStatus.DEAD && !this.isRetryableFailure(job) && !explicitForce) {
      throw new BadRequestException(
        'This job is marked as non-retryable. Confirm the fix, then retry again with force.',
      );
    }
  }

  private isRetryableFailure(job: any) {
    if (job.status === EmailJobStatus.FAILED || job.status === EmailJobStatus.PAUSED_LIMIT_REACHED) {
      return true;
    }

    if (typeof job.retryableFailure === 'boolean') {
      return job.retryableFailure;
    }

    const reason = String(job.failureReason ?? '').trim().toUpperCase();
    return (MAIL_RETRYABLE_FAILURE_REASONS as readonly string[]).includes(reason);
  }

  private recipientIdentityFromUser(user: SafeMailRecipientUser): MailJobRecipientIdentity {
    const fullName =
      [user.firstName, user.lastName]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' ') || undefined;
    const employeeId = user.teacherProfile?.employeeId || undefined;

    return {
      email: normalizeEmail(user.email),
      userId: user.id,
      role: String(user.role ?? ''),
      fullName,
      studentId: user.studentProfile?.studentNumber || undefined,
      teacherId: employeeId,
      employeeId,
      isExternal: false,
    };
  }

  private externalRecipientIdentity(email: string): MailJobRecipientIdentity {
    return {
      email: normalizeEmail(email),
      isExternal: true,
    };
  }

  private serializeJob(created: any, recipient?: MailJobRecipientIdentity) {
    const {
      payload: rawPayload,
      idempotencyKey: _idempotencyKey,
      lockedBy: _lockedBy,
      ...safeJob
    } = created;
    const payload = asPayloadRecord(rawPayload);
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
      ...safeJob,
      type: toTypeLabel(created.type),
      status: toStatusLabel(created.status),
      emailType: created.templateKey,
      provider: created.provider || this.transport.getProviderName(),
      failureReason: created.failureReason || null,
      retryableFailure:
        typeof created.retryableFailure === 'boolean' ? created.retryableFailure : undefined,
      recipient: recipient || this.externalRecipientIdentity(created.userEmail),
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

    if (
      reason === MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED ||
      isSenderNotConfirmedMessage(message)
    ) {
      return 'Sender not confirmed in Mailrelay. Confirm support@projtrack.codes, notification@projtrack.codes, and admin@projtrack.codes in Mailrelay. The job will retry automatically every 30–60 minutes once confirmed.';
    }

    if (reason === MAIL_FAILURE_REASONS.ACCOUNT_RESTRICTED || message.includes('under review')) {
      return 'Mailrelay has temporarily paused this account for review. Contact Mailrelay support, then retry the job after they clear the account.';
    }

    if (message.includes('dkim is not configured')) {
      return 'Add and verify the Mailrelay DKIM DNS record for projtrack.codes before retrying this job.';
    }

    if (message.includes('blocked testmail recipient in production')) {
      return 'Production safety blocked a testmail.app recipient. Use a real recipient email in production.';
    }

    if (reason === MAIL_FAILURE_REASONS.AUTH_FAILED || message.includes('api key')) {
      return 'Verify the Mailrelay API key and provider permissions before retrying this job.';
    }

    if (reason === MAIL_FAILURE_REASONS.INVALID_RECIPIENT) {
      return 'Correct the recipient email address before retrying this job.';
    }

    if (reason === MAIL_FAILURE_REASONS.PROVIDER_REJECTED) {
      return 'Mailrelay rejected this request. Fix the sender, recipient, or policy issue before retrying this job.';
    }

    if (
      reason === MAIL_FAILURE_REASONS.RATE_LIMITED ||
      reason === MAIL_FAILURE_REASONS.MAILRELAY_RATE_LIMIT_REACHED ||
      reason === MAIL_FAILURE_REASONS.SENDER_RATE_LIMIT_REACHED
    ) {
      if (message.includes('monthly limit')) {
        return 'The configured provider monthly limit was reached before this job could be sent.';
      }
      if (message.includes('daily safety limit')) {
        return 'The configured provider daily safety limit was reached before this job could be sent.';
      }
      return 'Rate limiting paused this job. It will retry automatically when the limit window clears.';
    }

    if (
      reason === MAIL_FAILURE_REASONS.NETWORK_ERROR ||
      reason === MAIL_FAILURE_REASONS.PROVIDER_TEMPORARY
    ) {
      return 'This looks temporary. The worker will retry automatically unless the retry budget is exhausted.';
    }

    if (reason === MAIL_FAILURE_REASONS.WORKER_STALE_PROCESSING) {
      return 'The worker recovered a stale processing lock. Confirm delivery outcome before manually retrying if the retry budget was exhausted.';
    }

    if (message.includes('retry budget exhausted')) {
      return 'The retry budget is exhausted. Confirm the provider issue is fixed, then manually retry this job.';
    }

    if (message.includes('mailrelay_api_key is missing')) {
      return 'Set MAILRELAY_API_KEY in the backend environment before retrying this job.';
    }

    if ((MAIL_NON_RETRYABLE_FAILURE_REASONS as readonly string[]).includes(reason)) {
      return 'This provider failure is non-retryable until the underlying configuration or recipient problem is fixed.';
    }

    if (
      (MAIL_RETRYABLE_FAILURE_REASONS as readonly string[]).includes(reason) ||
      reason === MAIL_FAILURE_REASONS.UNKNOWN_PROVIDER_ERROR
    ) {
      return 'Inspect the safe provider error and confirm the issue before manually retrying this job.';
    }

    return null;
  }
}
