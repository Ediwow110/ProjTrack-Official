import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MAIL_PROVIDER_NAMES } from '../../common/constants/mail.constants';
import { MAIL_FAILURE_REASONS } from '../../common/constants/mail.constants';
import { VERIFIED_PRODUCTION_SENDERS } from '../mail-sender-config';
import { classifyProviderError } from './provider-error-classification';
import type { MailProvider, MailSendInput } from './mail-provider.interface';

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function resolveFromIdentity(input?: MailSendInput) {
  const defaultFromName = envValue('MAIL_FROM_NAME') || 'ProjTrack';
  const defaultFromEmail =
    envValue('MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM', 'MAIL_FROM_ADMIN') ||
    VERIFIED_PRODUCTION_SENDERS.support;
  return {
    fromName: String(input?.fromName ?? defaultFromName).trim() || 'ProjTrack',
    fromEmail:
      String(input?.fromEmail ?? defaultFromEmail).trim().toLowerCase() ||
      VERIFIED_PRODUCTION_SENDERS.support,
  };
}

@Injectable()
export class StubMailProvider implements MailProvider {
  readonly name = MAIL_PROVIDER_NAMES.STUB;
  private readonly logger = new Logger(StubMailProvider.name);

  getFromAddress() {
    const { fromName, fromEmail } = resolveFromIdentity();
    return `${fromName} <${fromEmail}>`;
  }

  async verify() {
    const timestamp = new Date().toISOString();
    return {
      ok: true,
      provider: this.name,
      verified: true,
      from: this.getFromAddress(),
      detail: 'Stub mail provider is enabled; messages are logged and not delivered.',
      timestamp,
    };
  }

  async send(input: MailSendInput) {
    const messageId = `stub:${randomUUID()}`;
    const { fromEmail, fromName } = resolveFromIdentity(input);
    this.logger.log(
      JSON.stringify({
        event: 'mail.stub.send',
        messageId,
        to: input.to,
        originalTo: input.originalTo || input.to,
        from: `${fromName} <${fromEmail}>`,
        subject: input.subject,
        templateKey: input.templateKey,
        mailCategory: input.mailCategory,
      }),
    );
    return { provider: this.name, messageId };
  }

  classifyError(error: unknown) {
    const statusCode =
      Number(
        (error as any)?.statusCode ??
          (error as any)?.status ??
          (error as any)?.response?.statusCode ??
          0,
      ) || undefined;
    const message = error instanceof Error ? error.message : String(error || 'Mail delivery failed.');

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return {
        retryable: false,
        permanent: true,
        reason: message,
        failureReason: MAIL_FAILURE_REASONS.PROVIDER_REJECTED,
        statusCode,
      };
    }

    return classifyProviderError(error);
  }
}
