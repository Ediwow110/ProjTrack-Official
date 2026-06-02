import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { DataDeletionService } from './data-deletion.service';
import { CreateDataDeletionRequestDto, ReviewDataDeletionRequestDto } from './data-deletion.dto';

@UseGuards(JwtAuthGuard)
@Controller('data-deletion')
export class DataDeletionController {
  constructor(private readonly dataDeletion: DataDeletionService) {}

  // Self-service: any authenticated user requests deletion of their *own* data only.
  @Post('requests')
  createRequest(@Req() req: any, @Body() dto: CreateDataDeletionRequestDto) {
    const userId = String(req?.user?.sub ?? '');
    if (!userId) {
      // Guard should have caught, but defensive
      throw new UnauthorizedException('Authentication required.');
    }
    return this.dataDeletion.createRequest(userId, dto, this.buildActor(req));
  }

  @Get('requests/mine')
  listMine(@Req() req: any) {
    const userId = String(req?.user?.sub ?? '');
    return this.dataDeletion.listMyRequests(userId);
  }

  @Get('requests/:id')
  getMine(@Param('id') id: string, @Req() req: any) {
    const userId = String(req?.user?.sub ?? '');
    return this.dataDeletion.getOneForOwner(id, userId);
  }

  // Optional self-cancel aligned with request/cancel patterns in project.
  @Post('requests/:id/cancel')
  cancelMine(@Param('id') id: string, @Req() req: any) {
    const userId = String(req?.user?.sub ?? '');
    return this.dataDeletion.cancelOwnRequest(id, userId, this.buildActor(req));
  }

  // Admin review paths. Require ADMIN role via decorator (enforced by JwtAuthGuard).
  @Roles('ADMIN')
  @Get('admin/requests')
  listAll(@Req() req: any) {
    // query param support minimal; controller can pass query if added
    const status = (req.query?.status as string) || undefined;
    return this.dataDeletion.listAll(status);
  }

  @Roles('ADMIN')
  @Post('admin/requests/:id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.dataDeletion.approve(id, this.buildActor(req));
  }

  @Roles('ADMIN')
  @Post('admin/requests/:id/deny')
  deny(@Param('id') id: string, @Req() req: any, @Body() dto?: ReviewDataDeletionRequestDto) {
    return this.dataDeletion.deny(id, this.buildActor(req), dto);
  }

  private buildActor(req: any) {
    return {
      actorUserId: String(req?.user?.sub ?? '').trim() || undefined,
      actorEmail: String(req?.user?.email ?? '').trim() || undefined,
      actorRole: String(req?.user?.role ?? '').trim() || undefined,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']) : undefined,
    };
  }
}
