import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionRepository } from '../repositories/submission.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FilesService } from '../files/files.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminSubmissionsService {
  private readonly logger = new Logger(AdminSubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly submissionRepository: SubmissionRepository,
    private readonly auditLogs: AuditLogsService,
    private readonly files: FilesService,
  ) {}

  async submissions(search?: string, status?: string, subjectId?: string, studentId?: string, section?: string) {
    const q = this.normalizeSearch(search);
    const normalizedStatus = String(status ?? '').trim();
    const rows = await this.prisma.submission.findMany({
      where: { ...(subjectId ? { subjectId } : {}), ...(studentId ? { studentId } : {}) },
      include: { task: true, subject: { include: { teacher: { include: { user: { select: SAFE_USER_SELECT } } } } }, student: { include: { studentProfile: { include: { section: true } } } }, group: { include: { section: true } } },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows
      .map((submission) => {
        const ownerName = submission.student ? this.userName(submission.student) : submission.group?.name ?? 'Unknown group';
        const studentNumber = submission.student?.studentProfile?.studentNumber ?? null;
        const sectionLabel = submission.student?.studentProfile?.section?.name ?? submission.group?.section?.name ?? '\u2014';
        return {
          id: submission.id, title: submission.title, student: studentNumber ? `${ownerName} \u00B7 ${studentNumber}` : ownerName, studentNumber,
          teacher: submission.subject?.teacher?.user ? this.userName(submission.subject.teacher.user) : 'Unassigned',
          subject: submission.subject?.name ?? submission.subjectId, subjectCode: submission.subject?.code ?? submission.subjectId,
          section: sectionLabel, due: submission.task?.deadline ? this.formatDateTime(submission.task.deadline) : '\u2014',
          submitted: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '\u2014',
          status: this.formatSubmissionStatus(submission.status), statusKey: submission.status,
          grade: submission.grade == null ? '\u2014' : String(submission.grade), taskId: submission.taskId,
          taskTitle: submission.task?.title ?? submission.title, subjectId: submission.subjectId, studentId: submission.studentId,
          groupId: submission.groupId, ownerLabel: ownerName,
          externalLinks: Array.isArray(submission.externalLinks) ? submission.externalLinks : [],
          feedback: submission.feedback ?? '', notes: submission.notes ?? '',
        };
      })
      .filter((submission) => {
        const matchesSearch = !q || [submission.id, submission.title, submission.student, submission.subject, submission.subjectCode, submission.teacher, submission.taskId, submission.taskTitle].some((value) => String(value ?? '').toLowerCase().includes(q));
        const matchesStatus = !normalizedStatus || normalizedStatus === 'All' || submission.status === normalizedStatus || submission.statusKey === normalizedStatus.toUpperCase().replace(/\s+/g, '_');
        const matchesSection = !section || section === 'All' || submission.section === section;
        return matchesSearch && matchesStatus && matchesSection;
      });
  }

  async createSubmission(payload: any, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('create-submission', actor, String(payload?.taskId ?? 'manual-submission'));
    const taskId = String(payload?.taskId ?? '').trim();
    const subjectId = String(payload?.subjectId ?? '').trim();
    const studentId = String(payload?.studentId ?? '').trim() || null;
    const groupId = String(payload?.groupId ?? '').trim() || null;
    const title = String(payload?.title ?? '').trim();
    const normalizedStatus = this.normalizeSubmissionStatusInput(payload?.status);
    if (!taskId || !subjectId || !title || !normalizedStatus) throw new BadRequestException('taskId, subjectId, title, and status are required.');
    if ((studentId && groupId) || (!studentId && !groupId)) throw new BadRequestException('Provide either studentId or groupId, but not both.');
    const task = await this.prisma.submissionTask.findUnique({ where: { id: taskId }, include: { subject: true } });
    if (!task) throw new NotFoundException('Submission task not found.');
    if (task.subjectId !== subjectId) throw new BadRequestException('The selected task does not belong to the selected subject.');
    let targetStudent: any = null;
    let targetGroup: any = null;
    if (studentId) {
      targetStudent = await this.prisma.user.findFirst({ where: { id: studentId, role: 'STUDENT' }, include: { studentProfile: true } });
      if (!targetStudent) throw new BadRequestException('studentId must belong to a valid student account.');
    }
    if (groupId) {
      targetGroup = await this.prisma.group.findUnique({ where: { id: groupId }, include: { section: true } });
      if (!targetGroup) throw new BadRequestException('groupId must belong to a valid group.');
      if (targetGroup.subjectId !== subjectId) throw new BadRequestException('The selected group does not belong to the selected subject.');
    }
    try {
      const created = await this.prisma.submission.create({
        data: { taskId, subjectId, studentId, groupId, submittedById: actor?.actorUserId ?? null, title, status: normalizedStatus, submittedAt: this.parseOptionalDate(payload?.submittedAt), grade: this.parseOptionalGrade(payload?.grade), feedback: this.nullableText(payload?.feedback), notes: this.nullableText(payload?.notes), externalLinks: this.normalizeExternalLinks(payload?.externalLinks) },
      });
      await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'CREATE', module: 'Submissions', target: title, entityId: created.id, result: 'Success', details: `Manual submission record created for ${targetStudent ? this.userName(targetStudent) : targetGroup?.name ?? 'group'}.`, ipAddress: actor?.ipAddress });
      return { success: true, id: created.id, status: this.formatSubmissionStatus(created.status) };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new ConflictException(studentId ? 'A submission for this task and student already exists.' : 'A submission for this task and group already exists.');
      throw error;
    }
  }

  async updateSubmission(id: string, payload: any, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('update-submission', actor, id);
    const existing = await this.prisma.submission.findUnique({ where: { id }, include: { student: { select: SAFE_USER_SELECT }, group: true } });
    if (!existing) throw new NotFoundException('Submission not found.');
    const data: Record<string, any> = {};
    if (payload?.status !== undefined) data.status = this.normalizeSubmissionStatusInput(payload.status);
    if (payload?.grade !== undefined) data.grade = this.parseOptionalGrade(payload.grade);
    if (payload?.feedback !== undefined) data.feedback = this.nullableText(payload.feedback);
    if (payload?.notes !== undefined) data.notes = this.nullableText(payload.notes);
    if (payload?.submittedAt !== undefined) data.submittedAt = this.parseOptionalDate(payload.submittedAt);
    if (payload?.externalLinks !== undefined) data.externalLinks = this.normalizeExternalLinks(payload.externalLinks);
    const updated = await this.prisma.submission.update({ where: { id }, data });
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'UPDATE', module: 'Submissions', target: existing.title, entityId: existing.id, result: 'Success', details: `Admin updated submission metadata for ${existing.student ? this.userName(existing.student) : existing.group?.name ?? 'group owner'}.`, beforeValue: `${existing.status}${existing.grade != null ? `:${existing.grade}` : ''}`, afterValue: `${updated.status}${updated.grade != null ? `:${updated.grade}` : ''}`, ipAddress: actor?.ipAddress });
    return { success: true, id: updated.id, status: this.formatSubmissionStatus(updated.status) };
  }

  async deleteSubmission(id: string, confirmation?: string, actor?: AdminActorContext) {
    const normalizedConfirmation = String(confirmation ?? '').trim().toUpperCase();
    if (normalizedConfirmation !== 'DELETE') throw new BadRequestException('Type DELETE to confirm deleting a submission.');
    await this.assertAdminRateLimit('delete-submission', actor, id, { limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    const submission = await this.prisma.submission.findUnique({ where: { id }, include: { student: { select: SAFE_USER_SELECT }, group: true, files: true } });
    if (!submission) throw new NotFoundException('Submission not found.');
    for (const file of submission.files) {
      const relativePath = String(file.relativePath ?? '').trim();
      if (!relativePath) continue;
      try { await this.files.remove(relativePath); } catch { throw new BadRequestException('The submission could not be deleted safely because one or more stored files could not be removed.'); }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.submissionFile.deleteMany({ where: { submissionId: submission.id } });
      await tx.submission.delete({ where: { id: submission.id } });
    });
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'DELETE', module: 'Submissions', target: submission.title, entityId: submission.id, result: 'Success', details: `Admin deleted a submission owned by ${submission.student ? this.userName(submission.student) : submission.group?.name ?? 'group owner'}.`, ipAddress: actor?.ipAddress });
    return { success: true, deleted: true };
  }

  async submissionDetail(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { subject: true, student: { select: SAFE_USER_SELECT }, group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } }, submittedBy: true, files: true },
    });
    if (!submission) throw new NotFoundException('Submission not found.');
    const owner = submission.student ? this.userName(submission.student) : submission.group?.name ?? submission.groupId ?? 'Unknown';
    return {
      title: submission.title, subtitle: `${owner} \u00B7 ${submission.subject?.name ?? submission.subjectId}`,
      status: this.formatSubmissionStatus(submission.status),
      details: [
        { l: 'Subject', v: submission.subject?.name ?? submission.subjectId },
        { l: 'Owner', v: owner },
        { l: 'Submitted By', v: submission.submittedBy ? this.userName(submission.submittedBy) : '\u2014' },
        { l: 'Submitted At', v: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '\u2014' },
      ],
      files: submission.files.map((file) => ({ name: file.fileName, fileName: file.fileName, relativePath: file.relativePath })),
      timeline: [
        { e: 'Created', t: this.formatDateTime(submission.createdAt) },
        { e: 'Submitted', t: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '\u2014' },
        { e: 'Current Status', t: this.formatSubmissionStatus(submission.status) },
      ],
      feedback: submission.feedback ?? 'No feedback yet.',
      adminNote: submission.notes ?? '',
    };
  }

  async saveSubmissionNote(id: string, note: string) {
    const submission: any = await this.submissionRepository.saveSubmissionNote(id, note);
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'SUBMISSION_NOTE_UPDATED', module: 'Submissions', target: submission.title, entityId: submission.id, result: 'Success', details: 'Administrative submission note updated.' });
    return { success: true, note: submission.notes ?? '' };
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

  private async assertAdminRateLimit(action: string, actor: AdminActorContext | undefined, key: string, opts?: { limit?: number; windowMs?: number; blockMs?: number }) {
    const limit = opts?.limit ?? 60;
    const windowMs = opts?.windowMs ?? 60_000;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    await this.prisma.authRateLimit.deleteMany({ where: { action, key, firstAttemptAt: { lte: windowStart } } });
    const row = await this.prisma.authRateLimit.upsert({ where: { action_key: { action, key } }, update: { attempts: { increment: 1 }, lastAttemptAt: now }, create: { action, key, attempts: 1, firstAttemptAt: now, lastAttemptAt: now } });
    if (row.attempts > limit) throw new BadRequestException('Too many requests. Please try again later.');
  }

  private formatSubmissionStatus(status?: string | null) {
    return this.toTitleWords(String(status ?? ''));
  }

  private normalizeSubmissionStatusInput(value: unknown) {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
    if (!normalized) throw new BadRequestException('Submission status is required.');
    return normalized;
  }

  private parseOptionalDate(value: unknown) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date value.');
    return parsed;
  }

  private parseOptionalGrade(value: unknown) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Grade must be a valid non-negative number.');
    return Math.round(parsed);
  }

  private nullableText(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private normalizeExternalLinks(value: unknown) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n').flatMap((chunk) => chunk.split(',')) : [];
    return items.map((item: string) => String(item ?? '').trim()).filter(Boolean);
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && String((error as { code?: string }).code) === 'P2002';
  }

  private toTitleWords(value: string) {
    return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private formatDateTime(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('en-US');
  }
}
