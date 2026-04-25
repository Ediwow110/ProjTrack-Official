import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Roles('STUDENT')
  @Get('student/profile')
  studentProfile(@Req() req: any) {
    return this.profiles.studentProfile(req.user?.sub);
  }

  @Roles('TEACHER')
  @Get('teacher/profile')
  teacherProfile(@Req() req: any) {
    return this.profiles.teacherProfile(req.user?.sub);
  }

  @Roles('ADMIN')
  @Get('admin/profile')
  adminProfile(@Req() req: any) {
    return this.profiles.adminProfile(req.user?.sub);
  }

  @Roles('STUDENT')
  @Patch('student/profile')
  updateStudentProfile(@Req() req: any, @Body() body: any) {
    return this.profiles.updateStudentProfile(req.user?.sub, body);
  }

  @Roles('TEACHER')
  @Patch('teacher/profile')
  updateTeacherProfile(@Req() req: any, @Body() body: any) {
    return this.profiles.updateTeacherProfile(req.user?.sub, body);
  }

  @Roles('ADMIN')
  @Patch('admin/profile')
  updateAdminProfile(@Req() req: any, @Body() body: any) {
    return this.profiles.updateAdminProfile(req.user?.sub, body);
  }

  @Roles('STUDENT')
  @Post('student/profile/change-password')
  changeStudentPassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.profiles.changePassword(req.user?.sub, body);
  }

  @Roles('TEACHER')
  @Post('teacher/profile/change-password')
  changeTeacherPassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.profiles.changePassword(req.user?.sub, body);
  }

  @Roles('ADMIN')
  @Post('admin/profile/change-password')
  changeAdminPassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.profiles.changePassword(req.user?.sub, body);
  }
}
