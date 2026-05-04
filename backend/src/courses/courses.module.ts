import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';

/**
 * CoursesModule — standalone module for academic year course management.
 * Registered directly in AppModule; does not depend on AdminModule.
 * AdminOpsRepository is available via the global RepositoriesModule.
 */
@Module({
  controllers: [CoursesController],
})
export class CoursesModule {}
