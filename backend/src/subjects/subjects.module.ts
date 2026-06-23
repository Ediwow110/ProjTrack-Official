import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { StudentSubjectsService } from './student-subjects.service';
import { TeacherSubjectsService } from './teacher-subjects.service';
import { SubjectGroupsService } from './subject-groups.service';
import { MailModule } from '../mail/mail.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [MailModule, AuditLogsModule],
  controllers: [SubjectsController],
  providers: [StudentSubjectsService, TeacherSubjectsService, SubjectGroupsService],
  exports: [StudentSubjectsService, TeacherSubjectsService, SubjectGroupsService],
})
export class SubjectsModule {}
