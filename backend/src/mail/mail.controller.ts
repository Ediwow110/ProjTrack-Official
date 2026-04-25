import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { MailService } from './mail.service';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/mail-jobs')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  listJobs() {
    return this.mail.listJobs();
  }

  @Post(':id/retry')
  retryJob(@Param('id') id: string) {
    return this.mail.retryJob(id);
  }

  @Post('resume-paused')
  resumePausedJobs(
    @Query('campaignId') campaignId?: string,
    @Query('batchKey') batchKey?: string,
  ) {
    return this.mail.resumePausedJobs({ campaignId, batchKey });
  }
}

@Controller()
export class PublicMailController {
  constructor(private readonly mail: MailService) {}

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.mail.unsubscribeByToken(token);
  }
}
