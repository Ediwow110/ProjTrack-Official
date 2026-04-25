import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UseGuards, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdminStudentsService } from './admin-students.service';
import { ImportStudentsDto } from './dto/import-students.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/students')
export class AdminStudentsController {
  constructor(private readonly studentsService: AdminStudentsService) {}

  @Get('template')
  template() {
    return this.studentsService.template();
  }

  @Post('import')
  importStudents(@Body() body: ImportStudentsDto) {
    return this.studentsService.importPreview(body);
  }

  @Post('import/confirm')
  confirmImport(@Body() body: ConfirmImportDto) {
    return this.studentsService.confirmImport(body);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.studentsService.activateStudent(id);
  }

  @Post(':id/send-reset-link')
  sendResetLink(@Param('id') id: string) {
    return this.studentsService.sendResetLink(id);
  }
}
