import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

@Injectable()
export class AcademicStructureRepository {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSearch(search?: string) {
    return String(search ?? '').trim().toLowerCase();
  }

  private normalizeDepartmentName(value?: string | null) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private departmentKey(value?: string | null) {
    return this.normalizeDepartmentName(value).toLowerCase();
  }

  private buildLegacyDepartmentId(name: string) {
    const slug = this.departmentKey(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `legacy:${slug || 'department'}`;
  }

  private async findLegacyDepartmentName(requestedName: string) {
    const key = this.departmentKey(requestedName);
    if (!key) return null;

    const teacherProfiles = await this.prisma.teacherProfile.findMany({
      where: {
        department: {
          not: null,
        },
      },
      select: {
        department: true,
      },
    });

    const match = teacherProfiles.find(
      (teacherProfile) => this.departmentKey(teacherProfile.department) === key,
    );

    return match?.department ? this.normalizeDepartmentName(match.department) : null;
  }

  private toTitleWords(value?: string | null) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private normalizeAcademicYearLabel(value?: string | null) {
    return String(value ?? '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatAcademicYearStatus(status?: string | null) {
    const normalized = String(status ?? '').trim().toUpperCase();
    if (normalized === 'ACTIVE') return 'Active';
    if (normalized === 'ARCHIVED') return 'Archived';
    if (normalized === 'UPCOMING') return 'Upcoming';
    return this.toTitleWords(normalized);
  }

  private formatYearLevel(value?: number | string | null) {
    const parsed =
      typeof value === 'number' && Number.isInteger(value)
        ? value
        : Number(value ?? 0) || 0;
    if (!parsed) return '';
    const suffix =
      parsed % 10 === 1 && parsed % 100 !== 11
        ? 'st'
        : parsed % 10 === 2 && parsed % 100 !== 12
          ? 'nd'
          : parsed % 10 === 3 && parsed % 100 !== 13
            ? 'rd'
            : 'th';
    return `${parsed}${suffix} Year`;
  }

  private normalizeYearLevelLabel(value?: string | number | null) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const numericMatch = raw.match(/^(\d+)(?:st|nd|rd|th)?(?:\s+year)?$/i);
    if (numericMatch?.[1]) {
      return this.formatYearLevel(Number(numericMatch[1]));
    }

    return raw
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((chunk) => (chunk ? chunk.charAt(0).toUpperCase() + chunk.slice(1) : chunk))
      .join(' ');
  }

  private parseYearLevelNumber(value?: string | number | null) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const match = raw.match(/^(\d+)(?:st|nd|rd|th)?(?:\s+year)?$/i);
    if (!match?.[1]) return null;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private normalizeCourseLabel(value?: string | null) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private matchesCourse(left?: string | null, right?: string | null) {
    const leftValue = this.normalizeCourseLabel(left).toLowerCase();
    const rightValue = this.normalizeCourseLabel(right).toLowerCase();
    return Boolean(leftValue) && Boolean(rightValue) && leftValue === rightValue;
  }

  private sectionMatchesYearLevel(
    section: {
      academicYearLevelId?: string | null;
      yearLevel?: number | null;
      yearLevelName?: string | null;
      academicYearLevel?: { id?: string | null; name?: string | null } | null;
    },
    input: { academicYearLevelId?: string; yearLevel?: number | null; yearLevelLabel?: string },
  ) {
    const requestedLevelId = String(input.academicYearLevelId ?? '').trim();
    if (requestedLevelId) {
      return (
        String(section.academicYearLevelId ?? '').trim() === requestedLevelId ||
        String(section.academicYearLevel?.id ?? '').trim() === requestedLevelId
      );
    }

    if (input.yearLevel !== null && input.yearLevel !== undefined) {
      if (Number(section.yearLevel ?? 0) === input.yearLevel) {
        return true;
      }
    }

    const requestedLabel = this.normalizeYearLevelLabel(input.yearLevelLabel);
    if (!requestedLabel) return false;

    const sectionLabels = [
      section.academicYearLevel?.name,
      section.yearLevelName,
      this.formatYearLevel(section.yearLevel),
    ]
      .map((value) => this.normalizeYearLevelLabel(value))
      .filter(Boolean);

    return sectionLabels.includes(requestedLabel);
  }

  private describePlacementSectionMismatch(input: {
    academicYear?: string | null;
    course?: string | null;
    yearLevel?: string | null;
    section?: string | null;
  }) {
    const sectionName = String(input.section ?? '').trim() || 'The selected section';
    const parts = [
      String(input.course ?? '').trim(),
      String(input.yearLevel ?? '').trim(),
      String(input.academicYear ?? '').trim(),
    ].filter(Boolean);

    if (parts.length === 0) {
      return `${sectionName} does not belong to the selected academic structure.`;
    }

    return `${sectionName} does not belong to ${parts.join(' / ')}.`;
  }

  private extractYearLevel(sectionName?: string | null) {
    const match = String(sectionName ?? '').match(/\b(\d)\b/);
    return match ? Number(match[1]) : null;
  }

  private resolveYearLevelLabel(input: {
    yearLevelName?: string | null;
    yearLevel?: string | number | null;
    sectionName?: string | null;
  }) {
    const direct = this.normalizeYearLevelLabel(input.yearLevelName);
    if (direct) return direct;

    const fromValue = this.normalizeYearLevelLabel(input.yearLevel);
    if (fromValue) return fromValue;

    const extracted = this.extractYearLevel(input.sectionName);
    return extracted ? this.formatYearLevel(extracted) : '';
  }

  private async ensureAcademicYearLevel(
    academicYearId: string,
    label: string,
    sortOrder?: number | null,
  ) {
    const normalizedLabel = this.normalizeYearLevelLabel(label);
    if (!academicYearId || !normalizedLabel) return null;

    return this.prisma.academicYearLevel.upsert({
      where: {
        academicYearId_name: {
          academicYearId,
          name: normalizedLabel,
        },
      },
      update: {},
      create: {
        academicYearId,
        name: normalizedLabel,
        sortOrder: sortOrder ?? this.parseYearLevelNumber(normalizedLabel) ?? undefined,
      },
    });
  }

  private async syncLegacyAcademicYearLevels() {
    const legacySections = await this.prisma.section.findMany({
      where: { academicYearId: { not: null } },
      select: {
        id: true,
        academicYearId: true,
        academicYearLevelId: true,
        yearLevel: true,
        yearLevelName: true,
        name: true,
      },
    });

    for (const section of legacySections) {
      const academicYearId = String(section.academicYearId ?? '').trim();
      if (!academicYearId) continue;

      const label = this.resolveYearLevelLabel({
        yearLevelName: section.yearLevelName,
        yearLevel: section.yearLevel,
        sectionName: section.name,
      });
      if (!label) continue;

      const level = await this.ensureAcademicYearLevel(
        academicYearId,
        label,
        this.parseYearLevelNumber(label),
      );
      if (!level) continue;

      if (
        String(section.academicYearLevelId ?? '') !== level.id ||
        String(section.yearLevelName ?? '').trim() !== level.name
      ) {
        await this.prisma.section.update({
          where: { id: section.id },
          data: {
            academicYearLevelId: level.id,
            yearLevelName: level.name,
            yearLevel: section.yearLevel ?? this.parseYearLevelNumber(level.name),
          },
        });
      }
    }

    const legacyStudents = await this.prisma.studentProfile.findMany({
      where: { academicYearId: { not: null } },
      include: {
        section: true,
        academicYearLevel: true,
      },
    });

    for (const student of legacyStudents) {
      const academicYearId = String(
        student.academicYearId ?? student.section?.academicYearId ?? '',
      ).trim();
      if (!academicYearId) continue;

      const label = this.resolveYearLevelLabel({
        yearLevelName: student.yearLevelName ?? student.section?.yearLevelName,
        yearLevel: student.yearLevel ?? student.section?.yearLevel,
        sectionName: student.section?.name,
      });
      if (!label) continue;

      const level = await this.ensureAcademicYearLevel(
        academicYearId,
        label,
        this.parseYearLevelNumber(label),
      );
      if (!level) continue;

      if (
        String(student.academicYearLevelId ?? '') !== level.id ||
        String(student.yearLevelName ?? '').trim() !== level.name
      ) {
        await this.prisma.studentProfile.update({
          where: { id: student.id },
          data: {
            academicYearId,
            academicYearLevelId: level.id,
            yearLevelName: level.name,
            yearLevel: student.yearLevel ?? this.parseYearLevelNumber(level.name),
          },
        });
      }
    }
  }

  private async buildDepartmentCatalog() {
    const [departments, teacherProfiles, subjects] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.teacherProfile.findMany({
        select: {
          department: true,
        },
      }),
      this.prisma.subject.findMany({
        include: {
          teacher: {
            select: {
              department: true,
            },
          },
        },
      }),
    ]);

