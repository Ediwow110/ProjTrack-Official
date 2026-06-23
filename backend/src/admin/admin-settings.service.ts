import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsRepository } from '../repositories/settings.repository';
import { AcademicStructureRepository } from '../repositories/academic-structure.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsRepository: SettingsRepository,
    private readonly academicStructureRepository: AcademicStructureRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Academic Settings
  // ---------------------------------------------------------------------------

  async getAcademicSettings() {
    return this.settingsRepository.getAcademicSettings();
  }

  async saveAcademicSettings(payload: any, actor?: AdminActorContext) {
    const saved = await this.settingsRepository.saveAcademicSettings(payload);
    if (saved?.schoolYear) {
      await this.academicStructureRepository.ensureAcademicYear(saved.schoolYear, 'ACTIVE');
    }
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Academic Settings',
      target: 'Academic term configuration',
      result: 'Success',
      details: `Academic settings updated${actor?.actorEmail ? ` by ${actor.actorEmail}` : ''}.`,
      ipAddress: actor?.ipAddress,
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // System Settings
  // ---------------------------------------------------------------------------

  async getSystemSettings() {
    return this.settingsRepository.getSystemSettings();
  }

  async saveSystemSettings(payload: any, actor?: AdminActorContext) {
    const saved = await this.settingsRepository.saveSystemSettings(payload);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Settings',
      target: 'System settings',
      result: 'Success',
      details: `System settings updated${actor?.actorEmail ? ` by ${actor.actorEmail}` : ''}.`,
      ipAddress: actor?.ipAddress,
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Academic Years
  // ---------------------------------------------------------------------------

  async academicYears(search?: string) {
    return this.academicStructureRepository.listAcademicYears(search);
  }

  async createAcademicYear(payload: { name?: string; status?: string }) {
    const created = await this.academicStructureRepository.createAcademicYear(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Academic Years',
      target: created.name,
      entityId: created.id,
      result: 'Success',
      details: `Academic year created with ${created.status.toLowerCase()} status.`,
    });
    return created;
  }

  async deleteAcademicYear(id: string, actor?: AdminActorContext) {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found.');
    const result = await this.academicStructureRepository.deleteAcademicYear(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Academic Years',
      target: year.name,
      entityId: id,
      result: 'Success',
      details: 'Academic year deleted.',
      ipAddress: actor?.ipAddress,
    });
    return result;
  }

  async createAcademicYearLevel(payload: {
    academicYearId?: string;
    name?: string;
    sortOrder?: number | string;
    courseId?: string;
  }) {
    const created = await this.academicStructureRepository.createAcademicYearLevel(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Academic Years',
      target: `${created.academicYear} / ${created.name}`,
      entityId: created.id,
      result: 'Success',
      details: 'Academic year level created.',
    });
    return created;
  }

  async deleteAcademicYearLevel(id: string, actor?: AdminActorContext) {
    const level = await this.prisma.academicYearLevel.findUnique({ where: { id } });
    if (!level) throw new NotFoundException('Year level not found.');
    const result = await this.academicStructureRepository.deleteAcademicYearLevel(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Academic Years',
      target: level.name,
      entityId: id,
      result: 'Success',
      details: 'Academic year level deleted.',
      ipAddress: actor?.ipAddress,
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------------

  async departments(search?: string) {
    return this.academicStructureRepository.listDepartments(search);
  }

  async department(id: string) {
    return this.academicStructureRepository.getDepartment(id);
  }

  async createDepartment(
    payload: { name?: string; description?: string },
    actor?: AdminActorContext,
  ) {
    const created = await this.academicStructureRepository.createDepartment(payload);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'CREATE',
      module: 'Departments',
      target: created.name,
      entityId: created.id,
      result: 'Success',
      details: 'Department catalog entry created.',
      ipAddress: actor?.ipAddress,
    });
    return created;
  }

  async updateDepartment(
    id: string,
    payload: { name?: string; description?: string },
    actor?: AdminActorContext,
  ) {
    const before = await this.academicStructureRepository.getDepartment(id);
    const updated = await this.academicStructureRepository.updateDepartment(id, payload);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'UPDATE',
      module: 'Departments',
      target: updated.name,
      entityId: updated.id,
      result: 'Success',
      details:
        before.name === updated.name
          ? 'Department catalog entry updated.'
          : `Department renamed from ${before.name} to ${updated.name}.`,
      beforeValue: JSON.stringify({
        name: before.name,
        description: before.description ?? '',
      }),
      afterValue: JSON.stringify({
        name: updated.name,
        description: updated.description ?? '',
      }),
      ipAddress: actor?.ipAddress,
    });
    return updated;
  }

  async deleteDepartment(
    id: string,
    confirmation?: string,
    actor?: AdminActorContext,
  ) {
    const normalizedConfirmation = String(confirmation ?? '').trim().toUpperCase();
    if (normalizedConfirmation !== 'DELETE DEPARTMENT') {
      throw new BadRequestException(
        'Type DELETE DEPARTMENT to confirm deleting a department.',
      );
    }

    const existing = await this.academicStructureRepository.getDepartment(id);
    const result = await this.academicStructureRepository.deleteDepartment(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Departments',
      target: existing.name,
      entityId: existing.id,
      result: 'Success',
      details: 'Department catalog entry deleted.',
      ipAddress: actor?.ipAddress,
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Courses
  // ---------------------------------------------------------------------------

  async listCourses(academicYearId: string) {
    return this.academicStructureRepository.listCourses(academicYearId);
  }

  async createCourse(
    payload: {
      academicYearId: string;
      name?: string;
      code?: string;
      description?: string;
      sortOrder?: number;
    },
    actor?: AdminActorContext,
  ) {
    const created = await this.academicStructureRepository.createCourse(payload);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'CREATE',
      module: 'Courses',
      target: created.name,
      entityId: created.id,
      result: 'Success',
      details: 'Course created.',
      ipAddress: actor?.ipAddress,
    });
    return created;
  }

  async deleteCourse(id: string, actor?: AdminActorContext) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found.');
    const result = await this.academicStructureRepository.deleteCourse(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Courses',
      target: course.name,
      entityId: id,
      result: 'Success',
      details: 'Course deleted.',
      ipAddress: actor?.ipAddress,
    });
    return result;
  }
}
