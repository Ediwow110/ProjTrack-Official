import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicStructureRepository } from '../repositories/academic-structure.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildMasterListFileName, buildMasterListWorkbookBuffer } from '../common/utils/master-list-export';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminSectionsService {
  private readonly logger = new Logger(AdminSectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicStructureRepository: AcademicStructureRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async sections(search?: string, academicYearId?: string) {
    return this.academicStructureRepository.listSections({ search, academicYearId });
  }

  async createSection(payload: {
    code?: string;
    program?: string;
    adviserName?: string;
    description?: string;
    yearLevelId?: string;
    yearLevelName?: string;
    yearLevel?: number | string;
    academicYearId?: string;
    academicYear?: string;
  }) {
    const created = await this.academicStructureRepository.createSection(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Sections',
      target: created.code,
      entityId: created.id,
      result: 'Success',
      details: `Section created for ${created.academicYear} / ${created.yearLevel}.`,
    });
    return { success: true, id: created.id, code: created.code, academicYear: created.academicYear };
  }

  async sectionMasterList(sectionId: string) {
    return this.academicStructureRepository.getSectionMasterList(sectionId);
  }

  async sectionMasterListExport(sectionId: string) {
    const masterList = await this.academicStructureRepository.getSectionMasterList(sectionId);
    const fileName = buildMasterListFileName({
      academicYear: masterList.section.academicYear,
      course: masterList.section.course,
      yearLevel: masterList.section.yearLevel,
      section: masterList.section.name,
      adviser: masterList.section.adviser,
    });
    return {
      fileName,
      buffer: await buildMasterListWorkbookBuffer(
        {
          academicYear: masterList.section.academicYear,
          course: masterList.section.course,
          yearLevel: masterList.section.yearLevel,
          section: masterList.section.name,
          adviser: masterList.section.adviser,
        },
        masterList.rows,
      ),
    };
  }

  async deleteSection(id: string, actor?: AdminActorContext) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) throw new NotFoundException('Section not found.');
    const result = await this.academicStructureRepository.deleteSection(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Sections',
      target: section.name,
      entityId: id,
      result: 'Success',
      details: 'Section deleted.',
      ipAddress: actor?.ipAddress,
    });
    return result;
  }

  async moveStudents(sourceSectionId: string, destSectionId: string, ids: string[]) {
    const result = await this.academicStructureRepository.moveStudents(sourceSectionId, destSectionId, ids);
    const sourceSection = result.sections.find((section: any) => section.id === sourceSectionId);
    const destSection = result.sections.find((section: any) => section.id === destSectionId);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'MOVE',
      module: 'Students',
      target: `${ids.length} students`,
      result: 'Success',
      details: `Moved ${ids.length} students from ${sourceSection?.code ?? sourceSectionId} to ${destSection?.code ?? destSectionId}.`,
    });
    return result;
  }

  async getBulkMoveData() {
    return this.academicStructureRepository.getBulkMoveData();
  }
}
