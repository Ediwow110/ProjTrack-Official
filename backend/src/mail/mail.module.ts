import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TokenService } from '../auth/token.service';
import { MailController, PublicMailController } from './mail.controller';
import { MailLimitService } from './mail-limit.service';
import { MailProviderRouterService } from './mail-provider-router.service';
import { MailService } from './mail.service';
import { MailTransportService } from './mail.transport.service';
import { MailWebhookController } from './mail.webhook.controller';
import { MailWebhookService } from './mail.webhook.service';
import { MailWorker } from './mail.worker';
import { MailrelayMailProvider } from './providers/mailrelay.provider';
import { ResendMailProvider } from './providers/resend.provider';
import { SenderMailProvider } from './providers/sender.provider';
import { StubMailProvider } from './providers/stub.provider';

@Global()
@Module({
  controllers: [MailController, PublicMailController, MailWebhookController],
  providers: [
    MailService,
    MailLimitService,
    MailProviderRouterService,
    MailTransportService,
    MailWebhookService,
    MailWorker,
    StubMailProvider,
    ResendMailProvider,
    SenderMailProvider,
    MailrelayMailProvider,
    TokenService,
    JwtAuthGuard,
  ],
  exports: [MailService, MailTransportService, MailLimitService],
})
export class MailModule {}
