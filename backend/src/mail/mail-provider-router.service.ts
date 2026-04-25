import { Injectable } from '@nestjs/common';
import {
  MAIL_CATEGORY_KEYS,
  MAIL_TEMPLATE_KEYS,
  type MailCategoryKey,
} from '../common/constants/mail.constants';
import {
  normalizeEmail,
  resolveEmailRecipient,
  type EmailType,
} from './mail-environment.guard';
import type { MailSendInput } from './providers/mail-provider.interface';

export type RoutedMailSendInput = MailSendInput & {
  originalTo: string;
  fromEmail: string;
  fromName: string;
  mailCategory: MailCategoryKey;
  emailType: EmailType;
  routedToTestmail: boolean;
};

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizedTemplateKey(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function asBoolean(value: unknown) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

@Injectable()
export class MailProviderRouterService {
  resolve(input: MailSendInput): RoutedMailSendInput {
    const originalTo = normalizeEmail(input.originalTo || input.to);
    const mailCategory = this.resolveCategory(input);
    const emailType = this.resolveEmailType(input, mailCategory);
    const routedTo = resolveEmailRecipient(originalTo, emailType);
    const fromName = envValue('MAIL_FROM_NAME') || 'ProjTrack';
    const fromEmail =
      normalizeEmail(input.fromEmail || this.resolveFromAddress(mailCategory)) ||
      'noreply@projtrack.local';

    return {
      ...input,
      to: routedTo,
      originalTo,
      fromEmail,
      fromName: String(input.fromName ?? fromName).trim() || fromName,
      mailCategory,
      emailType,
      routedToTestmail: routedTo !== originalTo,
    };
  }

  getDefaultFromAddress() {
    const fromName = envValue('MAIL_FROM_NAME') || 'ProjTrack';
    const fromEmail =
      normalizeEmail(
        envValue('MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM', 'MAIL_FROM_ADMIN'),
      ) || 'noreply@projtrack.local';
    return `${fromName} <${fromEmail}>`;
  }

  private resolveCategory(input: MailSendInput): MailCategoryKey {
    const explicit = String(input.mailCategory ?? '').trim().toLowerCase();
    if (
      explicit === MAIL_CATEGORY_KEYS.AUTH ||
      explicit === MAIL_CATEGORY_KEYS.INVITE ||
      explicit === MAIL_CATEGORY_KEYS.NOTIFICATION ||
      explicit === MAIL_CATEGORY_KEYS.SUPPORT ||
      explicit === MAIL_CATEGORY_KEYS.ADMIN
    ) {
      return explicit as MailCategoryKey;
    }

    const templateKey = normalizedTemplateKey(input.templateKey);
    if (
      templateKey === MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION ||
      templateKey === MAIL_TEMPLATE_KEYS.PASSWORD_RESET ||
      templateKey === MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION ||
      templateKey.includes('activation') ||
      templateKey.includes('password-reset') ||
      templateKey.includes('verify-email') ||
      templateKey.includes('verification')
    ) {
      return MAIL_CATEGORY_KEYS.AUTH;
    }

    if (templateKey.includes('invite')) {
      return MAIL_CATEGORY_KEYS.INVITE;
    }

    if (templateKey.includes('support') || templateKey.includes('contact')) {
      return MAIL_CATEGORY_KEYS.SUPPORT;
    }

    if (
      templateKey.includes('notice') ||
      templateKey.includes('notification') ||
      templateKey.includes('announcement') ||
      templateKey.includes('reminder') ||
      templateKey.includes('submission') ||
      templateKey.includes('project') ||
      templateKey.includes('activity') ||
      templateKey.includes('class')
    ) {
      return MAIL_CATEGORY_KEYS.NOTIFICATION;
    }

    if (
      templateKey.includes('broadcast') ||
      templateKey.includes('admin') ||
      templateKey.includes('system')
    ) {
      return MAIL_CATEGORY_KEYS.ADMIN;
    }

    if (asBoolean(input.tags?.bulk)) {
      return MAIL_CATEGORY_KEYS.INVITE;
    }

    if (asBoolean(input.tags?.transactional)) {
      return MAIL_CATEGORY_KEYS.AUTH;
    }

    return MAIL_CATEGORY_KEYS.ADMIN;
  }

  private resolveFromAddress(category: MailCategoryKey) {
    switch (category) {
      case MAIL_CATEGORY_KEYS.AUTH:
        return envValue('MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM', 'MAIL_FROM_ADMIN');
      case MAIL_CATEGORY_KEYS.INVITE:
        return envValue('MAIL_FROM_INVITE', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
      case MAIL_CATEGORY_KEYS.NOTIFICATION:
        return envValue('MAIL_FROM_NOTIFY', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
      case MAIL_CATEGORY_KEYS.SUPPORT:
        return envValue('MAIL_FROM_SUPPORT', 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
      case MAIL_CATEGORY_KEYS.ADMIN:
      default:
        return envValue('MAIL_FROM_ADMIN', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
    }
  }

  private resolveEmailType(
    input: MailSendInput,
    category: MailCategoryKey,
  ): EmailType {
    const explicit = String(input.emailType ?? '').trim().toLowerCase();
    if (explicit) {
      return explicit;
    }

    const templateKey = normalizedTemplateKey(input.templateKey);
    if (
      templateKey === MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION ||
      templateKey === MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION
    ) {
      return 'activation';
    }

    if (templateKey === MAIL_TEMPLATE_KEYS.PASSWORD_RESET) {
      return 'password_reset';
    }

    switch (category) {
      case MAIL_CATEGORY_KEYS.INVITE:
        return 'invitation';
      case MAIL_CATEGORY_KEYS.NOTIFICATION:
      case MAIL_CATEGORY_KEYS.SUPPORT:
      case MAIL_CATEGORY_KEYS.ADMIN:
        return 'notification';
      default:
        return 'activation';
    }
  }
}
