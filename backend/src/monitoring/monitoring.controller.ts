import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { MonitoringService, type ClientErrorReport } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post('client-errors')
  reportClientError(@Body() body: ClientErrorReport) {
    return this.monitoring.reportClientError(body);
  }

  @Get('client-errors')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  getRecentClientErrors() {
    return this.monitoring.getRecentClientErrors();
  }
}
