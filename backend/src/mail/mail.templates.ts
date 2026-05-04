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

const TEMPLATE_ALLOWED_FIELDS: Record<string, string[]> = {
  [MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION]: ['firstName', 'name', 'activationUrl', 'activationLink', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION]: ['firstName', 'name', 'verificationLink', 'activationUrl', 'activationLink', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.PASSWORD_RESET]: ['firstName', 'name', 'resetLink', 'expiresAt', 'isFirstTimeSetup', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE]: ['firstName', 'name', 'activityTitle', 'title', 'body', 'subjectName', 'teacherName', 'activityLink', 'link', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.BULK_INVITATION]: ['firstName', 'name', 'inviteLink', 'activationLink', 'role', 'title', 'body', 'unsubscribeUrl', 'mailCategory', 'subject', 'teacherName', 'courseName', 'courseCode', 'term', 'startDate'],
  [MAIL_TEMPLATE_KEYS.BROADCAST]: ['firstName', 'name', 'title', 'subject', 'body', 'message', 'unsubscribeUrl', 'mailCategory'],
  [MAIL_TEMPLATE_KEYS.GRADE_SUBMITTED]: ['firstName', 'name', 'studentName', 'courseName', 'courseCode', 'grade', 'score', 'date', 'gradesUrl', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.RESTRICTION_LIFTED]: ['firstName', 'name', 'studentName', 'teacherName', 'reason', 'loginUrl', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.SUBMISSION_RECEIVED]: ['firstName', 'name', 'studentName', 'assignmentName', 'courseCode', 'section', 'assignedSystem', 'companyBrand', 'projectUrl', 'date', 'groupMembers', 'submissionsUrl', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.SUBMISSION_GRADED]: ['firstName', 'name', 'groupName', 'assignmentName', 'courseCode', 'section', 'assignedSystem', 'companyBrand', 'score', 'date', 'groupMembers', 'gradesUrl', 'mailCategory', 'subject'],
  [MAIL_TEMPLATE_KEYS.TEST_EMAIL]: ['firstName', 'name', 'recipientName', 'testId', 'timestamp', 'senderName', 'adminEmail', 'dashboardUrl', 'mailCategory', 'subject'],
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
    .replace(/'/g, '&#039;');
}

function asText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function truncate(value: string, max: number) {
  const normalized = asText(value);
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function normalizeSubject(value: unknown, fallback: string) {
  const preferred = asText(value);
  const subject = truncate((preferred || asText(fallback)).replace(/[\r\n]+/g, ' '), 160);
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
        body: optionalText(base, ['body'], 'You have been invited to join.', 5000),
        teacherName: optionalText(base, ['teacherName'], '', 120),
        courseName: optionalText(base, ['courseName'], '', 180),
        courseCode: optionalText(base, ['courseCode'], '', 60),
        term: optionalText(base, ['term'], '', 60),
        startDate: optionalText(base, ['startDate'], '', 60),
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
    case MAIL_TEMPLATE_KEYS.GRADE_SUBMITTED:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name', 'studentName'], 'firstName', 120),
        courseName: requiredText(base, ['courseName'], 'courseName', 180),
        courseCode: optionalText(base, ['courseCode'], '', 60),
        grade: optionalText(base, ['grade'], 'A', 10),
        score: optionalText(base, ['score'], '', 20),
        date: optionalText(base, ['date'], new Date().toLocaleDateString(), 60),
        gradesUrl: optionalUrl(base, ['gradesUrl'], 'gradesUrl'),
      };
    case MAIL_TEMPLATE_KEYS.RESTRICTION_LIFTED:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name', 'studentName'], 'firstName', 120),
        teacherName: optionalText(base, ['teacherName'], 'your instructor', 120),
        reason: optionalText(base, ['reason'], '', 500),
        loginUrl: optionalUrl(base, ['loginUrl'], 'loginUrl'),
      };
    case MAIL_TEMPLATE_KEYS.SUBMISSION_RECEIVED:
      return {
        ...base,
        firstName: requiredText(base, ['firstName', 'name', 'studentName'], 'firstName', 120),
        assignmentName: requiredText(base, ['assignmentName'], 'assignmentName', 180),
        courseCode: optionalText(base, ['courseCode'], '', 60),
        section: optionalText(base, ['section'], '', 60),
        assignedSystem: optionalText(base, ['assignedSystem'], '', 180),
        companyBrand: optionalText(base, ['companyBrand'], '', 120),
        projectUrl: optionalUrl(base, ['projectUrl'], 'projectUrl'),
        date: optionalText(base, ['date'], new Date().toLocaleDateString(), 60),
        groupMembers: optionalText(base, ['groupMembers'], '', 2000),
        submissionsUrl: optionalUrl(base, ['submissionsUrl'], 'submissionsUrl'),
      };
    case MAIL_TEMPLATE_KEYS.SUBMISSION_GRADED:
      return {
        ...base,
        firstName: optionalText(base, ['firstName', 'name', 'groupName'], 'there', 120),
        groupName: optionalText(base, ['groupName'], '', 120),
        assignmentName: requiredText(base, ['assignmentName'], 'assignmentName', 180),
        courseCode: optionalText(base, ['courseCode'], '', 60),
        section: optionalText(base, ['section'], '', 60),
        assignedSystem: optionalText(base, ['assignedSystem'], '', 180),
        companyBrand: optionalText(base, ['companyBrand'], '', 120),
        score: requiredText(base, ['score'], 'score', 20),
        date: optionalText(base, ['date'], new Date().toLocaleDateString(), 60),
        groupMembers: optionalText(base, ['groupMembers'], '', 2000),
        gradesUrl: optionalUrl(base, ['gradesUrl'], 'gradesUrl'),
      };
    case MAIL_TEMPLATE_KEYS.TEST_EMAIL:
      return {
        ...base,
        firstName: optionalText(base, ['firstName', 'name', 'recipientName'], 'there', 120),
        testId: optionalText(base, ['testId'], '', 60),
        timestamp: optionalText(base, ['timestamp'], new Date().toLocaleString(), 60),
        senderName: optionalText(base, ['senderName'], '', 120),
        adminEmail: optionalText(base, ['adminEmail'], '', 120),
        dashboardUrl: optionalUrl(base, ['dashboardUrl'], 'dashboardUrl'),
      };
    default:
      throw new BadRequestException(`Unknown mail template key: ${key}.`);
  }
}

