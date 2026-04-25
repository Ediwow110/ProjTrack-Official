import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { MAIL_PROVIDER_NAMES } from '../../common/constants/mail.constants';
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
    'noreply@projtrack.local';
  return {
    fromName: String(input?.fromName ?? defaultFromName).trim() || 'ProjTrack',
    fromEmail: String(input?.fromEmail ?? defaultFromEmail).trim().toLowerCase() || 'noreply@projtrack.local',
  };
}

@Injectable()
export class ResendMailProvider implements MailProvider {
  readonly name = MAIL_PROVIDER_NAMES.RESEND;

  private client() {
    const apiKey = envValue('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when MAIL_PROVIDER=resend.');
    }
    return new Resend(apiKey);
  }

  getFromAddress() {
    const { fromName, fromEmail } = resolveFromIdentity();
    return `${fromName} <${fromEmail}>`;
  }

  async verify() {
    const timestamp = new Date().toISOString();
    const hasApiKey = Boolean(envValue('RESEND_API_KEY'));
    return {
      ok: hasApiKey,
      provider: this.name,
      verified: hasApiKey,
      from: this.getFromAddress(),
      detail: hasApiKey
        ? 'Resend provider is configured.'
        : 'RESEND_API_KEY is missing.',
      timestamp,
    };
  }

  async send(input: MailSendInput) {
    const { fromName, fromEmail } = resolveFromIdentity(input);
    const response = await this.client().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: input.recipientName ? [`${input.recipientName} <${input.to}>`] : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: Object.entries(input.tags ?? {}).map(([name, value]) => ({ name, value })),
    } as any);

    const data = (response as any).data;
    const error = (response as any).error;
    if (error) throw error;

    return {
      provider: this.name,
      messageId: data?.id ?? null,
    };
  }

  classifyError(error: unknown) {
    return classifyProviderError(error);
  }
}
