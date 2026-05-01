import { Body, Controller, Post } from '@nestjs/common';
import { MonitoringService, type ClientErrorReport } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post('client-errors')
  reportClientError(@Body() body: ClientErrorReport) {
    return this.monitoring.reportClientError(body);
  }
}