// ─── HTML Builders ────────────────────────────────────────────────────────────

function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td>${body}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function header(gradient: string, title: string, subtitle: string): string {
  return `<div style="background:${gradient};padding:40px 32px;border-radius:16px 16px 0 0;text-align:center;">
<h2 style="color:#ffffff;font-size:24px;font-weight:600;margin:0 0 4px;">${escapeHtml(title)}</h2>
<p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">${escapeHtml(subtitle)}</p>
</div>`;
}

function bodyOpen(): string {
  return `<div style="background:#ffffff;border:1px solid #f3f4f6;border-top:none;padding:32px;">`;
}

function bodyClose(): string {
  return `</div>`;
}

function footer(note = ''): string {
  const app = escapeHtml(appName());
  const year = new Date().getFullYear();
  const noteHtml = note ? `<p style="color:#d1d5db;font-size:12px;margin:4px 0 0;">${escapeHtml(note)}</p>` : '';
  return `<div style="background:#f9fafb;border:1px solid #f3f4f6;border-top:none;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;">
<p style="color:#9ca3af;font-size:12px;margin:0;">© ${year} ${app} &middot; All rights reserved</p>
${noteHtml}
</div>`;
}

function ctaButton(href: string, label: string, color: string): string {
  if (!href) return '';
  return `<div style="text-align:center;margin:24px 0;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:12px;">${escapeHtml(label)}</a>
</div>`;
}

function greeting(name: string): string {
  return `<p style="color:#4b5563;font-size:14px;margin:0 0 16px;">Hi <strong style="color:#111827;">${escapeHtml(name)}</strong>,</p>`;
}

function paragraph(text: string): string {
  return `<p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px;">${escapeHtml(text)}</p>`;
}

function card(bg: string, border: string, content: string): string {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px;margin-bottom:24px;">${content}</div>`;
}

