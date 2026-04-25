import { MAIL_TEMPLATE_KEYS } from '../common/constants/mail.constants';

export type MailTemplateKey =
  (typeof MAIL_TEMPLATE_KEYS)[keyof typeof MAIL_TEMPLATE_KEYS];

export type MailTemplatePayload = Record<string, unknown>;

export type RenderedMailTemplate = {
  subject: string;
  html: string;
  text: string;
};

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

function appName() {
  return asText(process.env.MAIL_FROM_NAME, 'ProjTrack');
}

function wrapCard(content: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto"><div style="padding:24px;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff"><div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#1d4ed8;margin-bottom:12px;text-transform:uppercase">${escapeHtml(appName())}</div>${content}</div></div>`;
}

function renderActionButton(href: string, label: string, tone = '#1d4ed8') {
  if (!href) return '';
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${tone};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export function renderMailTemplate(templateKey: string, payload: MailTemplatePayload): RenderedMailTemplate {
  const name = asText(payload.firstName ?? payload.name, 'there');
  const subject = asText(payload.subject);
  const title = asText(payload.title, `${appName()} Notification`);
  const body = asText(payload.body, 'You have a new notification in ProjTrack.');
  const activationLink = asText(payload.activationLink);
  const resetLink = asText(payload.resetLink);
  const activityLink = asText(payload.activityLink);
  const inviteLink = asText(payload.inviteLink);
  const unsubscribeUrl = asText(payload.unsubscribeUrl);
  const expiresAt = asText(payload.expiresAt);
  const isFirstTimeSetup = String(payload.isFirstTimeSetup ?? '').trim().toLowerCase() === 'true';
  const subjectName = asText(payload.subjectName, 'your subject');
  const teacherName = asText(payload.teacherName, 'your teacher');

  switch (templateKey as MailTemplateKey) {
    case MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION:
    case MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION: {
      const isVerification = templateKey === MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION;
      const resolvedSubject =
        subject || `${appName()} ${isVerification ? 'Email Verification' : 'Account Activation'}`;
      const text = [
        `Hello ${name},`,
        '',
        isVerification
          ? 'Please verify your email address to continue.'
          : 'Your account is ready for activation.',
        activationLink
          ? `${isVerification ? 'Verify your email' : 'Activate your account'}: ${activationLink}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(
            isVerification ? 'Verify your email' : 'Activate your account',
          )}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(
            isVerification
              ? 'Please verify your email address to continue.'
              : 'Your account is ready for activation.',
          )}</p>`,
          renderActionButton(
            activationLink,
            isVerification ? 'Verify Email' : 'Activate Account',
          ),
          activationLink
            ? `<p style="color:#475569">If the button does not work, use this link:</p><p><a href="${escapeHtml(activationLink)}">${escapeHtml(activationLink)}</a></p>`
            : '',
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.PASSWORD_RESET: {
      const expiryNotice = expiresAt
        ? `This link expires on ${new Date(expiresAt).toLocaleString()}.`
        : 'This link expires soon.';
      const resolvedSubject =
        subject || `${appName()} ${isFirstTimeSetup ? 'Set Up Your Password' : 'Password Reset'}`;
      const text = [
        `Hello ${name},`,
        '',
        isFirstTimeSetup
          ? 'Finish setting up your account by creating your password.'
          : 'We received a request to reset your password.',
        resetLink
          ? `${isFirstTimeSetup ? 'Create your password' : 'Reset your password'}: ${resetLink}`
          : '',
        '',
        expiryNotice,
        isFirstTimeSetup
          ? 'If you were not expecting this email, you can safely ignore it.'
          : 'If you did not request this, you can safely ignore this email.',
      ].join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(
            isFirstTimeSetup ? 'Set up your password' : 'Reset your password',
          )}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(
            isFirstTimeSetup
              ? 'Finish setting up your ProjTrack account by creating your password.'
              : 'We received a request to reset your password for your ProjTrack account.',
          )}</p>`,
          renderActionButton(
            resetLink,
            isFirstTimeSetup ? 'Create Password' : 'Reset Password',
            '#0f766e',
          ),
          resetLink
            ? `<p style="color:#475569">If the button does not work, copy and paste this URL into your browser:</p><p><a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a></p>`
            : '',
          `<p style="color:#475569">${escapeHtml(expiryNotice)}</p>`,
          `<p style="color:#475569">${escapeHtml(
            isFirstTimeSetup
              ? 'If you were not expecting this email, you can safely ignore it.'
              : 'If you did not request this reset, you can safely ignore this email.',
          )}</p>`,
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE: {
      const resolvedSubject = subject || `${subjectName} activity update`;
      const text = [
        `Hello ${name},`,
        '',
        teacherName
          ? `${teacherName} posted a new update in ${subjectName}.`
          : `There is a new activity update in ${subjectName}.`,
        body,
        activityLink ? `Open the activity: ${activityLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');
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
      const resolvedSubject = subject || `${appName()} Invitation`;
      const text = [
        `Hello ${name},`,
        '',
        body || 'You have been invited to ProjTrack.',
        inviteLink ? `Open your invitation: ${inviteLink}` : '',
        unsubscribeUrl ? `Unsubscribe from future invite emails: ${unsubscribeUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const html = wrapCard(
        [
          `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>`,
          `<p>Hello ${escapeHtml(name)},</p>`,
          `<p>${escapeHtml(body || 'You have been invited to ProjTrack.')}</p>`,
          renderActionButton(inviteLink, 'View Invitation'),
          unsubscribeUrl
            ? `<p style="margin-top:24px;color:#64748b;font-size:12px">To stop receiving invitation emails, <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe here</a>.</p>`
            : '',
        ].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
    case MAIL_TEMPLATE_KEYS.BROADCAST:
    default: {
      const resolvedSubject = subject || title;
      const text = [`Hello ${name},`, '', body].join('\n');
      const html = wrapCard(
        [`<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>`, `<p>Hello ${escapeHtml(name)},</p>`, `<p>${escapeHtml(body)}</p>`].join(''),
      );
      return { subject: resolvedSubject, text, html };
    }
  }
}
