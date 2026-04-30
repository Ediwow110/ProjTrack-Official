import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { BackupsService } from './backups.service';
import { BackupRestoreDto, BackupRunDto, BackupSettingsDto } from './dto/backup.dto';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  private actor(req: any) {
    return {
      actorUserId: String(req?.user?.sub || '').trim() || undefined,
      actorRole: String(req?.user?.role || 'ADMIN').trim() || 'ADMIN',
      ipAddress: req?.ip || req?.socket?.remoteAddress,
    };
  }

  @Get()
  history() {
    return this.backups.listHistory();
  }

  @Get('settings')
  settings() {
    return this.backups.getBackupSettings();
  }

  @Patch('settings')
  updateSettings(@Body() body: BackupSettingsDto) {
    return this.backups.updateBackupSettings(body);
  }

  @Post('run')
  run(@Body() body: BackupRunDto, @Req() req: any) {
    return this.backups.runManual(this.actor(req), String(body?.backupType || 'full'));
  }

  @Get(':id/manifest')
  manifest(@Param('id') id: string) {
    return this.backups.manifest(id);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.backups.details(id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.backups.validate(id);
  }

  @Post(':id/protect')
  protect(@Param('id') id: string, @Req() req: any) {
    return this.backups.protect(id, true, this.actor(req));
  }

  @Post(':id/unprotect')
  unprotect(@Param('id') id: string, @Query('confirmation') confirmation: string | undefined, @Req() req: any) {
    return this.backups.protect(id, false, this.actor(req), confirmation);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Body() body: BackupRestoreDto, @Req() req: any) {
    return this.backups.restore(id, body?.confirmation, this.actor(req));
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: any) {
    const artifact = await this.backups.download(id);
    return res.download(artifact.absolutePath, artifact.fileName);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('confirmation') confirmation: string | undefined, @Req() req: any) {
    return this.backups.delete(id, confirmation, this.actor(req));
  }
}
