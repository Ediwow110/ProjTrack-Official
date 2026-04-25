import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EmailJobStatus, Prisma } from '@prisma/client';
import { Webhook } from 'svix';
import {
  MAIL_PROVIDER_NAMES,
  MAIL_SUPPRESSION_REASONS,
  MAIL_WEBHOOK_EVENT_TYPES,
} from '../common/constants/mail.constants';
import { PrismaService } from '../prisma/prisma.service';

type WebhookHeaders = Record<string, string | string[] | undefined>;

function headerValue(headers: WebhookHeaders, key: string) {
  const value = headers[key] ?? headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getEventType(payload: any) {
  return String(payload?.type || payload?.event || '').trim();
}

function getProviderMessageId(payload: any) {
  const data = payload?.data ?? payload;
  return String(data?.email_id || data?.emailId || data?.message_id || data?.messageId || data?.id || '').trim() || null;
}

function getRecipientEmail(payload: any) {
  const data = payload?.data ?? payload;
  const to = data?.to || data?.email || data?.recipient;
  if (Array.isArray(to)) return String(to[0] || '').trim().toLowerCase() || null;
  return String(to || '').trim().toLowerCase() || null;
}

function getEventDate(payload: any) {
  const data = payload?.data ?? payload;
  const raw = data?.created_at || data?.createdAt || payload?.created_at || payload?.createdAt;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

@Injectable()
export class MailWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async handleResendWebhook(rawBody: Buffer | string | undefined, headers: WebhookHeaders) {
    const payload = this.verifyPayload(rawBody, headers);
    const providerEventId = headerValue(headers, 'svix-id') || String((payload as any)?.id || '').trim();
    if (!providerEventId) {
      throw new BadRequestException('Missing webhook event id.');
    }

    const eventType = getEventType(payload);
    const providerMessageId = getProviderMessageId(payload);
    const email = getRecipientEmail(payload);

    try {
      await this.prisma.emailProviderEvent.create({
        data: {
          provider: MAIL_PROVIDER_NAMES.RESEND,
          providerEventId,
          eventType,
          providerMessageId,
          email,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { success: true, duplicate: true, providerEventId };
      }
      throw error;
    }

    await this.applyEventSideEffects({
      eventType,
      providerEventId,
      providerMessageId,
      email,
      payload,
    });

    await this.prisma.emailProviderEvent.update({
      where: {
        provider_providerEventId: {
          provider: MAIL_PROVIDER_NAMES.RESEND,
          providerEventId,
        },
      },
      data: { processedAt: new Date() },
    });

    return { success: true, duplicate: false, providerEventId, eventType };
  }

  private verifyPayload(rawBody: Buffer | string | undefined, headers: WebhookHeaders) {
    const body = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : String(rawBody || '');
    if (!body) throw new BadRequestException('Missing webhook body.');

    const webhookSecret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
    const allowUnsafeDev = /^(1|true|yes|on)$/i.test(
      String(process.env.ALLOW_UNSAFE_DEV_WEBHOOKS || ''),
    );

    if (!webhookSecret) {
      if (!allowUnsafeDev) {
        throw new UnauthorizedException('Webhook secret is not configured.');
      }
      return JSON.parse(body);
    }

    try {
      const webhook = new Webhook(webhookSecret);
      return webhook.verify(body, {
        'svix-id': headerValue(headers, 'svix-id') || '',
        'svix-timestamp': headerValue(headers, 'svix-timestamp') || '',
        'svix-signature': headerValue(headers, 'svix-signature') || '',
      });
    } catch {
      throw new UnauthorizedException('Invalid webhook signature.');
    }
  }

  private async applyEventSideEffects(input: {
    eventType: string;
    providerEventId: string;
    providerMessageId: string | null;
    email: string | null;
    payload: unknown;
  }) {
    const deliveredAt = getEventDate(input.payload);

    if (input.eventType === MAIL_WEBHOOK_EVENT_TYPES.DELIVERED && input.providerMessageId) {
      await this.prisma.emailJob.updateMany({
        where: { providerMessageId: input.providerMessageId },
        data: { deliveredAt },
      });
      return;
    }

    if (
      input.eventType === MAIL_WEBHOOK_EVENT_TYPES.BOUNCED ||
      input.eventType === MAIL_WEBHOOK_EVENT_TYPES.COMPLAINED
    ) {
      if (input.email) {
        await this.prisma.emailSuppression.upsert({
          where: { email: input.email },
          update: {
            reason:
              input.eventType === MAIL_WEBHOOK_EVENT_TYPES.BOUNCED
                ? MAIL_SUPPRESSION_REASONS.BOUNCED
                : MAIL_SUPPRESSION_REASONS.COMPLAINED,
            source: `${MAIL_PROVIDER_NAMES.RESEND}:webhook`,
            suppressedAt: new Date(),
          },
          create: {
            email: input.email,
            reason:
              input.eventType === MAIL_WEBHOOK_EVENT_TYPES.BOUNCED
                ? MAIL_SUPPRESSION_REASONS.BOUNCED
                : MAIL_SUPPRESSION_REASONS.COMPLAINED,
            source: `${MAIL_PROVIDER_NAMES.RESEND}:webhook`,
          },
        });
      }

      if (input.providerMessageId) {
        await this.prisma.emailJob.updateMany({
          where: { providerMessageId: input.providerMessageId },
          data: {
            status: EmailJobStatus.DEAD,
            lastError:
              input.eventType === MAIL_WEBHOOK_EVENT_TYPES.BOUNCED
                ? MAIL_SUPPRESSION_REASONS.BOUNCED
                : MAIL_SUPPRESSION_REASONS.COMPLAINED,
          },
        });
      }
    }
  }
}
