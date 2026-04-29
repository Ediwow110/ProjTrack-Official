import {
  getProductionEmailConfigErrors,
  isProductionEmailEnvironment,
  isTestmailEnabled,
} from '../mail/mail-environment.guard';
import { getMailSenderConfigIssues } from '../mail/mail-sender-config';

type RuntimeValidationResult = {
  ok: boolean;
  environment: string;
  errors: string[];
  warnings: string[];
  detail: string;
  timestamp: string;
};

const DEFAULT_SECRET_VALUES = new Set([
  'change-me',
  'secret',
  'default-secret',
  'development-secret',
  'dev-secret',
  'jwt-secret',
  'replace-with-long-random-secret',
  'ci-access-secret',
  'ci-refresh-secret',
  'playwright-access-secret',
  'playwright-refresh-secret',
]);

const PLACEHOLDER_VALUES = new Set([
  'change-me',
  'replace-me',
  'replace-with-real-password',
  'replace-with-long-random-secret',
  'paste_private_sender_api_key_here',
  'paste_private_mailrelay_api_key_here',
  'paste_private_testmail_api_key_here',
  'smtp.example.com',
  'example.com',
  'noreply@example.com',
  'no-reply@yourdomain.com',
]);

function hasValue(value: string | undefined) {
  return Boolean(String(value ?? '').trim());
}