    const catalog = new Map<
      string,
      {
        id: string;
        name: string;
        description: string;
        teachers: number;
        subjects: number;
        isLegacy: boolean;
      }
    >();

    for (const department of departments) {
      const name = this.normalizeDepartmentName(department.name);
      const key = this.departmentKey(name);
      if (!key) continue;

      catalog.set(key, {
        id: department.id,
        name,
        description: String(department.description ?? '').trim(),
        teachers: 0,
        subjects: 0,
        isLegacy: false,
      });
    }

    for (const teacherProfile of teacherProfiles) {
      const name = this.normalizeDepartmentName(teacherProfile.department);
      const key = this.departmentKey(name);
      if (!key) continue;

      const current =
        catalog.get(key) ??
        {
          id: this.buildLegacyDepartmentId(name),
          name,
          description: '',
          teachers: 0,
          subjects: 0,
          isLegacy: true,
        };

      current.teachers += 1;
      catalog.set(key, current);
    }

    for (const subject of subjects) {
      const name = this.normalizeDepartmentName(subject.teacher?.department);
      const key = this.departmentKey(name);
      if (!key) continue;

      const current =
        catalog.get(key) ??
        {
          id: this.buildLegacyDepartmentId(name),
          name,
          description: '',
          teachers: 0,
          subjects: 0,
          isLegacy: true,
        };

      current.subjects += 1;
      catalog.set(key, current);
    }

    return Array.from(catalog.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  private async resolveDepartmentCatalogRecord(id: string) {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId) {
      throw new NotFoundException('Department not found.');
    }

    const catalog = await this.buildDepartmentCatalog();
    const match = catalog.find((department) => department.id === normalizedId);
    if (!match) {
      throw new NotFoundException('Department not found.');
    }
    return match;
  }

  // ---------------------------------------------------------------------------
  // Academic Years
  // ---------------------------------------------------------------------------

  async getActiveAcademicYear() {
    const active = await this.prisma.academicYear.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (active) return active;

    const settings = await this.getAcademicSettings();
    const preferredName = this.normalizeAcademicYearLabel(settings?.schoolYear);
    if (preferredName) {
      return this.ensureAcademicYear(preferredName, 'ACTIVE');
    }

    const fallbackName = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    return this.ensureAcademicYear(fallbackName, 'ACTIVE');
  }

