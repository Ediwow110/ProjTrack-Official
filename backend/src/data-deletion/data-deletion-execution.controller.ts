import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { DataDeletionExecutionService } from './data-deletion-execution.service';
import { VerifyBackupDto } from './data-deletion-execution.dto';

@UseGuards(JwtAuthGuard)
@Controller('data-deletion')
export class DataDeletionExecutionController {
  constructor(private readonly execution: DataDeletionExecutionService) {}

  @Roles('ADMIN')
  @Post('admin/requests/:id/executions/dry-run')
  async createAndStartDryRun(@Param('id') requestId: string, @Req() req: any) {
    const actor = this.buildActor(req);
    const execution = await this.execution.getOrCreateExecutionForRequest(requestId, actor);
    const started = await this.execution.startDryRun(execution.id, actor);
    return { success: true, execution: started };
  }

  @Roles('ADMIN')
  @Get('admin/requests/:id/execution')
  async getExecution(@Param('id') requestId: string) {
    const execution = await this.execution.getExecutionByRequestId(requestId);
    if (!execution) {
      return { exists: false };
    }
    return { exists: true, execution };
  }

  @Roles('ADMIN')
  @Post('admin/requests/:id/executions/verify-backup')
  async verifyBackup(@Param('id') requestId: string, @Body() dto: VerifyBackupDto, @Req() req: any) {
    // find execution by request
    const exec = await this.execution['prisma'].dataDeletionExecution.findUnique({ where: { requestId } });
    if (!exec) throw new NotFoundException('No execution for request.');
    const actor = this.buildActor(req);
    return this.execution.verifyBackup(exec.id, dto, actor);
  }

  private buildActor(req: any) {
    return {
      actorUserId: String(req?.user?.sub ?? '').trim() || undefined,
      actorRole: String(req?.user?.role ?? '').trim() || undefined,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
    };
  }
}
