import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
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

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('storage')
  storage() {
    return this.health.storage();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('mail')
  mail() {
    return this.health.mailStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('configuration')
  configuration() {
    return this.health.configuration();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('database')
  database() {
    return this.health.database();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Get('backups')
  backups() {
    return this.health.backupStatus();
  }
}
