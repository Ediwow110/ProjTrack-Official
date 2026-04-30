import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { MailModule } from '../mail/mail.module';
import { BackupsModule } from '../backups/backups.module';

@Module({
  imports: [PrismaModule, FilesModule, MailModule, BackupsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
