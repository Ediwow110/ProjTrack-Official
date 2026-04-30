import { Injectable } from '@nestjs/common';
import { EmailJobStatus, EmailJobType } from '@prisma/client';
import {
  MAIL_FAILURE_REASONS,
  MAIL_PROVIDER_NAMES,
} from '../common/constants/mail.constants';
import {
  MAIL_LIMIT_DEFAULTS,
  MAIL_LIMIT_ENV_KEYS,
} from '../common/constants/mail-policy.constants';
import { PrismaService } from '../prisma/prisma.service';

export type MailLimitReason =
  (typeof MAIL_FAILURE_REASONS)[keyof typeof MAIL_FAILURE_REASONS];

export type MailLimitCheckResult = {
  allowed: boolean;
  reason: MailLimitReason | null;
  detail: string;
};

export type MailLimitUsage = {
  enabled: boolean;
  provider: string;
  monthlyLimit: number | null;
  dailySafetyLimit: number | null;
  transactionalPerMinuteLimit: number | null;
  bulkPerMinuteLimit: number | null;
  monthlySent: number;
  dailySent: number;
  transactionalSentLastMinute: number;
  bulkSentLastMinute: number;
};

function envNumber(keys: readonly string[], fallback: number) {
  for (const key of keys) {
    const raw = Number(process.env[key]);
    if (Number.isFinite(raw) && raw > 0) {
      return Math.floor(raw);
    }
  }
  return fallback;
}

function startOfDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function providerLabel(provider: string) {
  return provider === MAIL_PROVIDER_NAMES.SENDER ? 'Sender.net' : 'Mailrelay';
}

@Injectable()
export class MailLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async checkBeforeSend(provider: string, type: EmailJobType): Promise<MailLimitCheckResult> {
    if (
      provider !== MAIL_PROVIDER_NAMES.MAILRELAY &&
      provider !== MAIL_PROVIDER_NAMES.SENDER
    ) {
      return {
        allowed: true,
        reason: null,
        detail: 'Provider-level send limits are disabled for the active provider.',
      };
    }

    const usage = await this.getUsage(provider);
    const providerName = providerLabel(provider);
    const rateLimitReason = MAIL_FAILURE_REASONS.RATE_LIMITED;

    if (usage.monthlyLimit !== null && usage.monthlySent >= usage.monthlyLimit) {
      return {
        allowed: false,
        reason: rateLimitReason,
        detail: `${providerName} monthly limit reached (${usage.monthlySent}/${usage.monthlyLimit}).`,
      };
    }

    if (usage.dailySafetyLimit !== null && usage.dailySent >= usage.dailySafetyLimit) {
      return {
        allowed: false,
        reason: rateLimitReason,
        detail: `${providerName} daily safety limit reached (${usage.dailySent}/${usage.dailySafetyLimit}).`,
      };
    }

    if (
      type === EmailJobType.TRANSACTIONAL &&
      usage.transactionalPerMinuteLimit !== null &&
      usage.transactionalSentLastMinute >= usage.transactionalPerMinuteLimit
    ) {
      return {
        allowed: false,
        reason: rateLimitReason,
        detail: `${providerName} transactional per-minute limit reached (${usage.transactionalSentLastMinute}/${usage.transactionalPerMinuteLimit}).`,
      };
    }

    if (
      type === EmailJobType.BULK &&
      usage.bulkPerMinuteLimit !== null &&
      usage.bulkSentLastMinute >= usage.bulkPerMinuteLimit
    ) {
      return {
        allowed: false,
        reason: rateLimitReason,
        detail: `${providerName} bulk per-minute limit reached (${usage.bulkSentLastMinute}/${usage.bulkPerMinuteLimit}).`,
      };
    }

    return {
      allowed: true,
      reason: null,
      detail: `${providerName} app-side send limits allow this send.`,
    };
  }

  async getUsage(provider = String(process.env.MAIL_PROVIDER ?? '').trim().toLowerCase()): Promise<MailLimitUsage> {
    if (
      provider !== MAIL_PROVIDER_NAMES.MAILRELAY &&
      provider !== MAIL_PROVIDER_NAMES.SENDER
    ) {
      return {
        enabled: false,
        provider,
        monthlyLimit: null,
        dailySafetyLimit: null,
        transactionalPerMinuteLimit: null,
        bulkPerMinuteLimit: null,
        monthlySent: 0,
        dailySent: 0,
        transactionalSentLastMinute: 0,
        bulkSentLastMinute: 0,
      };
    }

    const now = new Date();
    const lastMinute = new Date(now.getTime() - 60_000);
    const isMailrelay = provider === MAIL_PROVIDER_NAMES.MAILRELAY;
    const monthlyLimit = isMailrelay
      ? envNumber(
          MAIL_LIMIT_ENV_KEYS.MONTHLY_LIMIT,
          MAIL_LIMIT_DEFAULTS.MONTHLY_LIMIT,
        )
      : envNumber(['SENDER_MONTHLY_LIMIT'], 15_000);
    const dailySafetyLimit = isMailrelay
      ? envNumber(
          MAIL_LIMIT_ENV_KEYS.DAILY_SAFETY_LIMIT,
          MAIL_LIMIT_DEFAULTS.DAILY_SAFETY_LIMIT,
        )
      : envNumber(['SENDER_DAILY_SAFETY_LIMIT'], 1_000);
    const transactionalPerMinuteLimit = isMailrelay
      ? envNumber(
          MAIL_LIMIT_ENV_KEYS.TX_PER_MIN,
          MAIL_LIMIT_DEFAULTS.TX_PER_MIN,
        )
      : null;
    const bulkPerMinuteLimit = isMailrelay
      ? envNumber(
          MAIL_LIMIT_ENV_KEYS.BULK_PER_MIN,
          MAIL_LIMIT_DEFAULTS.BULK_PER_MIN,
        )
      : null;

    const [monthlySent, dailySent, transactionalSentLastMinute, bulkSentLastMinute] =
      await Promise.all([
        this.prisma.emailJob.count({
          where: {
            provider,
            status: EmailJobStatus.SENT,
            sentAt: { gte: startOfMonth(now) },
          },
        }),
        this.prisma.emailJob.count({
          where: {
            provider,
            status: EmailJobStatus.SENT,
            sentAt: { gte: startOfDay(now) },
          },
        }),
        this.prisma.emailJob.count({
          where: {
            provider,
            status: EmailJobStatus.SENT,
            type: EmailJobType.TRANSACTIONAL,
            sentAt: { gte: lastMinute },
          },
        }),
        this.prisma.emailJob.count({
          where: {
            provider,
            status: EmailJobStatus.SENT,
            type: EmailJobType.BULK,
            sentAt: { gte: lastMinute },
          },
        }),
      ]);

    return {
      enabled: true,
      provider,
      monthlyLimit,
      dailySafetyLimit,
      transactionalPerMinuteLimit,
      bulkPerMinuteLimit,
      monthlySent,
      dailySent,
      transactionalSentLastMinute,
      bulkSentLastMinute,
    };
  }
}
