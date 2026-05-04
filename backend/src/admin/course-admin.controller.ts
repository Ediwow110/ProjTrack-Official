import { UseGuards, Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { AdminService } from './admin.service';
import { CreateCourseDto } from './dto/admin-mutation.dto';

/**
 * CourseAdminController — handles course CRUD under an academic year.
 *
 * Routes:
 *   GET    /admin/academic-years/:yearId/courses
 *   POST   /admin/academic-years/:yearId/courses
 *   DELETE /admin/academic-years/:yearId/courses/:courseId
 *
 * Registered with @Controller('admin/academic-years') so Express sees a
 * clean, un-nested path prefix — avoiding any potential route-registration
 * ordering issues that arise when long sub-paths are declared inside the
 * catch-all AdminController('@Controller(admin)').
 */
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/academic-years')
export class CourseAdminController {
  constructor(private readonly admin: AdminService) {}

  private actorContext(req: any) {
    return {
      actorUserId: String(req?.user?.sub ?? '').trim() || undefined,
      actorEmail: String(req?.user?.email ?? '').trim() || undefined,
      actorRole: String(req?.user?.role ?? 'ADMIN').trim() || 'ADMIN',
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']) : undefined,
    };
  }

  @Get(':yearId/courses')
  listCourses(@Param('yearId') yearId: string) {
    return this.admin.listCourses(yearId);
  }

  @Post(':yearId/courses')
  createCourse(@Param('yearId') yearId: string, @Body() body: CreateCourseDto, @Req() req?: any) {
    return this.admin.createCourse({ ...body, academicYearId: yearId }, this.actorContext(req));
  }

  @Delete(':yearId/courses/:courseId')
  deleteCourse(@Param('yearId') yearId: string, @Param('courseId') courseId: string, @Req() req?: any) {
    return this.admin.deleteCourse(courseId, this.actorContext(req));
  }
}
