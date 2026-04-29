export type EmailType =
  | 'activation'
  | 'password_reset'
  | 'invitation'
  | 'notification'
  | string;

const TESTMAIL_DOMAIN = '@inbox.testmail.app';
const ALLOWED_PRODUCTION_PROVIDERS = new Set(['mailrelay']);
const FORBIDDEN_PRODUCTION_VARS = [
  'TESTMAIL_API_KEY',
  'TEST_EMAIL_ACTIVATION',
  'TEST_EMAIL_PASSWORD_RESET',
  'TEST_EMAIL_INVITE',
  'TEST_EMAIL_NOTIFICATION',
] as const;

function envValue(env: NodeJS.ProcessEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = String(env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizedBoolean(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

export function isProductionEmailEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production' ||
    String(env.APP_ENV ?? '').trim().toLowerCase() === 'production'
  );
}

export function isTestmailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes|on)$/i.test(String(env.TESTMAIL_ENABLED ?? '').trim());
}

export function isTestmailAddress(email: string): boolean {
  return normalizeEmail(email).endsWith(TESTMAIL_DOMAIN);
}

export function assertCanSendToRecipient(
  recipientEmail: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (isProductionEmailEnvironment(env) && isTestmailAddress(recipientEmail)) {
    throw new Error('Blocked testmail recipient in production');
  }
}

export function getProductionEmailConfigErrors(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (!isProductionEmailEnvironment(env)) {
    return [];
  }

  const errors: string[] = [];
  const provider = String(env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  const testmailEnabled = normalizedBoolean(env.TESTMAIL_ENABLED);

  if (testmailEnabled !== 'false') {
    errors.push('TESTMAIL_ENABLED must be false in production');
  }

  if (!ALLOWED_PRODUCTION_PROVIDERS.has(provider)) {
    errors.push('Production MAIL_PROVIDER must be mailrelay');
  }

  for (const key of FORBIDDEN_PRODUCTION_VARS) {
    if (envValue(env, key)) {
      errors.push(`${key} must not be set in production`);
    }
  }

  return errors;
}

export function validateProductionEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const errors = getProductionEmailConfigErrors(env);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
}

export function resolveEmailRecipient(
  originalEmail: string,
  emailType: EmailType,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalizedOriginalEmail = normalizeEmail(originalEmail);

  if (isProductionEmailEnvironment(env)) {
    assertCanSendToRecipient(normalizedOriginalEmail, env);
    return normalizedOriginalEmail;
  }

  if (!isTestmailEnabled(env)) {
    return normalizedOriginalEmail;
  }

  const testRecipients: Record<string, string | undefined> = {
    activation: envValue(env, 'TEST_EMAIL_ACTIVATION'),
    password_reset: envValue(env, 'TEST_EMAIL_PASSWORD_RESET'),
    invitation: envValue(env, 'TEST_EMAIL_INVITE'),
    notification: envValue(env, 'TEST_EMAIL_NOTIFICATION'),
  };

  const testRecipient = normalizeEmail(testRecipients[emailType] || '');
  if (testRecipient) {
    return testRecipient;
  }

  return normalizedOriginalEmail;
}
