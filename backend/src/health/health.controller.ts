import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  root() {
    return this.health.live();
  }

  @Get('live')
  live() {
    return this.health.live();
  }

  @Get('ready')
  ready() {
    return this.health.ready();
  }

  @Get('storage')
  storage() {
    return this.health.storage();
  }

  @Get('mail')
  mail() {
    return this.health.mailStatus();
  }

  @Get('configuration')
  configuration() {
    return this.health.configuration();
  }

  @Get('database')
  database() {
    return this.health.database();
  }
}