function asBoolean(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function isWeakSecret(value: string | undefined) {
  const normalized = String(value ?? '').trim();
  return !normalized || normalized.length < 32 || DEFAULT_SECRET_VALUES.has(normalized);
}

function envValue(env: NodeJS.ProcessEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = String(env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function isPlaceholder(value: string | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return PLACEHOLDER_VALUES.has(normalized);
}

function isLocalUrl(value: string | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('projtrack.local');
}

function isLocalDatabaseUrl(value: string | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('@db:') || normalized.includes('@postgres:');
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

function validateMailrelay(
  errors: string[],
  warnings: string[],
  isProduction: boolean,
  env: NodeJS.ProcessEnv,
) {
  const target = isProduction ? errors : warnings;
  const fromName = envValue(env, 'MAIL_FROM_NAME');
  const fromAdmin = envValue(env, 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromNoreply = envValue(env, 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromInvite = envValue(env, 'MAIL_FROM_INVITE', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromNotify = envValue(env, 'MAIL_FROM_NOTIFY', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromSupport = envValue(env, 'MAIL_FROM_SUPPORT', 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const apiKey = envValue(env, 'MAILRELAY_API_KEY');
  const apiUrl = envValue(env, 'MAILRELAY_API_URL');

  if (!hasValue(fromName)) target.push('MAIL_FROM_NAME is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(fromAdmin)) target.push('MAIL_FROM_ADMIN is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(fromNoreply)) target.push('MAIL_FROM_NOREPLY is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(fromInvite)) target.push('MAIL_FROM_INVITE is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(fromNotify)) target.push('MAIL_FROM_NOTIFY is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(fromSupport)) target.push('MAIL_FROM_SUPPORT is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(apiKey)) target.push('MAILRELAY_API_KEY is required when MAIL_PROVIDER=mailrelay.');
  if (!hasValue(apiUrl)) target.push('MAILRELAY_API_URL is required when MAIL_PROVIDER=mailrelay.');
  for (const issue of getMailSenderConfigIssues(env)) {
    pushUnique(target, issue);
  }

  if (isProduction) {
    errors.push(...getProductionEmailConfigErrors(env));
    if (isPlaceholder(fromAdmin)) target.push('MAIL_FROM_ADMIN is still using a placeholder value.');
    if (isPlaceholder(fromNoreply)) target.push('MAIL_FROM_NOREPLY is still using a placeholder value.');
    if (isPlaceholder(fromInvite)) target.push('MAIL_FROM_INVITE is still using a placeholder value.');
    if (isPlaceholder(fromNotify)) target.push('MAIL_FROM_NOTIFY is still using a placeholder value.');
    if (isPlaceholder(fromSupport)) target.push('MAIL_FROM_SUPPORT is still using a placeholder value.');
    if (isPlaceholder(apiKey)) target.push('MAILRELAY_API_KEY is still using a placeholder value.');
    if (isLocalUrl(apiUrl)) target.push('MAILRELAY_API_URL cannot point to localhost or a local-only domain in production.');
  } else if (isTestmailEnabled(env)) {
    if (!hasValue(env.TESTMAIL_NAMESPACE)) {
      warnings.push('TESTMAIL_NAMESPACE should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_ACTIVATION)) {
      warnings.push('TEST_EMAIL_ACTIVATION should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_PASSWORD_RESET)) {
      warnings.push('TEST_EMAIL_PASSWORD_RESET should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_INVITE)) {
      warnings.push('TEST_EMAIL_INVITE should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_NOTIFICATION)) {
      warnings.push('TEST_EMAIL_NOTIFICATION should be set when TESTMAIL_ENABLED=true.');
    }
  }
}

function validateResend(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const target = isProduction ? errors : warnings;
  const apiKey = envValue(env, 'RESEND_API_KEY');
  const fromEmail = envValue(env, 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromName = envValue(env, 'MAIL_FROM_NAME');

  if (!hasValue(fromName)) target.push('MAIL_FROM_NAME is required when MAIL_PROVIDER=resend.');
  if (!hasValue(fromEmail)) target.push('MAIL_FROM_NOREPLY (or legacy MAIL_FROM_EMAIL) is required when MAIL_PROVIDER=resend.');
  if (!hasValue(apiKey)) target.push('RESEND_API_KEY is required when MAIL_PROVIDER=resend.');
}

function validateSender(
  errors: string[],
  warnings: string[],
  isProduction: boolean,
  env: NodeJS.ProcessEnv,
) {
  const target = isProduction ? errors : warnings;
  const fromName = envValue(env, 'MAIL_FROM_NAME');
  const fromAdmin = envValue(env, 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromNoreply = envValue(env, 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromInvite = envValue(env, 'MAIL_FROM_INVITE', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromNotify = envValue(env, 'MAIL_FROM_NOTIFY', 'MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const fromSupport = envValue(env, 'MAIL_FROM_SUPPORT', 'MAIL_FROM_ADMIN', 'MAIL_FROM_EMAIL', 'MAIL_FROM');
  const apiKey = envValue(env, 'SENDER_API_KEY');
  const apiUrl = envValue(env, 'SENDER_API_URL');

  if (!hasValue(fromName)) target.push('MAIL_FROM_NAME is required when MAIL_PROVIDER=sender.');
  if (!hasValue(fromAdmin)) target.push('MAIL_FROM_ADMIN is required when MAIL_PROVIDER=sender.');
  if (!hasValue(fromNoreply)) target.push('MAIL_FROM_NOREPLY is required when MAIL_PROVIDER=sender.');
  if (!hasValue(fromInvite)) target.push('MAIL_FROM_INVITE is required when MAIL_PROVIDER=sender.');
  if (!hasValue(fromNotify)) target.push('MAIL_FROM_NOTIFY is required when MAIL_PROVIDER=sender.');
  if (!hasValue(fromSupport)) target.push('MAIL_FROM_SUPPORT is required when MAIL_PROVIDER=sender.');
  if (!hasValue(apiKey)) target.push('SENDER_API_KEY is required when MAIL_PROVIDER=sender.');
  if (!hasValue(apiUrl)) target.push('SENDER_API_URL is required when MAIL_PROVIDER=sender.');

  if (isProduction) {
    errors.push(...getProductionEmailConfigErrors(env));
    if (isPlaceholder(fromAdmin)) target.push('MAIL_FROM_ADMIN is still using a placeholder value.');
    if (isPlaceholder(fromNoreply)) target.push('MAIL_FROM_NOREPLY is still using a placeholder value.');
    if (isPlaceholder(fromInvite)) target.push('MAIL_FROM_INVITE is still using a placeholder value.');
    if (isPlaceholder(fromNotify)) target.push('MAIL_FROM_NOTIFY is still using a placeholder value.');
    if (isPlaceholder(fromSupport)) target.push('MAIL_FROM_SUPPORT is still using a placeholder value.');
    if (isPlaceholder(apiKey)) target.push('SENDER_API_KEY is still using a placeholder value.');
    if (isLocalUrl(apiUrl)) target.push('SENDER_API_URL cannot point to localhost or a local-only domain in production.');
  } else if (isTestmailEnabled(env)) {
    if (!hasValue(env.TESTMAIL_NAMESPACE)) {
      warnings.push('TESTMAIL_NAMESPACE should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_ACTIVATION)) {
      warnings.push('TEST_EMAIL_ACTIVATION should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_PASSWORD_RESET)) {
      warnings.push('TEST_EMAIL_PASSWORD_RESET should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_INVITE)) {
      warnings.push('TEST_EMAIL_INVITE should be set when TESTMAIL_ENABLED=true.');
    }
    if (!hasValue(env.TEST_EMAIL_NOTIFICATION)) {
      warnings.push('TEST_EMAIL_NOTIFICATION should be set when TESTMAIL_ENABLED=true.');
    }
  }
}

function validateMailProvider(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const provider = String(env.MAIL_PROVIDER ?? 'stub').trim().toLowerCase();

  if (provider === 'sender') {
    validateSender(errors, warnings, isProduction, env);
    return;
  }

  if (provider === 'mailrelay') {
    validateMailrelay(errors, warnings, isProduction, env);
    return;
  }

  if (provider === 'resend') {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'Production requires MAIL_PROVIDER=mailrelay.'
        : 'MAIL_PROVIDER=resend is supported, but Mailrelay is the active production provider for this project.',
    );
    validateResend(errors, warnings, isProduction, env);
    return;
  }

  if (provider === 'stub' || !provider) {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'Production requires MAIL_PROVIDER=mailrelay.'
        : 'MAIL_PROVIDER=stub keeps delivery local-only; set MAIL_PROVIDER=mailrelay to exercise real outbound delivery.',
    );
    return;
  }

  if (provider === 'smtp') {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'SMTP is deprecated for production; switch MAIL_PROVIDER to mailrelay.'
        : 'SMTP is deprecated; switch MAIL_PROVIDER to mailrelay.',
    );
    return;
  }

  (isProduction ? errors : warnings).push(
    `MAIL_PROVIDER="${provider}" is unsupported. Use mailrelay${isProduction ? '' : ', resend, or stub'}.`,
  );
}

function validateStorage(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const target = isProduction ? errors : warnings;
  const storageMode = String(env.OBJECT_STORAGE_MODE ?? env.FILE_STORAGE_MODE ?? 'local').toLowerCase();

  if (storageMode !== 's3') {
    target.push(
      isProduction
        ? 'Production requires OBJECT_STORAGE_MODE=s3 (or FILE_STORAGE_MODE=s3).'
        : 'Object storage is not enabled; local file storage should stay limited to development.',
    );
    return;
  }

  if (!hasValue(env.S3_BUCKET)) target.push('S3_BUCKET is required when object storage mode is s3.');
  if (!hasValue(env.S3_REGION)) target.push('S3_REGION is required when object storage mode is s3.');
  if (!hasValue(env.S3_ACCESS_KEY_ID)) target.push('S3_ACCESS_KEY_ID is required when object storage mode is s3.');
  if (!hasValue(env.S3_SECRET_ACCESS_KEY)) target.push('S3_SECRET_ACCESS_KEY is required when object storage mode is s3.');
}

export function inspectRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): RuntimeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = isProductionEmailEnvironment(env);
  const environment = isProduction
    ? 'production'
    : String(env.APP_ENV ?? env.NODE_ENV ?? 'development').toLowerCase();

  if (!hasValue(env.DATABASE_URL)) {
    errors.push('DATABASE_URL is required.');
  } else if (
    isProduction &&
    isLocalDatabaseUrl(env.DATABASE_URL) &&
    !asBoolean(env.ALLOW_LOCAL_DATABASE_IN_PRODUCTION)
  ) {
    errors.push(
      'DATABASE_URL cannot point to localhost or a local-only database in production unless ALLOW_LOCAL_DATABASE_IN_PRODUCTION=true is explicitly set for a private deployment.',
    );
  }

  if (!hasValue(env.JWT_ACCESS_SECRET)) {
    errors.push('JWT_ACCESS_SECRET is required.');
  } else if (isWeakSecret(env.JWT_ACCESS_SECRET)) {
    (isProduction ? errors : warnings).push(
      'JWT_ACCESS_SECRET is using a default or weak value; replace it with a long random secret.',
    );
  }

  if (!hasValue(env.JWT_REFRESH_SECRET)) {
    errors.push('JWT_REFRESH_SECRET is required.');
  } else if (isWeakSecret(env.JWT_REFRESH_SECRET)) {
    (isProduction ? errors : warnings).push(
      'JWT_REFRESH_SECRET is using a default or weak value; replace it with a long random secret.',
    );
  }

  if (!hasValue(env.FRONTEND_URL)) {
    (isProduction ? errors : warnings).push(
      isProduction ? 'FRONTEND_URL is required in production.' : 'FRONTEND_URL is not set; APP_URL or the local frontend fallback will be used for generated links.',
    );
  } else if (isProduction && isLocalUrl(env.FRONTEND_URL)) {
    errors.push('FRONTEND_URL cannot point to localhost or a local-only domain in production.');
  } else if (isProduction && !String(env.FRONTEND_URL).trim().toLowerCase().startsWith('https://')) {
    errors.push('FRONTEND_URL must use https:// in production.');
  }

  if (!hasValue(env.APP_URL)) {
    (isProduction ? errors : warnings).push(
      isProduction ? 'APP_URL is required in production.' : 'APP_URL is not set; generated links may be incomplete.',
    );
  } else if (isProduction && isLocalUrl(env.APP_URL)) {
    errors.push('APP_URL cannot point to localhost or a local-only domain in production.');
  } else if (isProduction && !String(env.APP_URL).trim().toLowerCase().startsWith('https://')) {
    errors.push('APP_URL must use https:// in production.');
  }

  if (!hasValue(env.CORS_ORIGINS)) {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'CORS_ORIGINS must be explicitly configured in production.'
        : 'CORS_ORIGINS is not set, so development defaults are being used.',
    );
  } else if (isProduction && isLocalUrl(env.CORS_ORIGINS)) {
    errors.push('CORS_ORIGINS cannot use localhost or local-only domains in production.');
  } else if (
    isProduction &&
    String(env.CORS_ORIGINS)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .some((value) => !value.startsWith('https://'))
  ) {
    errors.push('CORS_ORIGINS must use https:// origins in production.');
  }

  validateMailProvider(errors, warnings, isProduction, env);
  validateStorage(errors, warnings, isProduction, env);

  if (asBoolean(env.ALLOW_DEMO_SEED)) {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'ALLOW_DEMO_SEED must stay false in production.'
        : 'ALLOW_DEMO_SEED is enabled; demo data should not leak into shared environments.',
    );
  }

  if (asBoolean(env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS)) {
    warnings.push('ALLOW_PRODUCTION_ADMIN_TOOL_RUNS is enabled; verify that restricted admin operations are intentional.');
  }

  const detail =
    errors.length > 0
      ? `${errors.length} blocking configuration issue(s) detected.`
      : warnings.length > 0
        ? `${warnings.length} configuration warning(s) detected.`
        : 'Runtime configuration looks healthy.';

  return {
    ok: errors.length === 0,
    environment,
    errors,
    warnings,
    detail,
    timestamp: new Date().toISOString(),
  };
}
