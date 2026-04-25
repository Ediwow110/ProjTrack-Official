export const MAIL_PROVIDER_NAMES = {
  STUB: 'stub',
  RESEND: 'resend',
  SENDER: 'sender',
  MAILRELAY: 'mailrelay',
  SMTP: 'smtp',
} as const;

export type MailProviderName =
  (typeof MAIL_PROVIDER_NAMES)[keyof typeof MAIL_PROVIDER_NAMES];

export const MAIL_TEMPLATE_KEYS = {
  ACCOUNT_ACTIVATION: 'account-activation',
  PASSWORD_RESET: 'password-reset',
  EMAIL_VERIFICATION: 'email-verification',
  TEACHER_ACTIVITY_NOTICE: 'teacher-activity-notice',
  BULK_INVITATION: 'bulk-invitation',
  BROADCAST: 'broadcast',
} as const;

export const MAIL_CATEGORY_KEYS = {
  AUTH: 'auth',
  INVITE: 'invite',
  NOTIFICATION: 'notification',
  SUPPORT: 'support',
  ADMIN: 'admin',
} as const;

export type MailCategoryKey =
  (typeof MAIL_CATEGORY_KEYS)[keyof typeof MAIL_CATEGORY_KEYS];

export const MAIL_FAILURE_REASONS = {
  MAILRELAY_MONTHLY_LIMIT_REACHED: 'MAILRELAY_MONTHLY_LIMIT_REACHED',
  MAILRELAY_DAILY_SAFETY_LIMIT_REACHED: 'MAILRELAY_DAILY_SAFETY_LIMIT_REACHED',
  MAILRELAY_RATE_LIMIT_REACHED: 'MAILRELAY_RATE_LIMIT_REACHED',
  MAILRELAY_API_ERROR: 'MAILRELAY_API_ERROR',
  SENDER_MONTHLY_LIMIT_REACHED: 'SENDER_MONTHLY_LIMIT_REACHED',
  SENDER_DAILY_SAFETY_LIMIT_REACHED: 'SENDER_DAILY_SAFETY_LIMIT_REACHED',
  SENDER_RATE_LIMIT_REACHED: 'SENDER_RATE_LIMIT_REACHED',
  SENDER_API_ERROR: 'SENDER_API_ERROR',
} as const;

export const MAIL_TAGS = {
  TEMPLATE: 'template',
  TRANSACTIONAL: 'transactional',
  BULK: 'bulk',
  AUTH: 'auth',
} as const;

export const MAIL_WEBHOOK_EVENT_TYPES = {
  DELIVERED: 'email.delivered',
  BOUNCED: 'email.bounced',
  COMPLAINED: 'email.complained',
  DELIVERY_DELAYED: 'email.delivery_delayed',
  OPENED: 'email.opened',
  CLICKED: 'email.clicked',
} as const;

export const MAIL_SUPPRESSION_REASONS = {
  BOUNCED: 'Provider reported a bounced email.',
  COMPLAINED: 'Provider reported a spam complaint.',
  UNSUBSCRIBED: 'Recipient unsubscribed from bulk email.',
} as const;
