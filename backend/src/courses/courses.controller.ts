import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { CreateCourseDto } from '../admin/dto/admin-mutation.dto';

/**
 * CoursesController — standalone module registered in AppModule.
 *
 * Handles course CRUD independently of AdminModule so that AdminModule
 * route-registration quirks cannot affect these endpoints.
 *
 * Routes (all guarded by JwtAuthGuard + ADMIN role):
 *   GET    /admin/academic-years/:yearId/courses
 *   POST   /admin/academic-years/:yearId/courses
 *   DELETE /admin/academic-years/:yearId/courses/:courseId
 *
 * AdminOpsRepository is injected via the global RepositoriesModule —
 * no explicit import needed in CoursesModule.
 */
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/academic-years')
export class CoursesController {
  constructor(private readonly repo: AdminOpsRepository) {}

  @Get(':yearId/courses')
  listCourses(@Param('yearId') yearId: string) {
    return this.repo.listCourses(yearId);
  }

  @Post(':yearId/courses')
  createCourse(
    @Param('yearId') yearId: string,
    @Body() body: CreateCourseDto,
    @Req() req?: any,
  ) {
    return this.repo.createCourse({ ...body, academicYearId: yearId });
  }

  @Delete(':yearId/courses/:courseId')
  deleteCourse(
    @Param('yearId') yearId: string,
    @Param('courseId') courseId: string,
    @Req() req?: any,
  ) {
    return this.repo.deleteCourse(courseId);
  }
}
