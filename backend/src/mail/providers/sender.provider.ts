import { Injectable } from '@nestjs/common';
import { MAIL_PROVIDER_NAMES } from '../../common/constants/mail.constants';
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

function sendMessageUrl(value: string) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return '';
  return normalized.endsWith('/message/send') ? normalized : `${normalized}/message/send`;
}

function authProbeUrl(value: string) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return '';
  const base = normalized.replace(/\/message\/send$/, '');
  return `${base}/subscribers?limit=1`;
}

function senderHeaders(apiKey: string) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function resolveFromIdentity(input?: MailSendInput) {
  const defaultFromName = envValue('MAIL_FROM_NAME') || 'ProjTrack';
  const defaultFromEmail =
    envValue('MAIL_FROM_NOREPLY', 'MAIL_FROM_EMAIL', 'MAIL_FROM', 'MAIL_FROM_ADMIN') ||
    'noreply@projtrack.local';
  return {
    fromName: String(input?.fromName ?? defaultFromName).trim() || 'ProjTrack',
    fromEmail:
      String(input?.fromEmail ?? defaultFromEmail).trim().toLowerCase() ||
      'noreply@projtrack.local',
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

class SenderApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SenderApiError';
  }
}

@Injectable()
export class SenderMailProvider implements MailProvider {
  readonly name = MAIL_PROVIDER_NAMES.SENDER;

  getFromAddress() {
    const { fromName, fromEmail } = resolveFromIdentity();
    return `${fromName} <${fromEmail}>`;
  }

  async verify(): Promise<MailHealthResult> {
    const timestamp = new Date().toISOString();
    const apiKey = envValue('SENDER_API_KEY');
    const apiUrl = sendMessageUrl(envValue('SENDER_API_URL'));
    const probeUrl = authProbeUrl(envValue('SENDER_API_URL'));
    const verified = Boolean(apiKey && apiUrl && probeUrl);

    if (!verified) {
      return {
        ok: false,
        provider: this.name,
        verified: false,
        from: this.getFromAddress(),
        detail: !apiKey
          ? 'SENDER_API_KEY is missing.'
          : 'SENDER_API_URL is missing or invalid.',
        timestamp,
      };
    }

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== 'function') {
      return {
        ok: false,
        provider: this.name,
        verified: false,
        from: this.getFromAddress(),
        detail: 'Global fetch is unavailable in the current Node runtime.',
        timestamp,
      };
    }

    try {
      const response = await fetchImpl(probeUrl, {
        method: 'GET',
        headers: senderHeaders(apiKey),
        signal:
          typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(5000)
            : undefined,
      });
      const rawBody = await response.text();
      const parsedBody = safeJsonParse(rawBody);

      if (!response.ok || (parsedBody && parsedBody.success === false)) {
        const detail =
          truncate(
            String(
              parsedBody?.message ??
                parsedBody?.error ??
                rawBody ??
                response.statusText ??
                'Sender.net verification probe failed.',
            ),
            240,
          ) || 'Sender.net verification probe failed.';
        return {
          ok: false,
          provider: this.name,
          verified: false,
          from: this.getFromAddress(),
          detail: `Sender.net rejected the configured API token (status ${response.status}): ${detail}`,
          timestamp,
        };
      }

      return {
        ok: true,
        provider: this.name,
        verified: true,
        from: this.getFromAddress(),
        detail: `Sender.net provider is configured and authenticated for ${apiUrl}.`,
        timestamp,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        verified: false,
        from: this.getFromAddress(),
        detail: `Sender.net verification probe failed: ${truncate(
          error instanceof Error ? error.message : String(error),
          240,
        )}`,
        timestamp,
      };
    }
  }

  async send(input: MailSendInput) {
    const apiKey = envValue('SENDER_API_KEY');
    const apiUrl = sendMessageUrl(envValue('SENDER_API_URL'));
    if (!apiKey) {
      throw new SenderApiError('SENDER_API_KEY is required when MAIL_PROVIDER=sender.');
    }
    if (!apiUrl) {
      throw new SenderApiError('SENDER_API_URL is required when MAIL_PROVIDER=sender.');
    }

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== 'function') {
      throw new SenderApiError('Global fetch is unavailable in the current Node runtime.');
    }

    const { fromName, fromEmail } = resolveFromIdentity(input);
    const payload: Record<string, unknown> = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: {
        email: input.to,
        name: input.recipientName || input.to,
      },
      subject: input.subject,
    };

    if (String(input.text ?? '').trim()) {
      payload.text = input.text;
    }

    if (String(input.html ?? '').trim()) {
      payload.html = input.html;
    }

    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: senderHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    const parsedBody = safeJsonParse(rawBody);

    if (!response.ok) {
      throw new SenderApiError(
        `Sender.net API failed with status ${response.status}.`,
        response.status,
      );
    }

    if (parsedBody && parsedBody.success === false) {
      const detail =
        truncate(
          String(
            parsedBody?.message ??
              parsedBody?.error ??
              rawBody ??
              'Sender.net API returned a non-success payload.',
          ),
        ) || 'Sender.net API returned a non-success payload.';
      throw new SenderApiError(detail, response.status || 400);
    }

    return {
      provider: this.name,
      messageId: String(parsedBody?.emailId ?? parsedBody?.data?.emailId ?? '').trim() || null,
    };
  }

  classifyError(error: unknown) {
    return classifyProviderError(error);
  }
}
