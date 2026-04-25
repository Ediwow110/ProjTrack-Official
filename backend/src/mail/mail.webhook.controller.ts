import { Controller, Headers, Post, Req } from '@nestjs/common';
import { MailWebhookService } from './mail.webhook.service';

@Controller('mail/webhooks')
export class MailWebhookController {
  constructor(private readonly webhooks: MailWebhookService) {}

  @Post('resend')
  handleResend(@Req() req: any, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.webhooks.handleResendWebhook(req.rawBody, headers);
  }
}
