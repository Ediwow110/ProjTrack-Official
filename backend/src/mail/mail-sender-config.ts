import {
  MAIL_CATEGORY_KEYS,
  type MailCategoryKey,
} from '../common/constants/mail.constants';
import {
  isProductionEmailEnvironment,
  normalizeEmail,
} from './mail-environment.guard';

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

export const VERIFIED_PRODUCTION_SENDERS = {
  support: 'support@projtrack.codes',
  notification: 'notification@projtrack.codes',
  admin: 'admin@projtrack.codes',
} as const;

const REQUIRED_PRODUCTION_SENDER_MAPPING: Array<[string, string]> = [
  ['MAIL_FROM_NAME', DEFAULT_FROM_NAME],
  ['MAIL_FROM_SUPPORT', VERIFIED_PRODUCTION_SENDERS.support],
  ['MAIL_FROM_INVITE', VERIFIED_PRODUCTION_SENDERS.support],
  ['MAIL_FROM_NOREPLY', VERIFIED_PRODUCTION_SENDERS.support],
  ['MAIL_FROM_NOTIFY', VERIFIED_PRODUCTION_SENDERS.notification],
  ['MAIL_FROM_ADMIN', VERIFIED_PRODUCTION_SENDERS.admin],
];

const FORBIDDEN_PRODUCTION_SENDER_MARKERS = [
  '@projtrack.local',
  '@example.com',
  '@test.com',
  'localhost',
  'noreply@projtrack.codes',
];

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
      return config.support;
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

function rawEnvValue(env: NodeJS.ProcessEnv, key: string) {
  return String(env[key] ?? '').trim();
}

function senderContainsForbiddenProductionMarker(email: string) {
  const normalized = normalizeEmail(email);
  return FORBIDDEN_PRODUCTION_SENDER_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
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

  if (isProductionEmailEnvironment(env)) {
    for (const [key, expected] of REQUIRED_PRODUCTION_SENDER_MAPPING) {
      const actual =
        key === 'MAIL_FROM_NAME'
          ? rawEnvValue(env, key)
          : normalizeEmail(rawEnvValue(env, key));
      if (actual !== expected) {
        issues.push(`${key} must be ${expected} in production.`);
      }
    }

    for (const [key, sender] of entries) {
      if (senderContainsForbiddenProductionMarker(sender.email)) {
        issues.push(`${key} cannot use local, placeholder, noreply, or fake sender domains in production.`);
      }
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
