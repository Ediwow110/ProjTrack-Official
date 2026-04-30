import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { MailService } from './mail.service';
import { ArchiveOldMailJobsDto, RetryMailJobDto, RetryMailJobsDto, TestEmailDto } from './dto/mail-job.dto';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/mail-jobs')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  listJobs(@Query('includeArchived') includeArchived?: string) {
    return this.mail.listJobs({
      includeArchived: /^(1|true|yes|on)$/i.test(String(includeArchived ?? '').trim()),
    });
  }

  @Post(':id/retry')
  retryJob(@Param('id') id: string, @Body() body?: RetryMailJobDto) {
    return this.mail.retryJob(id, { force: Boolean(body?.force) });
  }

  @Post('retry')
  retryJobs(@Body() body: RetryMailJobsDto) {
    return this.mail.retryJobs(Array.isArray(body?.ids) ? body.ids : [], {
      force: Boolean(body?.force),
    });
  }

  @Post(':id/cancel')
  cancelJob(@Param('id') id: string) {
    return this.mail.cancelJob(id);
  }

  @Post(':id/archive')
  archiveJob(@Param('id') id: string) {
    return this.mail.archiveJob(id);
  }

  @Post('archive-old')
  archiveOldJobs(@Body() body?: ArchiveOldMailJobsDto) {
    return this.mail.archiveOldJobs({ olderThanDays: body?.olderThanDays });
  }

  @Post('resume-paused')
  resumePausedJobs(
    @Query('campaignId') campaignId?: string,
    @Query('batchKey') batchKey?: string,
  ) {
    return this.mail.resumePausedJobs({ campaignId, batchKey });
  }
}

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/mail')
export class AdminMailOperationsController {
  constructor(private readonly mail: MailService) {}

  @Post('test')
  testEmail(@Body() body: TestEmailDto) {
    return this.mail.queueAdminTestEmail(String(body?.to || ''));
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
