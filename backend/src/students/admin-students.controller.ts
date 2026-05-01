import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Controller, Post, Param, Body, Req, Get, UseGuards } from '@nestjs/common';
// import { ApiOperation } from '@nestjs/swagger';
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
  // @ApiOperation({ summary: 'Activate a student account' })
  async activate(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.activateStudent(id, req.user?.sub);
  }

  @Post(':id/send-setup-invite')
  // @ApiOperation({ summary: 'Send setup invitation email to student' })
  async sendSetupInvite(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.sendSetupInvite(id, req.user?.sub);
  }

  @Post(':id/send-reset-link')
  // @ApiOperation({ summary: 'Send password reset link to student' })
  async sendResetLink(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.sendResetLink(id, req.user?.sub);
  }
}
