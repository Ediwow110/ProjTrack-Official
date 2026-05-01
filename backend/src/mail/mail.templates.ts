import { BadRequestException } from '@nestjs/common';
import { MAIL_TEMPLATE_KEYS } from '../common/constants/mail.constants';

export type MailTemplateKey =
  (typeof MAIL_TEMPLATE_KEYS)[keyof typeof MAIL_TEMPLATE_KEYS];

export type MailTemplatePayload = Record<string, unknown>;

export type RenderedMailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const KNOWN_TEMPLATE_KEYS = new Set<string>(Object.values(MAIL_TEMPLATE_KEYS));
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const ACCOUNT_ACTIVATION_SUBJECT = 'Activate your ProjTrack account';

const TEMPLATE_ALLOWED_FIELDS: Record<string, readonly string[]> = {
  [MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION]: ['firstName', 'name', 'activationUrl', 'activationLink', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION]: ['firstName', 'name', 'verificationLink', 'activationUrl', 'activationLink', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.PASSWORD_RESET]: ['firstName', 'name', 'resetLink', 'expiresAt', 'isFirstTimeSetup', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE]: ['firstName', 'name', 'activityTitle', 'title', 'body', 'subjectName', 'teacherName', 'activityLink', 'link', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.BULK_INVITATION]: ['firstName', 'name', 'inviteLink', 'activationLink', 'role', 'title', 'body', 'unsubscribeUrl', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.BROADCAST]: ['firstName', 'name', 'title', 'subject', 'body', 'message', 'unsubscribeUrl', 'mailCategory'],
};

function isProductionRuntime() {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production' ||
    String(process.env.APP_ENV ?? '').toLowerCase() === 'production';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function truncate(value: string, max: number) {
  const normalized = asText(value);
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function normalizeSubject(value: unknown, fallback: string) {
  const subject = truncate(asText(value, fallback).replace(/[\r\n]+/g, ' '), 160);
  if (!subject) throw new BadRequestException('Mail subject is required.');
  return subject;
}

function appName() {
  return asText(process.env.MAIL_FROM_NAME, 'ProjTrack');
}

function requireKnownTemplateKey(templateKey: string): MailTemplateKey {
  const key = asText(templateKey);
  if (!KNOWN_TEMPLATE_KEYS.has(key)) {
    throw new BadRequestException(`Unknown mail template key: ${key || '(empty)'}.`);
  }
  return key as MailTemplateKey;
}

function assertAllowedVariables(templateKey: MailTemplateKey, payload: MailTemplatePayload) {
  if (!/^(1|true|yes|on)$/i.test(String(process.env.MAIL_TEMPLATE_STRICT_VARIABLES ?? 'false'))) {
    return;
  }
  const allowed = new Set(TEMPLATE_ALLOWED_FIELDS[templateKey] || []);
  const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new BadRequestException(`Unknown variables for ${templateKey}: ${unknown.join(', ')}.`);
  }
}

function requiredText(payload: MailTemplatePayload, keys: string[], label: string, max = 500) {
  for (const key of keys) {
    const value = truncate(asText(payload[key]), max);
    if (value) return value;
  }
  throw new BadRequestException(`${label} is required for this mail template.`);
}

function optionalText(payload: MailTemplatePayload, keys: string[], fallback = '', max = 500) {
  for (const key of keys) {
    const value = truncate(asText(payload[key]), max);
    if (value) return value;
  }
  return truncate(fallback, max);
}

function assertSafeUrl(value: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException(`${label} must be a valid absolute URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException(`${label} must use http or https.`);
  }
  if (isProductionRuntime()) {
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(`${label} must use https in production.`);
    }
    if (LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new BadRequestException(`${label} cannot point to localhost in production.`);
    }
  }
  return parsed.toString();
}

function requiredUrl(payload: MailTemplatePayload, keys: string[], label: string) {
  return assertSafeUrl(requiredText(payload, keys, label, 2048), label);
}

function optionalUrl(payload: MailTemplatePayload, keys: string[], label: string) {
  const value = optionalText(payload, keys, '', 2048);
  return value ? assertSafeUrl(value, label) : '';
}

function requiredDate(payload: MailTemplatePayload, key: string, label: string) {
  const raw = requiredText(payload, [key], label, 120);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid date.`);
  }
  return date.toISOString();
}

