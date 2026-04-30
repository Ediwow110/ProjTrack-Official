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
  return !normalized || normalized.length < 48 || DEFAULT_SECRET_VALUES.has(normalized) || isPlaceholder(normalized);
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
  return (
    normalized.startsWith('file:') ||
    normalized.startsWith('sqlite:') ||
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('[::1]') ||
    normalized.includes('@db:') ||
    normalized.includes('@postgres:')
  );
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
  if (isProduction && isLocalUrl(env.S3_ENDPOINT)) target.push('S3_ENDPOINT cannot point to localhost in production.');
  const signedUrlTtl = Number(env.S3_SIGNED_URL_TTL_SECONDS || 300);
  if (!Number.isFinite(signedUrlTtl) || signedUrlTtl < 30 || signedUrlTtl > 900) {
    target.push('S3_SIGNED_URL_TTL_SECONDS must be between 30 and 900 seconds.');
  }
  if (isProduction && asBoolean(env.S3_BUCKET_PUBLIC)) {
    target.push('S3_BUCKET_PUBLIC must not be true; production buckets must stay private.');
  }
}

function isValidAccountActionTokenKey(value: string | undefined) {
  const configured = String(value ?? '').trim();
  if (/^[a-f0-9]{64}$/i.test(configured)) return true;
  try {
    return Buffer.from(configured, 'base64').length === 32;
  } catch {
    return false;
  }
}

function validateHttpsUrl(
  env: NodeJS.ProcessEnv,
  key: string,
  label: string,
  errors: string[],
  warnings: string[],
  isProduction: boolean,
) {
  const value = String(env[key] ?? '').trim();
  if (!value) {
    (isProduction ? errors : warnings).push(
      isProduction ? `${label} is required in production.` : `${label} is not set.`,
    );
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    (isProduction ? errors : warnings).push(`${label} must be a valid absolute URL.`);
    return;
  }
  if (isProduction && (isLocalUrl(value) || parsed.protocol !== 'https:')) {
    errors.push(`${label} must be an https:// public URL and cannot point to localhost in production.`);
  }
}

function validateWorkerSettings(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const target = isProduction ? errors : warnings;
  for (const key of ['MAIL_WORKER_ENABLED', 'BACKUP_WORKER_ENABLED', 'BACKUP_SCHEDULE_ENABLED']) {
    if (!hasValue(env[key])) target.push(`${key} must be explicitly configured.`);
  }
  for (const key of ['MAIL_WORKER_POLL_MS', 'BACKUP_WORKER_POLL_MS']) {
    const raw = env[key];
    if (!hasValue(raw)) {
      target.push(`${key} must be explicitly configured.`);
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1000) target.push(`${key} must be a number >= 1000.`);
  }
}

function validateRateLimit(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const store = String(env.HTTP_RATE_LIMIT_STORE || (isProduction ? '' : 'memory')).trim().toLowerCase();
  if (isProduction && !['database', 'redis', 'gateway'].includes(store)) {
    errors.push('HTTP_RATE_LIMIT_STORE must be database, redis, or gateway in production; in-memory limits are not production-safe.');
  } else if (!isProduction && store === 'memory') {
    warnings.push('HTTP_RATE_LIMIT_STORE=memory is development-only; production must use database, redis, or gateway limits.');
  }
}

function validateUploadScanning(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const scanner = String(env.FILE_MALWARE_SCANNER || '').trim().toLowerCase();
  const mode = String(env.FILE_MALWARE_SCAN_MODE || (isProduction ? 'fail-closed' : 'disabled')).trim().toLowerCase();
  if (isProduction && mode !== 'fail-closed') {
    errors.push('FILE_MALWARE_SCAN_MODE must be fail-closed in production.');
  }
  if (isProduction && scanner !== 'clamav') {
    errors.push('FILE_MALWARE_SCANNER must be clamav in production until another scanner adapter is implemented.');
  }
  if (scanner === 'clamav') {
    const target = isProduction ? errors : warnings;
    if (!hasValue(env.CLAMAV_HOST)) target.push('CLAMAV_HOST is required when FILE_MALWARE_SCANNER=clamav.');
    if (!hasValue(env.CLAMAV_PORT)) target.push('CLAMAV_PORT is required when FILE_MALWARE_SCANNER=clamav.');
  }
}

export function inspectRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): RuntimeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = isProductionEmailEnvironment(env);
  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase();
  const appEnv = String(env.APP_ENV ?? '').trim().toLowerCase();
  const validEnvValues = new Set(['development', 'test', 'production']);
  const environment = isProduction ? 'production' : String(appEnv || nodeEnv || 'development').toLowerCase();

  if (!nodeEnv || !validEnvValues.has(nodeEnv)) {
    (isProduction ? errors : warnings).push('NODE_ENV must be explicitly set to development, test, or production.');
  }
  if (!appEnv || !validEnvValues.has(appEnv)) {
    (isProduction ? errors : warnings).push('APP_ENV must be explicitly set to development, test, or production.');
  }
  if ((nodeEnv === 'production' || appEnv === 'production') && (nodeEnv !== 'production' || appEnv !== 'production')) {
    errors.push('NODE_ENV and APP_ENV must both be production for production runtime; mixed environment values are ambiguous.');
  }

  if (!hasValue(env.DATABASE_URL)) {
    errors.push('DATABASE_URL is required.');
  } else if (isProduction && isLocalDatabaseUrl(env.DATABASE_URL)) {
    errors.push('DATABASE_URL cannot point to localhost, SQLite, or any local-only database in production.');
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
  if (hasValue(env.JWT_ACCESS_SECRET) && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    (isProduction ? errors : warnings).push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
  if (isProduction && !hasValue(env.JWT_ISSUER)) {
    errors.push('JWT_ISSUER is required in production.');
  }
  if (isProduction && !hasValue(env.JWT_AUDIENCE)) {
    errors.push('JWT_AUDIENCE is required in production.');
  }
  if (isProduction && !hasValue(env.JWT_KEY_ID)) {
    errors.push('JWT_KEY_ID is required in production to support documented key rotation.');
  }

  if (!hasValue(env.ACCOUNT_ACTION_TOKEN_ENC_KEY)) {
    (isProduction ? errors : warnings).push(
      isProduction
        ? 'ACCOUNT_ACTION_TOKEN_ENC_KEY is required in production.'
        : 'ACCOUNT_ACTION_TOKEN_ENC_KEY is not set; development will use a local fallback key.',
    );
  } else if (!isValidAccountActionTokenKey(env.ACCOUNT_ACTION_TOKEN_ENC_KEY)) {
    (isProduction ? errors : warnings).push('ACCOUNT_ACTION_TOKEN_ENC_KEY must be a 32-byte base64 value or 64-character hex value.');
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

  validateHttpsUrl(env, 'BACKEND_URL', 'BACKEND_URL', errors, warnings, isProduction);

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
  validateWorkerSettings(errors, warnings, isProduction, env);
  validateRateLimit(errors, warnings, isProduction, env);
  validateUploadScanning(errors, warnings, isProduction, env);

  if (isProduction && !asBoolean(env.TRUST_PROXY)) {
    errors.push('TRUST_PROXY=true is required in production so rate limiting and secure-cookie logic use proxy-aware client addresses.');
  }

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
