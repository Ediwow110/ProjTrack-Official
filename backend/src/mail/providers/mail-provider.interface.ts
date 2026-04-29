export type MailSendInput = {
  to: string;
  originalTo?: string | null;
  recipientName?: string | null;
  subject: string;
  html: string;
  text: string;
  templateKey?: string;
  mailCategory?: string;
  emailType?: string | null;
  tags?: Record<string, string>;
  fromEmail?: string | null;
  fromName?: string | null;
};

export type MailSendResult = {
  provider: string;
  messageId: string | null;
};

export type MailHealthResult = {
  ok: boolean;
  provider: string;
  verified: boolean;
  from: string;
  detail: string;
  timestamp: string;
};

export type MailProviderErrorClassification = {
  retryable: boolean;
  permanent: boolean;
  reason: string;
  failureReason?: string | null;
  statusCode?: number;
};

export interface MailProvider {
  readonly name: string;
  getFromAddress(): string;
  verify(): Promise<MailHealthResult>;
  send(input: MailSendInput): Promise<MailSendResult>;
  classifyError(error: unknown): MailProviderErrorClassification;
}