function withoutUndefined(payload: MailTemplatePayload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function validateMailTemplatePayload(templateKey: string, payload: MailTemplatePayload): MailTemplatePayload {
  const key = requireKnownTemplateKey(templateKey);
  const base = withoutUndefined(payload || {});
  assertAllowedVariables(key, base);

  switch (key) {
    case MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name'], 'firstName', 120),
        activationUrl: requiredUrl(base, ['activationUrl', 'activationLink'], 'activationUrl'),
      };
    case MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name'], 'firstName', 120),
        activationUrl: requiredUrl(base, ['verificationLink', 'activationUrl', 'activationLink'], 'verificationLink'),
      };
    case MAIL_TEMPLATE_KEYS.PASSWORD_RESET:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name'], 'firstName', 120),
        resetLink: requiredUrl(base, ['resetLink'], 'resetLink'),
        expiresAt: requiredDate(base, 'expiresAt', 'expiresAt'),
        isFirstTimeSetup: Boolean(base.isFirstTimeSetup),
      };
    case MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name'], 'firstName', 120),
        title: requiredText(base, ['activityTitle', 'title'], 'activityTitle', 180),
        body: requiredText(base, ['body'], 'body', 5000),
        subjectName: optionalText(base, ['subjectName'], 'your subject', 180),
        teacherName: optionalText(base, ['teacherName'], 'your teacher', 180),
        activityLink: optionalUrl(base, ['activityLink', 'link'], 'activityLink'),
      };
    case MAIL_TEMPLATE_KEYS.BULK_INVITATION:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name'], 'firstName', 120),
        inviteLink: requiredUrl(base, ['inviteLink', 'activationLink'], 'inviteLink'),
        role: optionalText(base, ['role'], '', 60),
        title: optionalText(base, ['title'], `${appName()} Invitation`, 180),
        body: optionalText(base, ['body'], 'You have been invited to ProjTrack.', 5000),
        unsubscribeUrl: optionalUrl(base, ['unsubscribeUrl'], 'unsubscribeUrl'),
      };
    case MAIL_TEMPLATE_KEYS.BROADCAST:
      return {
        ...base,
        firstName: optionalText(base, ['firstName', 'name'], 'there', 120),
        title: requiredText(base, ['title', 'subject'], 'title', 180),
        body: requiredText(base, ['body', 'message'], 'body', 10000),
        unsubscribeUrl: optionalUrl(base, ['unsubscribeUrl'], 'unsubscribeUrl'),
      };
    default:
      throw new BadRequestException(`Unknown mail template key: ${key}.`);
  }
}

