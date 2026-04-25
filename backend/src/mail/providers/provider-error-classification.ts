import type { MailProviderErrorClassification } from './mail-provider.interface';

function getStatusCode(error: any) {
  return Number(error?.statusCode ?? error?.status ?? error?.response?.status ?? error?.response?.statusCode ?? 0) || undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown mail provider error');
}

export function classifyProviderError(error: unknown): MailProviderErrorClassification {
  const statusCode = getStatusCode(error);
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (statusCode === 429 || (statusCode && statusCode >= 500)) {
    return { retryable: true, permanent: false, reason: message, statusCode };
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('temporar') ||
    normalized.includes('rate limit') ||
    normalized.includes('network') ||
    normalized.includes('econnreset') ||
    normalized.includes('etimedout')
  ) {
    return { retryable: true, permanent: false, reason: message, statusCode };
  }

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return { retryable: false, permanent: true, reason: message, statusCode };
  }

  return { retryable: false, permanent: true, reason: message, statusCode };
}
