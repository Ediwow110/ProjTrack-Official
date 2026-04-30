import {
  MAIL_CATEGORY_KEYS,
  type MailCategoryKey,
} from '../common/constants/mail.constants';
import { normalizeEmail } from './mail-environment.guard';

export type MailSenderKey =
  | 'admin'
  | 'noreply'
  | 'invite'
  | 'notification'
  | 'support';

export type MailSenderAddress = {
  email: string;
  name: string;
};

export type MailSenderConfig = {
  fromName: string;
  admin: MailSenderAddress;
  noreply: MailSenderAddress;
  invite: MailSenderAddress;
  notification: MailSenderAddress;
  support: MailSenderAddress;
};

const DEFAULT_FROM_NAME = 'ProjTrack';

function envValue(env: NodeJS.ProcessEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = String(env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function senderAddress(
  env: NodeJS.ProcessEnv,
  fromName: string,
  ...keys: string[]
): MailSenderAddress {
  return {
    name: fromName,
    email: normalizeEmail(envValue(env, ...keys)),
  };
}

export function isValidSenderEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

export function resolveMailSenderConfig(
  env: NodeJS.ProcessEnv = process.env,
): MailSenderConfig {
  const fromName = envValue(env, 'MAIL_FROM_NAME') || DEFAULT_FROM_NAME;
  return {
    fromName,
    admin: senderAddress(env, fromName, 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM'),
    noreply: senderAddress(
      env,
      fromName,
      'MAIL_FROM_NOREPLY',
      'MAIL_FROM_EMAIL',
      'MAIL_FROM',
      'MAIL_FROM_ADMIN',
    ),
    invite: senderAddress(
      env,
      fromName,
      'MAIL_FROM_INVITE',
      'MAIL_FROM_NOREPLY',
      'MAIL_FROM_EMAIL',
      'MAIL_FROM',
      'MAIL_FROM_ADMIN',
    ),
    notification: senderAddress(
      env,
      fromName,
      'MAIL_FROM_NOTIFY',
      'MAIL_FROM_NOREPLY',
      'MAIL_FROM_EMAIL',
      'MAIL_FROM',
      'MAIL_FROM_ADMIN',
    ),
    support: senderAddress(
      env,
      fromName,
      'MAIL_FROM_SUPPORT',
      'MAIL_FROM_ADMIN',
      'MAIL_FROM_EMAIL',
      'MAIL_FROM',
    ),
  };
}

export function senderForMailCategory(
  category: MailCategoryKey,
  config: MailSenderConfig = resolveMailSenderConfig(),
) {
  switch (category) {
    case MAIL_CATEGORY_KEYS.AUTH:
      return config.noreply;
    case MAIL_CATEGORY_KEYS.INVITE:
      return config.invite;
    case MAIL_CATEGORY_KEYS.NOTIFICATION:
      return config.notification;
    case MAIL_CATEGORY_KEYS.SUPPORT:
      return config.support;
    case MAIL_CATEGORY_KEYS.ADMIN:
    default:
      return config.admin;
  }
}

export function getMailSenderConfigIssues(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = resolveMailSenderConfig(env);
  const entries: Array<[string, MailSenderAddress]> = [
    ['MAIL_FROM_ADMIN', config.admin],
    ['MAIL_FROM_NOREPLY', config.noreply],
    ['MAIL_FROM_INVITE', config.invite],
    ['MAIL_FROM_NOTIFY', config.notification],
    ['MAIL_FROM_SUPPORT', config.support],
  ];
  const issues: string[] = [];

  if (!String(env.MAIL_FROM_NAME ?? '').trim()) {
    issues.push('MAIL_FROM_NAME is required when MAIL_PROVIDER=mailrelay.');
  }

  for (const [key, sender] of entries) {
    if (!sender.email) {
      issues.push(`${key} is required when MAIL_PROVIDER=mailrelay.`);
    } else if (!isValidSenderEmail(sender.email)) {
      issues.push(`${key} must resolve to a valid sender email address.`);
    }
  }

  return issues;
}

export function publicMailSenderConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = resolveMailSenderConfig(env);
  return {
    fromName: config.fromName,
    admin: config.admin.email || null,
    noreply: config.noreply.email || null,
    invite: config.invite.email || null,
    notification: config.notification.email || null,
    support: config.support.email || null,
  };
}