function wrapCard(content: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto"><div style="padding:24px;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff"><div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#1d4ed8;margin-bottom:12px;text-transform:uppercase">${escapeHtml(appName())}</div>${content}</div></div>`;
}

function renderActionButton(href: string, label: string, tone = '#1d4ed8') {
  if (!href) return '';
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${tone};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export function renderMailTemplate(templateKey: string, payload: MailTemplatePayload): RenderedMailTemplate {
  const key = requireKnownTemplateKey(templateKey);
  const safePayload = validateMailTemplatePayload(key, payload);
  const name = asText(safePayload.firstName ?? safePayload.name, 'there');
  const subject = asText(safePayload.subject);
  const title = asText(safePayload.title, `${appName()} Notification`);
  const body = asText(safePayload.body, 'You have a new notification in ProjTrack.');
  const activationLink = asText(safePayload.activationUrl ?? safePayload.activationLink);
  const resetLink = asText(safePayload.resetLink);
  const activityLink = asText(safePayload.activityLink);
  const inviteLink = asText(safePayload.inviteLink);
  const unsubscribeUrl = asText(safePayload.unsubscribeUrl);
  const expiresAt = asText(safePayload.expiresAt);
  const isFirstTimeSetup = Boolean(safePayload.isFirstTimeSetup);
  const subjectName = asText(safePayload.subjectName, 'your subject');
  const teacherName = asText(safePayload.teacherName, 'your teacher');

  switch (key) {
    case MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION:
    case MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION: {
      const isVerification = key === MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION;
      const resolvedSubject = normalizeSubject(
        subject,
        isVerification ? `${appName()} Email Verification` : ACCOUNT_ACTIVATION_SUBJECT,
      );
      const actionLabel = isVerification ? 'Verify your email' : 'Activate your account';
      const text = [
        `Hello ${name},`,
        '',
        isVerification ? 'Please verify your email address to continue.' : 'Your account is ready for activation.',
        `${actionLabel}: ${activationLink}`,
      ].join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(isVerification ? 'Verify your email' : 'Activate your account')}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(isVerification ? 'Please verify your email address to continue.' : 'Your account is ready for activation.')}</p>`,
          renderActionButton(activationLink, isVerification ? 'Verify Email' : 'Activate Account'),
          `<p style="color:#475569">If the button does not work, use this link:</p><p><a href="${escapeHtml(activationLink)}">${escapeHtml(activationLink)}</a></p>`,
        ].join(''),
      );
      return {
        subject: isVerification ? resolvedSubject : ACCOUNT_ACTIVATION_SUBJECT,
        text,
        html,
      };
    }
    case MAIL_TEMPLATE_KEYS.PASSWORD_RESET: {
      const expiryNotice = `This link expires on ${expiresAt}.`;
      const resolvedSubject = normalizeSubject(subject, `${appName()} ${isFirstTimeSetup ? 'Set Up Your Password' : 'Password Reset'}`);
      const text = [
        `Hello ${name},`,
        '',
        isFirstTimeSetup ? 'Finish setting up your account by creating your password.' : 'We received a request to reset your password.',
        `${isFirstTimeSetup ? 'Create your password' : 'Reset your password'}: ${resetLink}`,
        '',
        expiryNotice,
        isFirstTimeSetup ? 'If you were not expecting this email, you can safely ignore it.' : 'If you did not request this, you can safely ignore this email.',
      ].join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(isFirstTimeSetup ? 'Set up your password' : 'Reset your password')}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(isFirstTimeSetup ? 'Finish setting up your ProjTrack account by creating your password.' : 'We received a request to reset your password for your ProjTrack account.')}</p>`,
          renderActionButton(resetLink, isFirstTimeSetup ? 'Create Password' : 'Reset Password', '#0f766e'),
          `<p style="color:#475569">If the button does not work, copy and paste this URL into your browser:</p><p><a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a></p>`,
          `<p style="color:#475569">${escapeHtml(expiryNotice)}</p>`,
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE: {
      const resolvedSubject = normalizeSubject(subject, `${subjectName} activity update`);
      const text = [
        `Hello ${name},`,
        '',
        `${teacherName} posted a new update in ${subjectName}.`,
        body,
        activityLink ? `Open the activity: ${activityLink}` : '',
      ].filter(Boolean).join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(body)}</p>`,
          renderActionButton(activityLink, 'Open Activity', '#0f766e'),
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.BULK_INVITATION: {
      const resolvedSubject = normalizeSubject(subject, `${appName()} Invitation`);
      const text = [
        `Hello ${name},`,
        '',
        body,
        `Open your invitation: ${inviteLink}`,
        unsubscribeUrl ? `Unsubscribe from future invite emails: ${unsubscribeUrl}` : '',
      ].filter(Boolean).join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(body)}</p>`,
          renderActionButton(inviteLink, 'View Invitation'),
          unsubscribeUrl ? `<p style="margin-top:24px;color:#64748b;font-size:12px">To stop receiving invitation emails, <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe here</a>.</p>` : '',
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.BROADCAST: {
      const resolvedSubject = normalizeSubject(subject || title, title);
      const text = [`Hello ${name},`, '', body, unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ''].filter(Boolean).join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(body)}</p>`,
          unsubscribeUrl ? `<p style="margin-top:24px;color:#64748b;font-size:12px"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>` : '',
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    default:
      throw new BadRequestException(`Unknown mail template key: ${key}.`);
  }
}
