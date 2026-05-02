import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAIL_PROVIDER_NAMES } from '../common/constants/mail.constants';
import {
  assertCanSendToRecipient,
  isTestmailEnabled,
  validateProductionEmailConfig,
} from './mail-environment.guard';
import { MailProviderRouterService } from './mail-provider-router.service';
import type {
  MailHealthResult,
  MailProvider,
  MailProviderErrorClassification,
  MailSendInput,
} from './providers/mail-provider.interface';
import { MailrelayMailProvider } from './providers/mailrelay.provider';
import { ResendMailProvider } from './providers/resend.provider';
import { SenderMailProvider } from './providers/sender.provider';
import { StubMailProvider } from './providers/stub.provider';

function selectedProviderName() {
  return String(process.env.MAIL_PROVIDER ?? MAIL_PROVIDER_NAMES.STUB)
    .trim()
    .toLowerCase();
}

const TESTMAIL_STUB_PROVIDER_DETAIL =
  'TESTMAIL_ENABLED is enabled, but the stub mail provider only logs messages and cannot deliver to testmail.app.';

@Injectable()
export class MailTransportService implements OnModuleInit {
  private readonly logger = new Logger(MailTransportService.name);
  private readonly providerName = selectedProviderName();
  private verified = false;
  private verificationDetail = 'Mail transport has not been verified yet.';
  private lastVerifiedAt: string | null = null;

  constructor(
    private readonly stubProvider: StubMailProvider,
    private readonly resendProvider: ResendMailProvider,
    private readonly senderProvider: SenderMailProvider,
    private readonly mailrelayProvider: MailrelayMailProvider,
    private readonly router: MailProviderRouterService,
  ) {}

  async onModuleInit() {
    await this.verifyTransport();
  }

  getProviderName() {
    return this.provider().name;
  }

  getFromAddress() {
    return this.router.getDefaultFromAddress();
  }

  isVerified() {
    return this.verified;
  }

  getVerificationDetail() {
    return this.verificationDetail;
  }

  getLastVerifiedAt() {
    return this.lastVerifiedAt;
  }

  async verifyTransport() {
    const result = await this.evaluateProviderReadiness();
    this.verified = result.verified;
    this.lastVerifiedAt = result.timestamp;
    this.verificationDetail = result.detail;

    if (result.ok) {
      this.logger.log(`${result.provider} mail provider ready: ${result.detail}`);
    } else {
      this.logger.warn(`${result.provider} mail provider is not ready: ${result.detail}`);
    }

    return result;
  }

  async ensureReadyForQueue() {
    const result = await this.evaluateProviderReadiness();
    if (!result.ok) {
      throw new ServiceUnavailableException(result.detail);
    }
    return result;
  }

  async sendRenderedMessage(input: MailSendInput) {
    validateProductionEmailConfig();
    const routedInput = this.router.resolve(input);
    assertCanSendToRecipient(routedInput.to);
    return this.provider().send(routedInput);
  }

  classifyError(error: unknown): MailProviderErrorClassification {
    return this.provider().classifyError(error);
  }

  private async evaluateProviderReadiness(): Promise<MailHealthResult> {
    const provider = this.provider();
    const result = await provider.verify();

    if (provider.name === MAIL_PROVIDER_NAMES.STUB && isTestmailEnabled()) {
      return {
        ...result,
        ok: false,
        verified: false,
        detail: TESTMAIL_STUB_PROVIDER_DETAIL,
      };
    }

    return result;
  }

  private provider(): MailProvider {
    if (this.providerName === MAIL_PROVIDER_NAMES.MAILRELAY) return this.mailrelayProvider;

    if (this.providerName === MAIL_PROVIDER_NAMES.SENDER) return this.senderProvider;

    if (this.providerName === MAIL_PROVIDER_NAMES.RESEND) return this.resendProvider;

    if (
      this.providerName &&
      this.providerName !== MAIL_PROVIDER_NAMES.STUB
    ) {
      this.logger.warn(
        `Unsupported MAIL_PROVIDER="${this.providerName}". Falling back to stub provider. Supported values: mailrelay, resend, sender, stub.`,
      );
    }

    return this.stubProvider;
  }
}