function fallbackLinkBlock(href: string): string {
  return `<p style="color:#6b7280;font-size:13px;margin:0 0 8px;">If the button does not work, use this link:</p>
<p style="margin:0;"><a href="${escapeHtml(href)}" style="color:#4f46e5;font-size:12px;word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

function divider(): string {
  return `<div style="border-top:1px solid #f3f4f6;margin:16px 0;"></div>`;
}

function infoRow(label: string, value: string, isLink = false): string {
  const valueHtml = isLink
    ? `<a href="${escapeHtml(value)}" style="color:#0d9488;font-size:12px;font-weight:600;word-break:break-all;">${escapeHtml(value)}</a>`
    : `<span style="color:#1f2937;font-size:12px;font-weight:600;text-align:right;">${escapeHtml(value)}</span>`;
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
<span style="color:#9ca3af;font-size:12px;min-width:110px;">${escapeHtml(label)}</span>
${valueHtml}
</div>`;
}

// ─── Template Renderers ────────────────────────────────────────────────────────

function renderActivation(name: string, link: string, isVerification: boolean): RenderedMailTemplate {
  const title = isVerification ? 'Verify Your Email' : 'Activate Your Account';
  const subtitle = isVerification ? 'Confirm your email address to continue' : 'Your account is ready — click below to get started';
  const btnLabel = isVerification ? 'Verify Email' : 'Activate Account';
  const subject = isVerification ? `${appName()} Email Verification` : ACCOUNT_ACTIVATION_SUBJECT;

  const html = emailShell(title, [
    header('linear-gradient(135deg, #4f46e5, #3b82f6)', title, subtitle),
    bodyOpen(),
    greeting(name),
    paragraph(isVerification
      ? 'Please verify your email address to complete your account setup. Click the button below to confirm.'
      : 'Your account is ready for activation. Click the button below to set your password and get started.'),
    ctaButton(link, btnLabel, '#4f46e5'),
    `<div style="background:#f9fafb;border-radius:10px;padding:16px;margin-top:8px;">`,
    fallbackLinkBlock(link),
    `</div>`,
    bodyClose(),
    footer('You received this because an account was created for your email.'),
  ].join(''));

  const text = [`Hello ${name},`, '', isVerification ? 'Please verify your email address:' : 'Your account is ready for activation.', `${btnLabel}: ${link}`].join('\n');
  return { subject, html, text };
}

function renderPasswordReset(name: string, resetLink: string, expiresAt: string, isFirstTimeSetup: boolean): RenderedMailTemplate {
  const title = isFirstTimeSetup ? 'Set Up Your Password' : 'Reset Your Password';
  const subtitle = isFirstTimeSetup ? 'Create your password to complete setup' : 'Follow the link below to set a new password';
  const btnLabel = isFirstTimeSetup ? 'Create Password' : 'Reset My Password';
  const subject = `${appName()} ${isFirstTimeSetup ? 'Set Up Your Password' : 'Password Reset'}`;

  const expiryDate = new Date(expiresAt);
  const expiryText = Number.isNaN(expiryDate.getTime()) ? expiresAt : expiryDate.toLocaleString();

  const html = emailShell(title, [
    header('linear-gradient(to right, #8b5cf6, #9333ea)', title, subtitle),
    bodyOpen(),
    greeting(name),
    paragraph(isFirstTimeSetup
      ? `Finish setting up your ${appName()} account by creating your password. This link expires on ${expiryText}.`
      : `We received a request to reset the password for your ${appName()} account. If you didn't request this, you can safely ignore this email.`),
    ctaButton(resetLink, btnLabel, '#8b5cf6'),
    `<p style="color:#9ca3af;font-size:12px;text-align:center;margin:-16px 0 20px;">This link expires on <strong>${escapeHtml(expiryText)}</strong></p>`,
    card('#f9fafb', '#e5e7eb', [
      `<p style="color:#6b7280;font-size:12px;margin:0 0 8px;">Or copy and paste this URL into your browser:</p>`,
      `<p style="margin:0;"><a href="${escapeHtml(resetLink)}" style="color:#8b5cf6;font-size:12px;font-family:monospace;word-break:break-all;">${escapeHtml(resetLink)}</a></p>`,
    ].join('')),
    card('#fef2f2', '#fecaca', `<p style="color:#b91c1c;font-size:12px;margin:0;"><strong>Security tip:</strong> ${escapeHtml(appName())} will never ask for your password via email. If you didn't request a reset, please contact support immediately.</p>`),
    bodyClose(),
    footer('This request was made to your account. If you did not request this, ignore this email.'),
  ].join(''));

  const text = [`Hello ${name},`, '', isFirstTimeSetup ? 'Create your password:' : 'Reset your password:', `${btnLabel}: ${resetLink}`, '', `This link expires on ${expiryText}.`].join('\n');
  return { subject, html, text };
}