  async ensureAcademicYear(name: string, preferredStatus: 'ACTIVE' | 'ARCHIVED' | 'UPCOMING' = 'UPCOMING') {
    const normalizedName = this.normalizeAcademicYearLabel(name);
    if (!normalizedName) {
      throw new BadRequestException('Academic year is required.');
    }

    const existing = await this.prisma.academicYear.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (!existing) {
      const created = await this.prisma.academicYear.create({
        data: {
          name: normalizedName,
          status: preferredStatus,
        },
      });
      if (preferredStatus === 'ACTIVE') {
        await this.prisma.academicYear.updateMany({
          where: { id: { not: created.id }, status: 'ACTIVE' },
          data: { status: 'UPCOMING' },
        });
      }
      return created;
    }

    if (preferredStatus === 'ACTIVE' && existing.status !== 'ACTIVE') {
      await this.prisma.$transaction([
        this.prisma.academicYear.updateMany({
          where: { id: { not: existing.id }, status: 'ACTIVE' },
          data: { status: 'UPCOMING' },
        }),
        this.prisma.academicYear.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE' },
        }),
      ]);
      return this.prisma.academicYear.findUnique({ where: { id: existing.id } });
    }

    return existing;
  }

  async createAcademicYear(payload: { name?: string; status?: string }) {
    const name = this.normalizeAcademicYearLabel(payload.name);
    const normalizedStatus = String(payload.status ?? '').trim().toUpperCase();

    if (!/^\d{4}-\d{4}$/.test(name)) {
      throw new BadRequestException('Academic year must use the format YYYY-YYYY.');
    }

    const [startYear, endYear] = name.split('-').map((value) => Number(value));
    if (!startYear || !endYear || endYear !== startYear + 1) {
      throw new BadRequestException('Academic year must span consecutive years.');
    }

    const existing = await this.prisma.academicYear.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new ConflictException('That academic year already exists.');
    }

    const currentActive = await this.prisma.academicYear.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const status =
      normalizedStatus === 'ARCHIVED' || normalizedStatus === 'UPCOMING' || normalizedStatus === 'ACTIVE'
        ? normalizedStatus
        : currentActive
          ? 'UPCOMING'
          : 'ACTIVE';

    const created = await this.prisma.academicYear.create({
      data: {
        name,
        status: status as 'ACTIVE' | 'ARCHIVED' | 'UPCOMING',
      },
    });

    if (status === 'ACTIVE') {
      await this.prisma.$transaction([
        this.prisma.academicYear.updateMany({
          where: { id: { not: created.id }, status: 'ACTIVE' },
          data: { status: 'UPCOMING' },
        }),
        this.prisma.academicSetting.updateMany({
          data: { schoolYear: created.name },
        }),
      ]);
    }

    return {
      success: true,
      id: created.id,
      name: created.name,
      status: this.formatAcademicYearStatus(created.status),
    };
  }

  async deleteAcademicYear(id: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!year) throw new NotFoundException('Academic year not found.');
    if (year._count.students > 0) {
      throw new ConflictException(
        `Cannot delete academic year "${year.name}" — it still has ${year._count.students} enrolled student(s). Remove or move students first.`,
      );
    }
    await this.prisma.section.deleteMany({ where: { academicYearId: id } });
    await this.prisma.academicYearLevel.deleteMany({ where: { academicYearId: id } });
    await this.prisma.academicYear.delete({ where: { id } });
    return { success: true, id };
  }

  async createAcademicYearLevel(payload: {
    academicYearId?: string;
    courseId?: string;
    name?: string;
    sortOrder?: number | string;
  }) {
    const academicYearId = String(payload.academicYearId ?? '').trim();
    const name = this.normalizeYearLevelLabel(payload.name);
    if (!academicYearId) {
      throw new BadRequestException('Academic year is required.');
    }
    if (!name) {
      throw new BadRequestException('Year level name is required.');
    }

    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!academicYear) {
      throw new BadRequestException('Academic year not found.');
    }

    const existing = await this.prisma.academicYearLevel.findFirst({
      where: {
        academicYearId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new ConflictException('That year level already exists for this academic year.');
    }

    const numericSort = this.parseYearLevelNumber(name);
    const courseId = payload.courseId ? String(payload.courseId).trim() : undefined;
    if (courseId) {
      const course = await this.prisma.course.findFirst({ where: { id: courseId, academicYearId } });
      if (!course) throw new BadRequestException('Course not found in this academic year.');
    }
    const created = await this.prisma.academicYearLevel.create({
      data: {
        academicYearId,
        courseId: courseId || null,
        name,
        sortOrder:
          payload.sortOrder === undefined || payload.sortOrder === null || payload.sortOrder === ''
            ? numericSort ?? undefined
            : Number(payload.sortOrder),
      },
    });

    return {
      success: true,
      id: created.id,
      name: created.name,
      academicYearId,
      academicYear: academicYear.name,
    };
  }

  async deleteAcademicYearLevel(id: string) {
    const level = await this.prisma.academicYearLevel.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!level) throw new NotFoundException('Year level not found.');
    if (level._count.students > 0) {
      throw new ConflictException(
        `Cannot delete year level "${level.name}" — it still has ${level._count.students} enrolled student(s). Remove or move students first.`,
      );
    }
    await this.prisma.section.deleteMany({ where: { academicYearLevelId: id } });
    await this.prisma.academicYearLevel.delete({ where: { id } });
    return { success: true, id };
  }

  async listAcademicYears(search?: string) {
    await this.syncLegacyAcademicYearLevels();
    const [years, sections] = await Promise.all([
      this.prisma.academicYear.findMany({
        include: {
          courses: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
          levels: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: [{ status: 'asc' }, { name: 'desc' }],
      }),
      this.listSections(),
    ]);
    const q = this.normalizeSearch(search);

    return years
      .map((year) => {
        const yearSections = sections.filter((section) => section.academicYearId === year.id);
        const levelSummaries = year.levels.map((level) => {
          const sectionsForLevel = yearSections.filter(
            (section) =>
              section.yearLevelId === level.id ||
              String(section.yearLevelName || section.yearLevelLabel || '').trim().toLowerCase() ===
                level.name.toLowerCase(),
          );

          return {
            id: level.id,
            name: level.name,
            sectionCount: sectionsForLevel.length,
            studentCount: sectionsForLevel.reduce(
              (total, section) => total + Number(section.students || 0),
              0,
            ),
          };
        });

        const courseCount = new Set(
          yearSections.map((section) => String(section.program || '').trim()).filter(Boolean),
        ).size;

        const courseSummaries = (year as any).courses.map((course: any) => {
          const courseLevels = year.levels.filter((l: any) => l.courseId === course.id);
          const courseSections = yearSections.filter((s) =>
            courseLevels.some((l: any) => l.id === s.yearLevelId),
          );
          return {
            id: course.id,
            name: course.name,
            code: course.code ?? null,
            description: course.description ?? null,
            sortOrder: course.sortOrder ?? null,
            yearLevelCount: courseLevels.length,
            sectionCount: courseSections.length,
            studentCount: courseSections.reduce((t, s) => t + Number(s.students || 0), 0),
          };
        });

        const courseLevelSummaries = levelSummaries.map((level) => {
          const rawLevel = year.levels.find((l: any) => l.id === level.id);
          return { ...level, courseId: (rawLevel as any)?.courseId ?? null };
        });

        return {
          id: year.id,
          name: year.name,
          status: this.formatAcademicYearStatus(year.status),
          sectionCount: yearSections.length,
          studentCount: yearSections.reduce((total, section) => total + Number(section.students || 0), 0),
          courseCount: courseSummaries.length || courseCount,
          yearLevelCount: courseLevelSummaries.length,
          yearLevels: courseLevelSummaries,
          courses: courseSummaries,
        };
      })
      .filter((year) => {
        if (!q) return true;
        if (year.name.toLowerCase().includes(q)) return true;
        return year.yearLevels.some((yearLevel) => yearLevel.name.toLowerCase().includes(q));
      });
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  async listSections(filters: { search?: string; academicYearId?: string } = {}) {
    await this.syncLegacyAcademicYearLevels();
    const q = this.normalizeSearch(filters.search);
    const sections = await this.prisma.section.findMany({
      where: {
        academicYearId: String(filters.academicYearId ?? '').trim() || undefined,
      },
      include: {
        academicYear: true,
        academicYearLevel: true,
        students: true,
        enrollments: true,
      },
    });

    const subjects = await this.prisma.subject.findMany({
      include: {
        teacher: { include: { user: { select: SAFE_USER_SELECT } } },
        enrollments: { include: { section: true } },
      },
    });

    return sections
      .map((section) => {
        const relatedSubjects = subjects.filter((subject) =>
          subject.enrollments.some((enrollment) => enrollment.section?.id === section.id),
        );
        const adviser =
          String(section.adviserName ?? '').trim() ||
          (relatedSubjects[0]?.teacher?.user
            ? `${relatedSubjects[0].teacher.user.firstName} ${relatedSubjects[0].teacher.user.lastName}`.trim()
            : 'Unassigned');

        const program = section.course || section.name.split(' ')[0] || 'Program';
        const yearLevel = section.yearLevel ?? this.extractYearLevel(section.name) ?? null;
        const yearLevelLabel =
          section.academicYearLevel?.name ||
          section.yearLevelName ||
          this.formatYearLevel(yearLevel);
        const academicYear = section.academicYear?.name || 'Unassigned';

        return {
          id: section.id,
          code: section.name,
          program,
          course: program,
          yearLevel: yearLevel ? String(yearLevel) : '',
          yearLevelId: section.academicYearLevelId || '',
          yearLevelLabel,
          yearLevelName: yearLevelLabel,
          adviser,
          students: section.students.length,
          subjects: relatedSubjects.length,
          ay: academicYear,
          academicYear,
          academicYearId: section.academicYearId || '',
          academicYearStatus: this.formatAcademicYearStatus(section.academicYear?.status),
          description: section.description || '',
          status: this.formatAcademicYearStatus(section.academicYear?.status),
        };
      })
      .filter((row) => {
        if (!q) return true;
        return [row.code, row.program, row.adviser, row.academicYear].some((value) =>
          String(value || '').toLowerCase().includes(q),
        );
      })
      .sort((left, right) => {
        const yearCompare = String(right.academicYear || '').localeCompare(String(left.academicYear || ''));
        if (yearCompare !== 0) return yearCompare;
        const levelCompare =
          (this.parseYearLevelNumber(left.yearLevelName || left.yearLevelLabel || left.yearLevel) ?? Number.MAX_SAFE_INTEGER) -
          (this.parseYearLevelNumber(right.yearLevelName || right.yearLevelLabel || right.yearLevel) ?? Number.MAX_SAFE_INTEGER);
        if (levelCompare !== 0) return levelCompare;
        const courseCompare = String(left.program || '').localeCompare(String(right.program || ''));
        if (courseCompare !== 0) return courseCompare;
        const levelLabelCompare = String(left.yearLevelName || left.yearLevelLabel || '').localeCompare(
          String(right.yearLevelName || right.yearLevelLabel || ''),
        );
        if (levelLabelCompare !== 0) return levelLabelCompare;
        return left.code.localeCompare(right.code);
      });
  }

  async resolveSectionPlacement(payload: {
    academicYearId?: string;
    academicYear?: string;
    academicYearLevelId?: string;
    yearLevelName?: string;
    course?: string;
    yearLevel?: number | string;
    sectionId?: string;
    section?: string;
    requireSection?: boolean;
    allowCourseWithoutExistingSections?: boolean;
  }) {
    await this.syncLegacyAcademicYearLevels();
    const academicYearId = String(payload.academicYearId ?? '').trim();
    const academicYearName = this.normalizeAcademicYearLabel(payload.academicYear);
    const academicYearLevelId = String(payload.academicYearLevelId ?? '').trim();
    const requestedYearLevelLabel = this.normalizeYearLevelLabel(
      payload.yearLevelName ?? payload.yearLevel,
    );
    const course = this.normalizeCourseLabel(payload.course);
    const yearLevel = this.parseYearLevelNumber(payload.yearLevel ?? payload.yearLevelName);

    const academicYear = academicYearId
      ? await this.prisma.academicYear.findUnique({ where: { id: academicYearId } })
      : academicYearName
        ? await this.prisma.academicYear.findFirst({
            where: {
              name: {
                equals: academicYearName,
                mode: 'insensitive',
              },
            },
          })
        : await this.getActiveAcademicYear();

    if ((academicYearId || academicYearName) && !academicYear) {
      throw new BadRequestException(
        academicYearName
          ? `Academic Year ${academicYearName} does not exist.`
          : 'Academic year not found.',
      );
    }

    const sectionId = String(payload.sectionId ?? '').trim();
    const sectionName = String(payload.section ?? '').trim();
    const sectionById = sectionId
      ? await this.prisma.section.findUnique({
          where: { id: sectionId },
          include: { academicYear: true, academicYearLevel: true },
        })
      : null;
    const academicYearSections = academicYear?.id
      ? await this.prisma.section.findMany({
          where: { academicYearId: academicYear.id },
          include: { academicYear: true, academicYearLevel: true },
        })
      : [];

    const section = sectionById
      ? sectionById
      : sectionName
        ? academicYearSections.find(
            (candidate) =>
              String(candidate.name ?? '').trim().toLowerCase() === sectionName.toLowerCase(),
          ) ?? null
        : null;

    const resolvedCourse =
      course ||
      this.normalizeCourseLabel(section?.course) ||
      this.normalizeCourseLabel(sectionById?.course);
    const courseSections = resolvedCourse
      ? academicYearSections.filter((candidate) => this.matchesCourse(candidate.course, resolvedCourse))
      : academicYearSections;

    if (
      resolvedCourse &&
      academicYear?.name &&
      courseSections.length === 0 &&
      !payload.allowCourseWithoutExistingSections
    ) {
      throw new BadRequestException(
        `Course ${resolvedCourse} does not exist in Academic Year ${academicYear.name}.`,
      );
    }

    let academicYearLevel = academicYearLevelId
      ? await this.prisma.academicYearLevel.findUnique({ where: { id: academicYearLevelId } })
      : requestedYearLevelLabel && academicYear?.id
        ? await this.prisma.academicYearLevel.findFirst({
            where: {
              academicYearId: academicYear.id,
              name: {
                equals: requestedYearLevelLabel,
                mode: 'insensitive',
              },
            },
          })
        : null;

    const requestedYearSections =
      requestedYearLevelLabel || yearLevel !== null
        ? courseSections.filter((candidate) =>
            this.sectionMatchesYearLevel(candidate, {
              academicYearLevelId,
              yearLevel,
              yearLevelLabel: requestedYearLevelLabel,
            }),
          )
        : courseSections;

    if ((academicYearLevelId || requestedYearLevelLabel) && academicYear?.id && !academicYearLevel) {
      const targetCourse = resolvedCourse || 'the selected course';
      throw new BadRequestException(
        requestedYearLevelLabel
          ? `${requestedYearLevelLabel} is not configured for ${targetCourse}.`
          : 'Year level not found for the selected academic year.',
      );
    }

    if (
      (requestedYearLevelLabel || academicYearLevelId) &&
      resolvedCourse &&
      requestedYearSections.length === 0 &&
      !payload.allowCourseWithoutExistingSections
    ) {
      throw new BadRequestException(
        `${requestedYearLevelLabel || academicYearLevel?.name || 'Selected year level'} is not configured for ${resolvedCourse}.`,
      );
    }

    if (!academicYearLevel && requestedYearSections.length > 0) {
      academicYearLevel =
        requestedYearSections.find((candidate) => candidate.academicYearLevel)?.academicYearLevel ??
        null;
    }

    if (
      section &&
      academicYear?.id &&
      section.academicYearId &&
      String(section.academicYearId).trim() !== academicYear.id
    ) {
      throw new BadRequestException(
        this.describePlacementSectionMismatch({
          academicYear: academicYear.name,
          course: resolvedCourse,
          yearLevel: requestedYearLevelLabel || academicYearLevel?.name,
          section: section.name,
        }),
      );
    }

    if (section && resolvedCourse && !this.matchesCourse(section.course, resolvedCourse)) {
      throw new BadRequestException(
        this.describePlacementSectionMismatch({
          academicYear: academicYear?.name,
          course: resolvedCourse,
          yearLevel: requestedYearLevelLabel || academicYearLevel?.name,
          section: section.name,
        }),
      );
    }

    if (
      section &&
      (requestedYearLevelLabel || academicYearLevelId || yearLevel !== null) &&
      !this.sectionMatchesYearLevel(section, {
        academicYearLevelId,
        yearLevel,
        yearLevelLabel: requestedYearLevelLabel || academicYearLevel?.name || undefined,
      })
    ) {
      throw new BadRequestException(
        this.describePlacementSectionMismatch({
          academicYear: academicYear?.name,
          course: resolvedCourse,
          yearLevel: requestedYearLevelLabel || academicYearLevel?.name,
          section: section.name,
        }),
      );
    }

    if (payload.requireSection && !section) {
      throw new BadRequestException(
        this.describePlacementSectionMismatch({
          academicYear: academicYear?.name,
          course: resolvedCourse,
          yearLevel: requestedYearLevelLabel || academicYearLevel?.name,
          section: sectionName,
        }),
      );
    }

    const resolvedYearLevelLabel =
      academicYearLevel?.name ||
      section?.academicYearLevel?.name ||
      section?.yearLevelName ||
      requestedYearLevelLabel ||
      '';

    return {
      academicYear,
      academicYearLevel,
      section,
      course: resolvedCourse || section?.course || null,
      yearLevel: yearLevel ?? section?.yearLevel ?? null,
      yearLevelName: resolvedYearLevelLabel || null,
    };
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
    const code = String(payload.code ?? '').trim();
    const program = String(payload.program ?? '').trim();
    const adviserName = String(payload.adviserName ?? '').trim();
    const description = String(payload.description ?? '').trim();

    if (!code) {
      throw new BadRequestException('Section code is required.');
    }

    const placement = await this.resolveSectionPlacement({
      academicYearId: payload.academicYearId,
      academicYear: payload.academicYear,
      academicYearLevelId: payload.yearLevelId,
      yearLevelName: payload.yearLevelName,
      course: program,
      yearLevel: payload.yearLevel,
      allowCourseWithoutExistingSections: true,
    });

    const academicYear = placement.academicYear ?? (await this.getActiveAcademicYear());
    if (!academicYear?.id) {
      throw new BadRequestException('Create an academic year before adding sections.');
    }

    if (!placement.academicYearLevel) {
      throw new BadRequestException('Create or select a year level before adding sections.');
    }

    const yearLevel = placement.yearLevel;
    const existing = await this.prisma.section.findFirst({
      where: {
        academicYearId: academicYear.id,
        name: {
          equals: code,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new ConflictException('That section already exists for this academic year.');
    }

    const created = await this.prisma.section.create({
      data: {
        name: code,
        academicYearId: academicYear.id,
        academicYearLevelId: placement.academicYearLevel.id,
        course: placement.course,
        yearLevel,
        yearLevelName: placement.academicYearLevel.name,
        adviserName: adviserName || null,
        description: description || null,
      },
    });

    return {
      success: true,
      id: created.id,
      code: created.name,
      academicYear: academicYear.name,
      yearLevel: placement.academicYearLevel.name,
    };
  }

  async getSectionMasterList(sectionId: string) {
    await this.syncLegacyAcademicYearLevels();
    const section = await this.prisma.section.findUnique({
      where: { id: String(sectionId ?? '').trim() },
      include: {
        academicYear: true,
        academicYearLevel: true,
        students: {
          include: {
            user: { select: SAFE_USER_SELECT },
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found.');
    }

    const rows = section.students
      .map((student) => ({
        id: student.userId,
        studentId: student.studentNumber,
        lastName: student.user.lastName,
        firstName: student.user.firstName,
        middleInitial: String(student.middleInitial ?? '').trim(),
        accountStatus: this.toTitleWords(String(student.user.status ?? '').replace(/_/g, ' ')),
      }))
      .sort((left, right) => {
        const lastNameCompare = left.lastName.localeCompare(right.lastName, 'en', {
          sensitivity: 'base',
        });
        if (lastNameCompare !== 0) return lastNameCompare;

        const firstNameCompare = left.firstName.localeCompare(right.firstName, 'en', {
          sensitivity: 'base',
        });
        if (firstNameCompare !== 0) return firstNameCompare;

        const middleInitialCompare = String(left.middleInitial || '').localeCompare(
          String(right.middleInitial || ''),
          'en',
          { sensitivity: 'base' },
        );
        if (middleInitialCompare !== 0) return middleInitialCompare;

        return String(left.studentId || '').localeCompare(String(right.studentId || ''), 'en', {
          sensitivity: 'base',
        });
      });

    return {
      section: {
        id: section.id,
        name: section.name,
        adviser: String(section.adviserName ?? '').trim() || 'Unassigned',
        academicYear: section.academicYear?.name || 'Unassigned',
        yearLevel:
          section.academicYearLevel?.name ||
          section.yearLevelName ||
          this.formatYearLevel(section.yearLevel) ||
          'Unassigned',
        course: section.course || '',
        studentCount: rows.length,
      },
      rows,
    };
  }

  async deleteSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!section) throw new NotFoundException('Section not found.');
    if (section._count.students > 0) {
      throw new ConflictException(
        `Cannot delete section "${section.name}" — it still has ${section._count.students} enrolled student(s). Remove or move students first.`,
      );
    }
    await this.prisma.section.delete({ where: { id } });
    return { success: true, id };
  }

  // ---------------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------------

  async listDepartments(search?: string) {
    const q = this.normalizeSearch(search);
    const catalog = await this.buildDepartmentCatalog();

    return catalog
      .filter((department) => {
        if (!q) return true;
        return [department.name, department.description].some((value) =>
          String(value || '').toLowerCase().includes(q),
        );
      })
      .map((department) => ({
        ...department,
        canDelete: !department.isLegacy && department.teachers === 0 && department.subjects === 0,
      }));
  }

  async getDepartment(id: string) {
    const department = await this.resolveDepartmentCatalogRecord(id);
    return {
      ...department,
      canDelete: !department.isLegacy && department.teachers === 0 && department.subjects === 0,
    };
  }

  async createDepartment(payload: { name?: string; description?: string }) {
    const requestedName = this.normalizeDepartmentName(payload.name);
    const description = String(payload.description ?? '').trim() || null;

    if (!requestedName) {
      throw new BadRequestException('Department name is required.');
    }

    const existing = await this.prisma.department.findFirst({
      where: {
        name: {
          equals: requestedName,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new ConflictException('That department already exists.');
    }

    const legacyMatch = await this.findLegacyDepartmentName(requestedName);

    const created = await this.prisma.department.create({
      data: {
        name: this.normalizeDepartmentName(legacyMatch ?? requestedName),
        description,
      },
    });

    return this.getDepartment(created.id);
  }

  async updateDepartment(id: string, payload: { name?: string; description?: string }) {
    const existingRecord = await this.resolveDepartmentCatalogRecord(id);
    const requestedName = this.normalizeDepartmentName(payload.name ?? existingRecord.name);
    const description = String(payload.description ?? existingRecord.description ?? '').trim() || null;

    if (!requestedName) {
      throw new BadRequestException('Department name is required.');
    }

    const conflicting = await this.prisma.department.findFirst({
      where: {
        name: {
          equals: requestedName,
          mode: 'insensitive',
        },
      },
    });
    if (conflicting && conflicting.id !== existingRecord.id) {
      throw new ConflictException('That department name is already in use.');
    }

    const updatedDepartment = await this.prisma.$transaction(async (tx) => {
      const departmentRow = existingRecord.isLegacy
        ? await tx.department.create({
            data: {
              name: requestedName,
              description,
            },
          })
        : await tx.department.update({
            where: { id: existingRecord.id },
            data: {
              name: requestedName,
              description,
            },
          });

      if (existingRecord.name !== requestedName) {
        await tx.teacherProfile.updateMany({
          where: {
            department: {
              equals: existingRecord.name,
              mode: 'insensitive',
            },
          },
          data: {
            department: requestedName,
          },
        });
      }

      return departmentRow;
    });

    return this.getDepartment(updatedDepartment.id);
  }

  async deleteDepartment(id: string) {
    const existingRecord = await this.resolveDepartmentCatalogRecord(id);

    if (existingRecord.teachers > 0 || existingRecord.subjects > 0) {
      throw new ConflictException(
        `Department ${existingRecord.name} is still in use by ${existingRecord.teachers} teacher(s) and ${existingRecord.subjects} subject(s). Reassign those records before deleting the department.`,
      );
    }

    if (existingRecord.isLegacy) {
      throw new ConflictException(
        `Department ${existingRecord.name} only exists as a live teacher mapping. Reassign or rename the linked records before deleting it.`,
      );
    }

    await this.prisma.department.delete({
      where: { id: existingRecord.id },
    });

    return {
      success: true,
      deleted: true,
      id: existingRecord.id,
      name: existingRecord.name,
    };
  }

  async ensureDepartmentName(value?: string | null) {
    const requestedName = this.normalizeDepartmentName(value);
    if (!requestedName) return null;

    const existing = await this.prisma.department.findFirst({
      where: {
        name: {
          equals: requestedName,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      return existing.name;
    }

    const legacyMatch = await this.findLegacyDepartmentName(requestedName);
    if (legacyMatch) {
      return legacyMatch;
    }

    throw new BadRequestException('Department not found. Create it in Departments first.');
  }

  // ---------------------------------------------------------------------------
  // Courses
  // ---------------------------------------------------------------------------

  async listCourses(academicYearId: string) {
    const courses = await this.prisma.course.findMany({
      where: { academicYearId },
      include: { _count: { select: { levels: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code ?? null,
      description: course.description ?? null,
      sortOrder: course.sortOrder ?? null,
      yearLevelCount: course._count.levels,
    }));
  }

  async createCourse(payload: {
    academicYearId?: string;
    name?: string;
    code?: string;
    description?: string;
    sortOrder?: number;
  }) {
    const academicYearId = String(payload.academicYearId ?? '').trim();
    const name = String(payload.name ?? '').trim();
    if (!academicYearId) throw new BadRequestException('Academic year is required.');
    if (!name) throw new BadRequestException('Course name is required.');

    const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) throw new BadRequestException('Academic year not found.');

    const existing = await this.prisma.course.findFirst({
      where: { academicYearId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('That course already exists for this academic year.');

    const created = await this.prisma.course.create({
      data: {
        academicYearId,
        name,
        code: payload.code ? String(payload.code).trim() || null : null,
        description: payload.description ? String(payload.description).trim() || null : null,
        sortOrder: payload.sortOrder !== undefined ? Number(payload.sortOrder) : null,
      },
    });

    return { success: true, id: created.id, name: created.name, academicYearId };
  }

  async deleteCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { levels: true } } },
    });
    if (!course) throw new NotFoundException('Course not found.');

    const levels = await this.prisma.academicYearLevel.findMany({
      where: { courseId: id },
      include: { _count: { select: { students: true } } },
    });
    const totalStudents = levels.reduce((t, l) => t + l._count.students, 0);
    if (totalStudents > 0) {
      throw new ConflictException(
        `Cannot delete course "${course.name}" — ${totalStudents} student(s) are enrolled in its year levels.`,
      );
    }

    await this.prisma.academicYearLevel.updateMany({
      where: { courseId: id },
      data: { courseId: null },
    });
    await this.prisma.course.delete({ where: { id } });
    return { success: true, id };
  }

  // ---------------------------------------------------------------------------
  // Bulk Move
  // ---------------------------------------------------------------------------

  async getBulkMoveData() {
    await this.syncLegacyAcademicYearLevels();
    const [academicYears, sections] = await Promise.all([
      this.prisma.academicYear.findMany({
        orderBy: [{ status: 'asc' }, { name: 'desc' }],
      }),
      this.prisma.section.findMany({
        include: {
          academicYear: true,
          academicYearLevel: true,
          students: { include: { user: { select: SAFE_USER_SELECT } } },
        },
      }),
    ]);

    return {
      academicYears: academicYears.map((year) => ({
        id: year.id,
        name: year.name,
        status: this.formatAcademicYearStatus(year.status),
      })),
      sections: sections
        .map((section) => ({
          id: section.id,
          code: section.name,
          academicYearId: section.academicYearId || '',
          academicYear: section.academicYear?.name || 'Unassigned',
          academicYearStatus: this.formatAcademicYearStatus(section.academicYear?.status),
          course: section.course || '',
          yearLevel: String(section.yearLevel ?? ''),
          yearLevelId: section.academicYearLevelId || '',
          yearLevelName:
            section.academicYearLevel?.name ||
            section.yearLevelName ||
            this.formatYearLevel(section.yearLevel),
          adviser: String(section.adviserName ?? '').trim() || 'Unassigned',
          students: section.students
            .map((student) => ({
              id: student.userId,
              name: `${student.user.lastName}, ${student.user.firstName}`.trim(),
              studentNumber: student.studentNumber,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => {
          const yearCompare = String(right.academicYear || '').localeCompare(String(left.academicYear || ''));
          if (yearCompare !== 0) return yearCompare;
          const levelCompare =
            (this.parseYearLevelNumber(left.yearLevelName || left.yearLevel) ?? Number.MAX_SAFE_INTEGER) -
            (this.parseYearLevelNumber(right.yearLevelName || right.yearLevel) ?? Number.MAX_SAFE_INTEGER);
          if (levelCompare !== 0) return levelCompare;
          const levelLabelCompare = String(left.yearLevelName || '').localeCompare(
            String(right.yearLevelName || ''),
          );
          if (levelLabelCompare !== 0) return levelLabelCompare;
          const courseCompare = String(left.course || '').localeCompare(String(right.course || ''));
          if (courseCompare !== 0) return courseCompare;
          return left.code.localeCompare(right.code);
        }),
    };
  }

  async moveStudents(sourceSectionId: string, destSectionId: string, ids: string[]) {
    await this.syncLegacyAcademicYearLevels();
    const sourceId = String(sourceSectionId ?? '').trim();
    const destId = String(destSectionId ?? '').trim();
    if (!sourceId || !destId) {
      throw new BadRequestException('Source and destination sections are required.');
    }
    if (sourceId === destId) {
      throw new BadRequestException('Source and destination sections must be different.');
    }

    const [sourceSection, destSection] = await Promise.all([
      this.prisma.section.findUnique({
        where: { id: sourceId },
        include: { academicYear: true, academicYearLevel: true },
      }),
      this.prisma.section.findUnique({
        where: { id: destId },
        include: { academicYear: true, academicYearLevel: true },
      }),
    ]);
    if (!sourceSection || !destSection) throw new NotFoundException('Section not found.');

    const destinationPlacement = await this.resolveSectionPlacement({
      academicYearId: destSection.academicYearId ?? undefined,
      academicYear: destSection.academicYear?.name ?? undefined,
      academicYearLevelId: destSection.academicYearLevelId ?? undefined,
      yearLevelName:
        destSection.academicYearLevel?.name ?? destSection.yearLevelName ?? undefined,
      course: destSection.course ?? undefined,
      yearLevel: destSection.yearLevel ?? undefined,
      sectionId: destSection.id,
      section: destSection.name,
      requireSection: true,
    });

    const moving = await this.prisma.studentProfile.findMany({
      where: {
        userId: { in: ids },
        sectionId: sourceSection.id,
      },
      include: { user: { select: SAFE_USER_SELECT } },
    });

    const movingProfileIds = moving.map((student) => student.id);
    await this.prisma.$transaction([
      this.prisma.studentProfile.updateMany({
        where: {
          userId: { in: ids },
          sectionId: sourceSection.id,
        },
        data: {
          sectionId: destinationPlacement.section?.id ?? destSection.id,
          academicYearId:
            destinationPlacement.academicYear?.id ?? destinationPlacement.section?.academicYearId ?? null,
          academicYearLevelId:
            destinationPlacement.academicYearLevel?.id ??
            destinationPlacement.section?.academicYearLevelId ??
            null,
          course: destinationPlacement.course,
          yearLevel: destinationPlacement.yearLevel,
          yearLevelName:
            destinationPlacement.yearLevelName ||
            destSection.yearLevelName ||
            destSection.academicYearLevel?.name ||
            null,
        },
      }),
      this.prisma.enrollment.updateMany({
        where: {
          studentId: { in: movingProfileIds },
          sectionId: sourceSection.id,
        },
        data: {
          sectionId: destSection.id,
        },
      }),
    ]);

    return {
      ...(await this.getBulkMoveData()),
      moved: moving.map((student) => ({
        id: student.userId,
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Academic Settings (needed by getActiveAcademicYear)
  // ---------------------------------------------------------------------------

  private async getAcademicSettings() {
    const latest = await this.prisma.academicSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
    return {
      ...this.buildDefaultAcademicSettings(),
      ...(latest ?? {}),
    };
  }

  private buildDefaultAcademicSettings() {
    const currentYear = new Date().getFullYear();
    return {
      schoolYear: `${currentYear}-${currentYear + 1}`,
      semester: '2nd Semester',
      submissionStart: `${currentYear}-01-15`,
      submissionEnd: `${currentYear}-05-30`,
      latePolicy: '24h',
      lateDeduction: '10',
    } as const;
  }
}
