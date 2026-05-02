import { MAIL_FAILURE_REASONS } from '../../common/constants/mail.constants';
import type { MailProviderErrorClassification } from './mail-provider.interface';

export const SENDER_NOT_CONFIRMED_SAFE_MESSAGE =
  'Mailrelay rejected the message because the sender address is not confirmed in Mailrelay. Confirm the sender in Mailrelay or change MAIL_FROM_* to a confirmed address.';

function getStatusCode(error: any) {
  return Number(
    error?.statusCode ??
      error?.status ??
      error?.response?.status ??
      error?.response?.statusCode ??
      0,
  ) || undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown mail provider error');
}

function truncate(value: string, max = 600) {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function redactProviderReason(value: string) {
  return String(value || '')
    .replace(/(api(?:[_-]?|\s+)key["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(authorization["'\s:=]+bearer\s+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/(token["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(x-auth-token["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]');
}

function sanitizeProviderReason(message: string) {
  const safeMessage = truncate(redactProviderReason(message));
  return safeMessage || 'Mail provider delivery failed.';
}

function buildSafeReason(base: string, providerDetail: string) {
  const safeBase = truncate(base);
  const safeDetail = truncate(providerDetail);
  if (!safeDetail) return safeBase;

  const normalizedBase = safeBase.toLowerCase();
  const normalizedDetail = safeDetail.toLowerCase();
  if (
    normalizedDetail === normalizedBase ||
    normalizedDetail.startsWith(normalizedBase) ||
    normalizedBase.includes(normalizedDetail)
  ) {
    return safeBase;
  }

  return truncate(`${safeBase} Provider response: ${safeDetail}`);
}

function normalizedMessage(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function messageIncludes(normalized: string, terms: string[]) {
  return terms.some((term) => normalized.includes(term));
}

export function isSenderNotConfirmedMessage(value: unknown) {
  const normalized = normalizedMessage(value);
  return messageIncludes(normalized, [
    "sender email isn't confirmed",
    'sender email is not confirmed',
    'sender not confirmed',
    'sender not verified',
    'from email not confirmed',
    'from email is not confirmed',
    'unauthorized sender',
  ]);
}

function isAccountRestrictedMessage(normalized: string) {
  return messageIncludes(normalized, [
    'currently under review',
    'account is currently under review',
    'account under review',
    'account suspended',
    'account restricted',
    'account disabled',
    'account blocked',
    'sender account is not active',
    'mail account is not active',
  ]);
}

function isAuthFailureMessage(normalized: string) {
  return messageIncludes(normalized, [
    'authentication failed',
    'auth failed',
    'invalid api key',
    'invalid credentials',
    'not authorized',
    'unauthorized',
    'forbidden',
    'access denied',
  ]);
}

function isRateLimitedMessage(normalized: string) {
  return messageIncludes(normalized, [
    'rate limit',
    'too many requests',
    'throttle',
    'quota exceeded',
    'slow down',
  ]);
}

function isNetworkFailureMessage(normalized: string) {
  return messageIncludes(normalized, [
    'network',
    'timeout',
    'timed out',
    'econnreset',
    'econnrefused',
    'enotfound',
    'eai_again',
    'socket hang up',
    'fetch failed',
    'tls',
    'getaddrinfo',
    'connect failed',
  ]);
}

function isInvalidRecipientMessage(normalized: string) {
  return (
    (normalized.includes('"to"') && normalized.includes('is invalid')) ||
    messageIncludes(normalized, [
    'invalid recipient',
    'recipient address rejected',
    'bad recipient',
    'user unknown',
    'mailbox unavailable',
    'invalid email',
    'email is invalid',
    'address is invalid',
    'email address is invalid',
    'no recipients',
    'malformed address',
    ])
  );
}

function isTemporaryProviderMessage(normalized: string) {
  return messageIncludes(normalized, [
    'temporarily unavailable',
    'temporary failure',
    'temporary error',
    'service unavailable',
    'internal server error',
    'bad gateway',
    'gateway timeout',
    'try again later',
    'upstream',
  ]);
}

function isHardRejectionMessage(normalized: string) {
  return messageIncludes(normalized, [
    'rejected',
    'rejection',
    'denied',
    'validation failed',
    'unprocessable entity',
    'policy violation',
    'not accepted',
  ]);
}

function classification(
  failureReason: string,
  input: {
    retryable: boolean;
    reason: string;
    statusCode?: number;
  },
): MailProviderErrorClassification {
  return {
    retryable: input.retryable,
    permanent: !input.retryable,
    reason: truncate(input.reason),
    failureReason,
    statusCode: input.statusCode,
  };
}

export function classifyProviderError(error: unknown): MailProviderErrorClassification {
  const statusCode = getStatusCode(error);
  const message = getErrorMessage(error);
  const providerDetail = sanitizeProviderReason(message);
  const normalized = normalizedMessage(message);

  if (isSenderNotConfirmedMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.SENDER_NOT_CONFIRMED, {
      retryable: true,
      reason: buildSafeReason(SENDER_NOT_CONFIRMED_SAFE_MESSAGE, providerDetail),
      statusCode,
    });
  }

  if (isAccountRestrictedMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.ACCOUNT_RESTRICTED, {
      retryable: false,
      reason: buildSafeReason(
        'Mailrelay account access is restricted or under review. Resolve the provider-side restriction before retrying this job.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if (statusCode === 401 || statusCode === 403 || isAuthFailureMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.AUTH_FAILED, {
      retryable: false,
      reason: buildSafeReason(
        'Mailrelay authentication failed. Verify the API key and provider permissions before retrying this job.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if (statusCode === 429 || isRateLimitedMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.RATE_LIMITED, {
      retryable: true,
      reason: buildSafeReason(
        'Mailrelay rate limiting was detected. The worker will retry this job automatically.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if (isNetworkFailureMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.NETWORK_ERROR, {
      retryable: true,
      reason: buildSafeReason(
        'A network error occurred while contacting Mailrelay. The worker will retry this job automatically.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if (isInvalidRecipientMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.INVALID_RECIPIENT, {
      retryable: false,
      reason: buildSafeReason(
        'Mailrelay rejected the recipient address as invalid. Correct the recipient email before retrying this job.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if ((statusCode && statusCode >= 500) || isTemporaryProviderMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.PROVIDER_TEMPORARY, {
      retryable: true,
      reason: buildSafeReason(
        'Mailrelay is temporarily unavailable. The worker will retry this job automatically.',
        providerDetail,
      ),
      statusCode,
    });
  }

  if ((statusCode && statusCode >= 400 && statusCode < 500) || isHardRejectionMessage(normalized)) {
    return classification(MAIL_FAILURE_REASONS.PROVIDER_REJECTED, {
      retryable: false,
      reason: buildSafeReason(
        'Mailrelay rejected the email request. Fix the sender, recipient, or provider policy issue before retrying this job.',
        providerDetail,
      ),
      statusCode,
    });
  }

  return classification(MAIL_FAILURE_REASONS.UNKNOWN_PROVIDER_ERROR, {
    retryable: false,
    reason: buildSafeReason(
      'Mailrelay returned an unclassified provider error. Inspect the safe provider message before retrying this job.',
      providerDetail,
    ),
    statusCode,
  });
}
