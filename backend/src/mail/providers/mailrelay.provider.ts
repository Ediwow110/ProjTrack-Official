import { Injectable } from '@nestjs/common';
import { MAIL_PROVIDER_NAMES } from '../../common/constants/mail.constants';
import {
  resolveMailSenderConfig,
  VERIFIED_PRODUCTION_SENDERS,
} from '../mail-sender-config';
import { classifyProviderError } from './provider-error-classification';
import type { MailHealthResult, MailProvider, MailSendInput } from './mail-provider.interface';

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeBaseUrl(value: string) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function sendEmailsUrl(value: string) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return '';
  return normalized.endsWith('/send_emails') ? normalized : `${normalized}/send_emails`;
}

function mailrelayTimeoutMs() {
  const parsed = Number(process.env.MAILRELAY_TIMEOUT_MS || process.env.MAIL_HTTP_TIMEOUT_MS || 10_000);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10_000;
}

function validateMailrelayApiUrl(value: string) {
  const sendUrl = sendEmailsUrl(value);
  if (!sendUrl) return { sendUrl: '', error: 'MAILRELAY_API_URL is missing or invalid.' };
  try {
    const parsed = new URL(sendUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { sendUrl: '', error: 'MAILRELAY_API_URL must use http:// or https://.' };
    }
    return { sendUrl: parsed.toString(), error: '' };
  } catch {
    return { sendUrl: '', error: 'MAILRELAY_API_URL is missing or invalid.' };
  }
}

function resolveFromIdentity(input?: MailSendInput) {
  const senderConfig = resolveMailSenderConfig();
  const defaultFromName = senderConfig.fromName || 'ProjTrack';
  const defaultFromEmail =
    senderConfig.support.email ||
    senderConfig.admin.email ||
    VERIFIED_PRODUCTION_SENDERS.support;
  return {
    fromName: String(input?.fromName ?? defaultFromName).trim() || 'ProjTrack',
    fromEmail:
      String(input?.fromEmail ?? defaultFromEmail).trim().toLowerCase() ||
      VERIFIED_PRODUCTION_SENDERS.support,
  };
}

function truncate(value: string, max = 600) {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function safeJsonParse(value: string) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function redactProviderDetail(value: string) {
  return String(value || '')
    .replace(/(api(?:[_-]?|\s+)key["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(token["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(x-auth-token["'\s:=]+)[^"',\s}]+/gi, '$1[redacted]');
}

function providerResponseDetail(parsedBody: any, rawBody: string) {
  const detail = String(
    parsedBody?.message ??
      parsedBody?.error ??
      parsedBody?.detail ??
      rawBody ??
      'Mailrelay API returned an error response.',
  );
  return truncate(redactProviderDetail(detail)) || 'Mailrelay API returned an error response.';
}

function extractMessageId(payload: any) {
  const candidates = [
    payload?.id,
    payload?.message_id,
    payload?.messageId,
    payload?.email_id,
    payload?.emailId,
    payload?.data?.id,
    payload?.data?.message_id,
    payload?.data?.messageId,
    payload?.data?.email_id,
    payload?.data?.emailId,
    Array.isArray(payload?.data) ? payload.data[0]?.id : null,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }

  return null;
}

function responseLooksSuccessful(payload: any) {
  if (!payload || typeof payload !== 'object') return true;
  const marker = String(payload.status ?? payload.result ?? payload.success ?? '')
    .trim()
    .toLowerCase();
  if (!marker) return true;
  if (marker === 'success' || marker === 'ok' || marker === 'queued' || marker === 'true') {
    return true;
  }
  return false;
}

class MailrelayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'MailrelayApiError';
  }
}

@Injectable()
export class MailrelayMailProvider implements MailProvider {
  readonly name = MAIL_PROVIDER_NAMES.MAILRELAY;

  getFromAddress() {
    const { fromName, fromEmail } = resolveFromIdentity();
    return `${fromName} <${fromEmail}>`;
  }

  async verify(): Promise<MailHealthResult> {
    const timestamp = new Date().toISOString();
    const apiKey = envValue('MAILRELAY_API_KEY');
    const apiUrl = envValue('MAILRELAY_API_URL');
    const { sendUrl, error } = validateMailrelayApiUrl(apiUrl);
    const verified = Boolean(apiKey && sendUrl);

    return {
      ok: verified,
      provider: this.name,
      verified,
      from: this.getFromAddress(),
      detail: verified
        ? `Mailrelay provider is configured for ${sendUrl}.`
        : !apiKey
          ? 'MAILRELAY_API_KEY is missing.'
          : error,
      timestamp,
    };
  }

  async send(input: MailSendInput) {
    const apiKey = envValue('MAILRELAY_API_KEY');
    const { sendUrl: apiUrl, error: apiUrlError } = validateMailrelayApiUrl(envValue('MAILRELAY_API_URL'));
    if (!apiKey) {
      throw new MailrelayApiError('MAILRELAY_API_KEY is required when MAIL_PROVIDER=mailrelay.');
    }
    if (!apiUrl) {
      throw new MailrelayApiError(apiUrlError || 'MAILRELAY_API_URL is required when MAIL_PROVIDER=mailrelay.');
    }

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== 'function') {
      throw new MailrelayApiError('Global fetch is unavailable in the current Node runtime.');
    }

    const { fromName, fromEmail } = resolveFromIdentity(input);
    const subject = String(input.subject ?? '').trim();
    const html = String(input.html ?? '').trim();
    const text = String(input.text ?? '').trim();
    if (!subject) {
      throw new MailrelayApiError('Mail subject is required before Mailrelay send.');
    }
    if (!html && !text) {
      throw new MailrelayApiError('Mail HTML or text body is required before Mailrelay send.');
    }
    const payload: Record<string, unknown> = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [
        {
          email: input.to,
          name: input.recipientName || input.to,
        },
      ],
      subject,
      html_part: html,
    };

    if (text) {
      payload.text_part = text;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), mailrelayTimeoutMs());
    let response: any;
    try {
      response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-AUTH-TOKEN': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        throw new MailrelayApiError('Mailrelay API request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await response.text();
    const parsedBody = safeJsonParse(rawBody);

    if (!response.ok) {
      const detail = providerResponseDetail(parsedBody, rawBody);
      throw new MailrelayApiError(
        `Mailrelay API failed with status ${response.status}: ${detail}`,
        response.status,
      );
    }

    // Mailrelay's public transactional example documents the request shape but not a canonical
    // response payload shape, so message-id extraction stays defensive here.
    if (!responseLooksSuccessful(parsedBody)) {
      const detail = providerResponseDetail(parsedBody, rawBody);
      throw new MailrelayApiError(detail, response.status || 400);
    }

    return {
      provider: this.name,
      messageId: extractMessageId(parsedBody),
    };
  }

  classifyError(error: unknown) {
    return classifyProviderError(error);
  }
}
