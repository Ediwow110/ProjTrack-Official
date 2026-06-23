import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsRepository } from '../repositories/settings.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminSubjectsService {
  private readonly logger = new Logger(AdminSubjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsRepository: SettingsRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async subjects(search?: string) {
    const q = this.normalizeSearch(search);
    const rows = await this.prisma.subject.findMany({
      include: { teacher: { include: { user: { select: SAFE_USER_SELECT } } }, tasks: true, enrollments: { include: { section: true } } },
      orderBy: { code: 'asc' },
    });
    return rows
      .map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        teacher: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned',
        sections: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])),
        activities: subject.tasks.length,
        students: subject.enrollments.length,
        status: this.formatSubjectStatus(subject.status, subject.isOpen),
      }))
      .filter((row) => {
        if (!q) return true;
        return [row.code, row.name, row.teacher].some((value) => String(value || '').toLowerCase().includes(q));
      });
  }

  async createSubject(payload: {
    code?: string;
    name?: string;
    teacherId?: string | null;
    status?: string;
    groupEnabled?: boolean;
    allowLateSubmission?: boolean;
    sectionIds?: string[];
    sectionCodes?: string[];
  }) {
    const code = String(payload.code ?? '').trim();
    const name = String(payload.name ?? '').trim();
    const teacherId = String(payload.teacherId ?? '').trim() || null;
    const sectionIds = Array.isArray(payload.sectionIds) ? payload.sectionIds.map((item) => String(item).trim()).filter(Boolean) : [];
    const sectionCodes = Array.isArray(payload.sectionCodes) ? payload.sectionCodes.map((item) => String(item).trim()).filter(Boolean) : [];
    if (!code || !name) throw new BadRequestException('Subject code and subject name are required.');
    const existing = await this.prisma.subject.findUnique({ where: { code } });
    if (existing) throw new ConflictException('That subject code already exists.');
    const teacherProfile = teacherId ? await this.prisma.teacherProfile.findFirst({ where: { userId: teacherId } }) : null;
    const sectionsForAssignment = sectionIds.length || sectionCodes.length
      ? sectionIds.length
        ? await this.prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { students: true } })
        : await this.prisma.section.findMany({ where: { name: { in: sectionCodes } }, include: { students: true } })
      : [];
    if (!sectionIds.length && sectionCodes.length) {
      const byName = new Map<string, number>();
      for (const section of sectionsForAssignment) byName.set(section.name, (byName.get(section.name) || 0) + 1);
      const ambiguous = Array.from(byName.entries()).filter(([, count]) => count > 1).map(([name]) => name);
      if (ambiguous.length) throw new BadRequestException(`Section IDs are required for ambiguous section names: ${ambiguous.join(', ')}.`);
    }
    const subject = await this.prisma.subject.create({
      data: { code, name, teacherId: teacherProfile?.id ?? null, status: String(payload.status ?? 'ACTIVE').toUpperCase(), groupEnabled: payload.groupEnabled ?? true, allowLateSubmission: payload.allowLateSubmission ?? true },
    });
    if (sectionsForAssignment.length) {
      await this.prisma.subjectSection.createMany({ data: sectionsForAssignment.map((section) => ({ subjectId: subject.id, sectionId: section.id })), skipDuplicates: true });
      const enrollmentData = sectionsForAssignment.flatMap((section) => section.students.map((student) => ({ studentId: student.id, subjectId: subject.id, sectionId: section.id })));
      if (enrollmentData.length) await this.prisma.enrollment.createMany({ data: enrollmentData, skipDuplicates: true });
    }
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'CREATE', module: 'Subjects', target: `${code} ${name}`.trim(), entityId: subject.id, result: 'Success', details: 'Admin created a subject.' });
    return { success: true, id: subject.id };
  }

  async updateSubject(id: string, payload: { code?: string; name?: string; teacherId?: string | null; status?: string; groupEnabled?: boolean; allowLateSubmission?: boolean; sectionIds?: string[] }) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found.');
    const code = String(payload.code ?? subject.code).trim();
    const name = String(payload.name ?? subject.name).trim();
    const teacherId = String(payload.teacherId ?? '').trim() || null;
    const teacherProfile = teacherId ? await this.prisma.teacherProfile.findFirst({ where: { userId: teacherId } }) : null;
    const existing = await this.prisma.subject.findFirst({ where: { code, id: { not: subject.id } } });
    if (existing) throw new ConflictException('A different subject already uses that code.');
    await this.prisma.$transaction(async (tx) => {
      await tx.subject.update({ where: { id: subject.id }, data: { code, name, teacherId: teacherProfile?.id ?? null, status: payload.status ? String(payload.status).toUpperCase() : subject.status, groupEnabled: payload.groupEnabled ?? subject.groupEnabled, allowLateSubmission: payload.allowLateSubmission ?? subject.allowLateSubmission } });
      if (Array.isArray(payload.sectionIds)) {
        const sectionIds = payload.sectionIds.map((item) => String(item).trim()).filter(Boolean);
        await tx.subjectSection.deleteMany({ where: { subjectId: subject.id } });
        if (sectionIds.length) await tx.subjectSection.createMany({ data: sectionIds.map((sectionId) => ({ subjectId: subject.id, sectionId })), skipDuplicates: true });
      }
    });
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'UPDATE', module: 'Subjects', target: `${code} ${name}`.trim(), entityId: subject.id, result: 'Success', details: 'Admin updated subject details.' });
    return { success: true, id: subject.id };
  }

  async subjectDetail(id: string) {
    const [subject, settings] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id }, include: { teacher: { include: { user: { select: SAFE_USER_SELECT } } }, tasks: true, enrollments: { include: { section: true } } } }),
      this.settingsRepository.getAcademicSettings(),
    ]);
    if (!subject) throw new NotFoundException('Subject not found.');
    const acceptedTypes = new Set<string>();
    for (const task of subject.tasks) {
      const values = Array.isArray(task.acceptedFileTypes) ? task.acceptedFileTypes : [];
      for (const value of values) acceptedTypes.add(String(value));
    }
    return {
      code: subject.code,
      name: subject.name,
      term: `${settings?.schoolYear ?? 'Not configured'} · ${settings?.semester ?? 'Not configured'}`,
      status: this.formatSubjectStatus(subject.status, subject.isOpen),
      form: { code: subject.code, name: subject.name, teacherId: subject.teacher?.userId ?? '', teacherName: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned', status: this.formatSubjectStatus(subject.status, subject.isOpen), groupEnabled: subject.groupEnabled, allowLateSubmission: subject.allowLateSubmission, sectionCodes: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])) },
      details: [
        { l: 'Teacher', v: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned' },
        { l: 'Sections', v: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])).join(', ') || '\u2014' },
        { l: 'Allowed Types', v: acceptedTypes.size ? Array.from(acceptedTypes).join(', ') : 'Any' },
        { l: 'Group Work', v: subject.groupEnabled ? 'Enabled' : 'Disabled' },
      ],
      stats: [
        { l: 'Activities', v: String(subject.tasks.length) },
        { l: 'Students', v: String(subject.enrollments.length) },
        { l: 'Open Window', v: subject.isOpen ? 'Yes' : 'No' },
      ],
    };
  }

  private normalizeSearch(search?: string) {
    const raw = String(search ?? '').trim();
    if (!raw) return '';
    const lowered = raw.toLowerCase();
    if (/^[a-zA-Z0-9 .@_'-]+$/.test(lowered) && lowered.length <= 100) return lowered;
    return '';
  }

  private userName(user: any): string {
    if (!user) return 'Unknown';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown User';
  }

  private formatSubjectStatus(status?: string | null, isOpen?: boolean | null) {
    if (status) return this.toTitleWords(status);
    return isOpen ? 'Active' : 'Closed';
  }

  private toTitleWords(value: string) {
    return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  }
}