function renderBulkInvitation(p: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(p.firstName, 'there');
  const inviteLink = asText(p.inviteLink);
  const teacherName = asText(p.teacherName);
  const courseName = asText(p.courseName);
  const courseCode = asText(p.courseCode);
  const term = asText(p.term);
  const startDate = asText(p.startDate);
  const customBody = asText(p.body);
  const unsubscribeUrl = asText(p.unsubscribeUrl);
  const subject = normalizeSubject(p.subject, `${appName()} Invitation`);

  const courseCard = (courseName || courseCode) ? card('#fffbeb', '#fde68a', [
    `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">`,
    `<div style="background:#fef3c7;border-radius:10px;padding:10px;display:inline-block;">`,
    `<span style="font-size:20px;">&#128218;</span>`,
    `</div>`,
    `<div>`,
    courseName ? `<p style="color:#1f2937;font-size:14px;font-weight:600;margin:0;">${escapeHtml(courseName)}</p>` : '',
    courseCode ? `<p style="color:#9ca3af;font-size:12px;margin:0;">${escapeHtml(courseCode)}${term ? ' &middot; ' + escapeHtml(term) : ''}</p>` : '',
    `</div></div>`,
    divider(),
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">`,
    teacherName ? `<div><p style="color:#9ca3af;font-size:11px;margin:0 0 2px;">Instructor</p><p style="color:#1f2937;font-size:13px;font-weight:500;margin:0;">${escapeHtml(teacherName)}</p></div>` : '',
    startDate ? `<div><p style="color:#9ca3af;font-size:11px;margin:0 0 2px;">Start Date</p><p style="color:#1f2937;font-size:13px;font-weight:500;margin:0;">${escapeHtml(startDate)}</p></div>` : '',
    `</div>`,
  ].join('')) : '';

  const bodyText = customBody || (teacherName && courseName
    ? `${teacherName} has invited you to join ${courseName} on ${appName()}.`
    : `You have been invited to join ${appName()}.`);

  const html = emailShell(subject, [
    header('linear-gradient(to right, #fbbf24, #f97316)', "You're Invited! &#127881;", `Join your class on ${appName()}`),
    bodyOpen(),
    greeting(name),
    paragraph(bodyText),
    courseCard,
    ctaButton(inviteLink, 'Accept Invitation', '#f59e0b'),
    `<p style="color:#9ca3af;font-size:12px;text-align:center;margin:-16px 0 8px;">Invitation expires in <strong>7 days</strong></p>`,
    unsubscribeUrl ? `<p style="color:#d1d5db;font-size:12px;text-align:center;margin-top:16px;">To stop receiving invitation emails, <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;">unsubscribe here</a>.</p>` : '',
    bodyClose(),
    footer(`Sent via ${appName()}`),
  ].join(''));

  const text = [`Hello ${name},`, '', bodyText, `Accept Invitation: ${inviteLink}`, unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderTeacherActivity(name: string, title: string, body: string, subjectName: string, teacherName: string, activityLink: string): RenderedMailTemplate {
  const subject = normalizeSubject('', `${subjectName} activity update`);
  const html = emailShell(title, [
    header('linear-gradient(to right, #0f766e, #0891b2)', title, `New update in ${subjectName}`),
    bodyOpen(),
    greeting(name),
    paragraph(`${teacherName} posted a new update in ${subjectName}.`),
    card('#f0fdfa', '#99f6e4', `<p style="color:#134e4a;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(body)}</p>`),
    activityLink ? ctaButton(activityLink, 'Open Activity', '#0f766e') : '',
    bodyClose(),
    footer('This is an automated notification from your instructor.'),
  ].join(''));
  const text = [`Hello ${name},`, '', `${teacherName} posted a new update in ${subjectName}.`, body, activityLink ? `Open the activity: ${activityLink}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderBroadcast(name: string, title: string, body: string, unsubscribeUrl: string): RenderedMailTemplate {
  const subject = normalizeSubject(title, title);
  const html = emailShell(title, [
    header('linear-gradient(135deg, #6366f1, #8b5cf6)', title, appName()),
    bodyOpen(),
    greeting(name),
    card('#f5f3ff', '#ddd6fe', `<p style="color:#3730a3;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(body)}</p>`),
    unsubscribeUrl ? `<p style="color:#d1d5db;font-size:12px;text-align:center;margin-top:16px;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;">Unsubscribe</a></p>` : '',
    bodyClose(),
    footer(),
  ].join(''));
  const text = [`Hello ${name},`, '', body, unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderGradeSubmitted(p: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(p.firstName, 'there');
  const courseName = asText(p.courseName);
  const courseCode = asText(p.courseCode);
  const grade = asText(p.grade, 'A');
  const score = asText(p.score);
  const date = asText(p.date);
  const gradesUrl = asText(p.gradesUrl);
  const subject = normalizeSubject(p.subject, `Your Grade Has Been Submitted – ${courseName}`);

  const html = emailShell(subject, [
    header('linear-gradient(to right, #10b981, #0d9488)', 'Grade Submitted!', 'Your grade has been officially recorded'),
    bodyOpen(),
    greeting(name),
    paragraph(`We're writing to let you know that your grade for ${courseName} has been officially submitted by your instructor.`),
    card('#ecfdf5', '#a7f3d0', [
      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #a7f3d0;">`,
      `<div style="display:flex;align-items:center;gap:10px;">`,
      `<div style="background:#d1fae5;border-radius:8px;padding:8px;"><span style="font-size:16px;">&#128218;</span></div>`,
      `<div><p style="color:#1f2937;font-size:13px;font-weight:600;margin:0;">${escapeHtml(courseName)}</p>${courseCode ? `<p style="color:#9ca3af;font-size:11px;margin:0;">${escapeHtml(courseCode)}</p>` : ''}</div>`,
      `</div>`,
      `<div style="background:#10b981;border-radius:10px;padding:8px 14px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">${escapeHtml(grade)}</span></div>`,
      `</div>`,
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`,
      score ? `<div><p style="color:#9ca3af;font-size:11px;margin:0 0 2px;">Score</p><p style="color:#1f2937;font-size:13px;font-weight:600;margin:0;">${escapeHtml(score)}</p></div>` : '',
      date ? `<div><p style="color:#9ca3af;font-size:11px;margin:0 0 2px;">Submitted</p><p style="color:#1f2937;font-size:13px;font-weight:600;margin:0;">${escapeHtml(date)}</p></div>` : '',
      `</div>`,
    ].join('')),
    paragraph('If you have any questions about your grade, please contact your instructor during office hours or reply to this email.'),
    gradesUrl ? ctaButton(gradesUrl, 'View Your Grades', '#10b981') : '',
    bodyClose(),
    footer("You received this email because you're enrolled in a course."),
  ].join(''));

  const text = [`Hello ${name},`, '', `Your grade for ${courseName} has been officially submitted.`, score ? `Score: ${score}` : '', grade ? `Grade: ${grade}` : '', date ? `Submitted: ${date}` : '', gradesUrl ? `View your grades: ${gradesUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderRestrictionLifted(p: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(p.firstName, 'there');
  const teacherName = asText(p.teacherName, 'your instructor');
  const reason = asText(p.reason);
  const loginUrl = asText(p.loginUrl);
  const subject = normalizeSubject(p.subject, 'Account Restriction Removed');

  const restoredItems = ['Full access to course materials', 'Ability to submit assignments', 'Access to grades and feedback', 'Course communication features'];

  const html = emailShell(subject, [
    header('linear-gradient(to right, #3b82f6, #4f46e5)', 'Access Restored!', 'Your account restriction has been lifted'),
    bodyOpen(),
    greeting(name),
    paragraph(`Great news! The restriction that was previously applied to your account has been removed by ${teacherName}. You now have full access to your account.`),
    card('#eff6ff', '#bfdbfe', [
      `<div style="display:flex;align-items:flex-start;gap:12px;">`,
      `<div style="background:#dbeafe;border-radius:8px;padding:8px;flex-shrink:0;"><span style="font-size:16px;">&#128737;</span></div>`,
      `<div>`,
      `<p style="color:#1f2937;font-size:13px;font-weight:600;margin:0 0 8px;">What's been restored:</p>`,
      `<ul style="margin:0;padding:0;list-style:none;">`,
      restoredItems.map(item => `<li style="color:#4b5563;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:6px;"><span style="color:#3b82f6;font-size:12px;">&#10003;</span>${escapeHtml(item)}</li>`).join(''),
      `</ul></div></div>`,
    ].join('')),
    reason ? card('#fffbeb', '#fde68a', `<p style="color:#92400e;font-size:12px;margin:0;"><strong>Note:</strong> Reason for restriction removal: <em>${escapeHtml(reason)}</em></p>`) : '',
    loginUrl ? ctaButton(loginUrl, 'Log In to Your Account', '#3b82f6') : '',
    bodyClose(),
    footer('Questions? Contact your instructor or school admin.'),
  ].join(''));

  const text = [`Hello ${name},`, '', `Great news! The restriction on your account has been removed by ${teacherName}.`, reason ? `Reason: ${reason}` : '', loginUrl ? `Log in: ${loginUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderSubmissionReceived(p: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(p.firstName, 'there');
  const assignmentName = asText(p.assignmentName);
  const courseCode = asText(p.courseCode);
  const section = asText(p.section);
  const assignedSystem = asText(p.assignedSystem);
  const companyBrand = asText(p.companyBrand);
  const projectUrl = asText(p.projectUrl);
  const date = asText(p.date, new Date().toLocaleDateString());
  const groupMembers = asText(p.groupMembers).split(',').map(m => m.trim()).filter(Boolean);
  const submissionsUrl = asText(p.submissionsUrl);
  const subject = normalizeSubject(p.subject, `Submission Received – ${assignmentName}`);

  const html = emailShell(subject, [
    header('linear-gradient(to right, #14b8a6, #0891b2)', 'Submission Received!', 'Your project has been successfully submitted'),
    bodyOpen(),
    greeting(name),
    paragraph(`We're writing to let you know that your submission for ${assignmentName} has been officially received by your instructor.`),
    card('#f0fdfa', '#99f6e4', [
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #99f6e4;">`,
      `<div style="background:#ccfbf1;border-radius:8px;padding:8px;"><span style="font-size:16px;">&#128196;</span></div>`,
      `<div style="flex:1;"><p style="color:#1f2937;font-size:13px;font-weight:600;margin:0;">${escapeHtml(assignmentName)}</p>${courseCode ? `<p style="color:#9ca3af;font-size:11px;margin:0;">${escapeHtml(courseCode)}</p>` : ''}</div>`,
      `<span style="color:#10b981;font-size:20px;">&#10003;</span>`,
      `</div>`,
      section ? infoRow('Section', section) : '',
      assignedSystem ? infoRow('Assigned System', assignedSystem) : '',
      companyBrand ? infoRow('Company / Brand', companyBrand) : '',
      projectUrl ? infoRow('Project URL', projectUrl, true) : '',
      infoRow('Date Received', date),
      groupMembers.length ? [
        divider(),
        `<p style="color:#6b7280;font-size:12px;font-weight:500;margin:0 0 8px;">Group Members</p>`,
        `<ul style="margin:0;padding:0;list-style:none;">`,
        groupMembers.map((m, i) => `<li style="color:#374151;font-size:12px;margin-bottom:4px;display:flex;align-items:center;gap:6px;"><span style="background:#ccfbf1;color:#0f766e;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 1}</span>${escapeHtml(m)}</li>`).join(''),
        `</ul>`,
      ].join('') : '',
    ].join('')),
    paragraph('If you have any questions about your submission, please contact your instructor during office hours or reply to this email.'),
    submissionsUrl ? ctaButton(submissionsUrl, 'View Your Submissions', '#14b8a6') : '',
    bodyClose(),
    footer('This is an automated notification from your instructor.'),
  ].join(''));

  const text = [`Hello ${name},`, '', `Your submission for ${assignmentName} has been received.`, section ? `Section: ${section}` : '', assignedSystem ? `System: ${assignedSystem}` : '', date ? `Date: ${date}` : '', groupMembers.length ? `Group: ${groupMembers.join(', ')}` : '', submissionsUrl ? `View submissions: ${submissionsUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderSubmissionGraded(p: MailTemplatePayload): RenderedMailTemplate {
  const groupName = asText(p.groupName);
  const name = groupName || asText(p.firstName, 'there');
  const assignmentName = asText(p.assignmentName);
  const courseCode = asText(p.courseCode);
  const section = asText(p.section);
  const assignedSystem = asText(p.assignedSystem);
  const companyBrand = asText(p.companyBrand);
  const score = asText(p.score);
  const date = asText(p.date, new Date().toLocaleDateString());
  const groupMembers = asText(p.groupMembers).split(',').map(m => m.trim()).filter(Boolean);
  const gradesUrl = asText(p.gradesUrl);
  const subject = normalizeSubject(p.subject, `Your Submission Has Been Graded – ${assignmentName}`);

  const html = emailShell(subject, [
    header('linear-gradient(to right, #f43f5e, #db2777)', 'Your Project Has Been Graded!', 'Your instructor has submitted a grade for your project'),
    bodyOpen(),
    groupName ? `<p style="color:#4b5563;font-size:14px;margin:0 0 8px;">Hi <strong style="color:#111827;">${escapeHtml(groupName)}</strong></p>` : greeting(name),
    groupMembers.length ? [
      `<ul style="margin:0 0 16px;padding:0;list-style:none;">`,
      groupMembers.map((m, i) => `<li style="color:#374151;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:8px;"><span style="background:#ffe4e6;color:#be123c;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 1}</span>${escapeHtml(m)}</li>`).join(''),
      `</ul>`,
    ].join('') : '',
    paragraph(`We're writing to let you know that your submission for ${assignmentName} has been officially graded by your instructor.`),
    card('#fff1f2', '#fecdd3', [
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #fecdd3;">`,
      `<div style="background:#ffe4e6;border-radius:8px;padding:8px;"><span style="font-size:16px;">&#128218;</span></div>`,
      `<div><p style="color:#1f2937;font-size:13px;font-weight:600;margin:0;">${escapeHtml(assignmentName)}</p>${courseCode ? `<p style="color:#9ca3af;font-size:11px;margin:0;">${escapeHtml(courseCode)}</p>` : ''}</div>`,
      `</div>`,
      section ? infoRow('Section', section) : '',
      assignedSystem ? infoRow('Assigned System', assignedSystem) : '',
      companyBrand ? infoRow('Company / Brand', companyBrand) : '',
      infoRow('Date Graded', date),
      divider(),
      `<div style="background:#ffffff;border:1px solid #fecdd3;border-radius:12px;padding:20px;text-align:center;">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Final Grade</p>`,
      `<p style="color:#f43f5e;font-size:48px;font-weight:700;margin:0;line-height:1;">${escapeHtml(score)}</p>`,
      `<p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">out of 100</p>`,
      `</div>`,
    ].join('')),
    paragraph('If you have any questions about your grade, please contact your instructor during office hours or reply to this email.'),
    gradesUrl ? ctaButton(gradesUrl, 'View Your Grades', '#f43f5e') : '',
    bodyClose(),
    footer('This is an automated notification from your instructor.'),
  ].join(''));

  const text = [`Hello ${name},`, '', `Your submission for ${assignmentName} has been graded.`, score ? `Score: ${score}` : '', date ? `Date: ${date}` : '', gradesUrl ? `View grades: ${gradesUrl}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

function renderTestEmail(p: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(p.firstName, 'there');
  const testId = asText(p.testId);
  const timestamp = asText(p.timestamp);
  const senderName = asText(p.senderName);
  const adminEmail = asText(p.adminEmail);
  const dashboardUrl = asText(p.dashboardUrl);
  const subject = normalizeSubject(p.subject, `Test Email – ${appName()} System Check`);

  const html = emailShell(subject, [
    header('linear-gradient(to right, #a855f7, #4f46e5)', 'Test Email', `${appName()} System Check`),
    bodyOpen(),
    greeting(name),
    paragraph(`This is a test email from the ${appName()} platform. If you're receiving this message, it means your email notifications are configured correctly and working as expected.`),
    card('#faf5ff', '#e9d5ff', [
      `<div style="display:flex;align-items:flex-start;gap:12px;">`,
      `<div style="background:#f3e8ff;border-radius:8px;padding:8px;flex-shrink:0;"><span style="font-size:16px;">&#10003;</span></div>`,
      `<div style="flex:1;">`,
      `<p style="color:#1f2937;font-size:13px;font-weight:600;margin:0 0 12px;">Test Details</p>`,
      testId ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#9ca3af;font-size:12px;">Test ID</span><span style="color:#1f2937;font-size:12px;font-family:monospace;">${escapeHtml(testId)}</span></div>` : '',
      timestamp ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#9ca3af;font-size:12px;">Sent At</span><span style="color:#1f2937;font-size:12px;">${escapeHtml(timestamp)}</span></div>` : '',
      senderName ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#9ca3af;font-size:12px;">Sent By</span><span style="color:#1f2937;font-size:12px;">${escapeHtml(senderName)}</span></div>` : '',
      `</div></div>`,
    ].join('')),
    card('#f0fdf4', '#bbf7d0', `<p style="color:#166534;font-size:12px;margin:0;"><strong>&#10003; Success:</strong> Your email system is functioning properly. No action is required.</p>`),
    adminEmail ? paragraph(`If you did not expect to receive this test email, please contact your system administrator at <strong style="color:#7c3aed;">${escapeHtml(adminEmail)}</strong>.`) : '',
    dashboardUrl ? ctaButton(dashboardUrl, 'Back to Dashboard', '#a855f7') : '',
    bodyClose(),
    footer('This is an automated test email from the system.'),
  ].join(''));

  const text = [`Hello ${name},`, '', `This is a test email from ${appName()}.`, testId ? `Test ID: ${testId}` : '', timestamp ? `Sent At: ${timestamp}` : '', senderName ? `Sent By: ${senderName}` : '', adminEmail ? `Admin: ${adminEmail}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function renderMailTemplate(templateKey: string, payload: MailTemplatePayload): RenderedMailTemplate {
  const key = requireKnownTemplateKey(templateKey);
  const safePayload = validateMailTemplatePayload(key, payload);

  switch (key) {
    case MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION:
      return renderActivation(asText(safePayload.firstName, 'there'), asText(safePayload.activationUrl), false);

    case MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION:
      return renderActivation(asText(safePayload.firstName, 'there'), asText(safePayload.activationUrl), true);

    case MAIL_TEMPLATE_KEYS.PASSWORD_RESET:
      return renderPasswordReset(
        asText(safePayload.firstName, 'there'),
        asText(safePayload.resetLink),
        asText(safePayload.expiresAt),
        Boolean(safePayload.isFirstTimeSetup),
      );

    case MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE:
      return renderTeacherActivity(
        asText(safePayload.firstName, 'there'),
        asText(safePayload.title),
        asText(safePayload.body),
        asText(safePayload.subjectName, 'your subject'),
        asText(safePayload.teacherName, 'your teacher'),
        asText(safePayload.activityLink),
      );

    case MAIL_TEMPLATE_KEYS.BULK_INVITATION:
      return renderBulkInvitation(safePayload);

    case MAIL_TEMPLATE_KEYS.BROADCAST:
      return renderBroadcast(
        asText(safePayload.firstName, 'there'),
        asText(safePayload.title),
        asText(safePayload.body),
        asText(safePayload.unsubscribeUrl),
      );

    case MAIL_TEMPLATE_KEYS.GRADE_SUBMITTED:
      return renderGradeSubmitted(safePayload);

    case MAIL_TEMPLATE_KEYS.RESTRICTION_LIFTED:
      return renderRestrictionLifted(safePayload);

    case MAIL_TEMPLATE_KEYS.SUBMISSION_RECEIVED:
      return renderSubmissionReceived(safePayload);

    case MAIL_TEMPLATE_KEYS.SUBMISSION_GRADED:
      return renderSubmissionGraded(safePayload);

    case MAIL_TEMPLATE_KEYS.TEST_EMAIL:
      return renderTestEmail(safePayload);

    default:
      throw new BadRequestException(`Unknown mail template key: ${key}.`);
  }
}
