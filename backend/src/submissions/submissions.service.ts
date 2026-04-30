import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  MAIL_CATEGORY_KEYS,
  MAIL_TEMPLATE_KEYS,
} from '../common/constants/mail.constants';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { FilesService } from '../files/files.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { eventActionForSubmission } from '../access/policies/submission-access.policy';
import { canStudentEditSubmission, canTransitionSubmissionStatus, normalizeSubmissionLifecycleStatus } from './submission-lifecycle';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly subjectRepository: SubjectRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly auditLogs: AuditLogsService,
    private readonly filesService: FilesService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private requireAuthenticatedUserId(userId: string | undefined, roleLabel: string) {
    const normalized = String(userId || '').trim();
    if (!normalized) {
      throw new UnauthorizedException(`Authenticated ${roleLabel.toLowerCase()} context is required.`);
    }
    return normalized;
  }

  private async ensureStudentEnrolledInSubject(userId: string, subjectId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!studentProfile) {
      throw new ForbiddenException('Student profile is required for this action.');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: studentProfile.id,
        subjectId,
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this activity.');
    }
  }

  async studentList(userId?: string, status?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const rows: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId, status);
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async studentDetail(id: string, userId?: string) {
    const record = await this.submissionRepository.findSubmissionById(id);
    if (!record) throw new NotFoundException('Submission not found.');
    await this.access.requireStudentCanAccessSubmission(userId, id);
    return this.decorate(record);
  }

  async submit(body: { activityId: string; title?: string; userId?: string; groupId?: string; description?: string; notes?: string; externalLinks?: string[]; files?: { uploadId: string; name: string; sizeKb: number }[] }) {
    const userId = body.userId;
    if (!userId) throw new ForbiddenException('Authenticated student session is required.');

    const activity: any = await this.subjectRepository.findActivityById(body.activityId);
    if (!activity) throw new NotFoundException('Activity not found.');
    const requestedFiles = body.files || [];
    const uploadIds = requestedFiles.map((file) => String(file.uploadId || '').trim()).filter(Boolean);
    if (requestedFiles.length !== uploadIds.length) {
      throw new BadRequestException('Each submitted file must reference a pending upload id.');
    }
    const pendingUploads = await this.filesService.resolvePendingUploadsForSubmission({
      uploadIds,
      userId,
    });
    const pendingById = new Map(pendingUploads.map((upload) => [upload.id, upload]));
    const files = requestedFiles.map((file) => {
      const pending = pendingById.get(file.uploadId);
      if (!pending) {
        throw new BadRequestException('One or more uploads are not available for this submission.');
      }
      return {
        uploadId: pending.id,
        name: pending.sanitizedFilename,
        sizeKb: Math.max(1, Math.ceil(pending.sizeBytes / 1024)),
        relativePath: pending.storageKey,
      };
    });
    const validation = await this.validateStudentSubmission({ ...body, files }, activity, userId);
    body.groupId = validation.groupId;

    const existingSubmission: any = validation.groupId
      ? await this.submissionRepository.findExistingSubmission(body.activityId, undefined, validation.groupId)
      : await this.submissionRepository.findExistingSubmission(body.activityId, userId);

    if (existingSubmission && !canStudentEditSubmission(existingSubmission.status)) {
      throw new BadRequestException('This submission can no longer be edited or resubmitted from the student workflow.');
    }

    const previousStatus = existingSubmission?.status ?? null;
    const record: any = await this.submissionRepository.createOrUpdateSubmission({
      ...body,
      files,
      userId,
      status: validation.status,
    });
    if (!record) throw new NotFoundException('Activity not found.');
    const subject: any = await this.subjectRepository.findSubjectById(activity.subjectId);
    const actor: any = await this.userRepository.findById(userId);

    await this.auditLogs.record({
      actorUserId: userId,
      actorRole: 'STUDENT',
      action: 'SUBMISSION_CREATED',
      module: 'Submissions',
      target: record.title,
      entityId: record.id,
      result: 'Success',
    });

    await this.recordSubmissionEvent({
      submissionId: record.id,
      actorUserId: userId,
      action: eventActionForSubmission(previousStatus, record.status),
      fromStatus: previousStatus,
      toStatus: record.status,
      details: {
        activityId: body.activityId,
        fileCount: body.files?.length || 0,
        late: validation.status === 'LATE',
      },
    });
    for (const file of record.files || []) {
      await this.recordSubmissionEvent({
        submissionId: record.id,
        actorUserId: userId,
        action: 'FILE_ATTACHED',
        toStatus: record.status,
        details: { fileId: file.id, fileName: file.fileName },
      });
    }

    const teacherUserId = subject?.teacher?.user?.id;
    if (teacherUserId) {
      const studentName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'A student';
      await this.notifyOperationalUsers([teacherUserId], {
        title: `New submission in ${subject?.name || 'your subject'}`,
        body: `${studentName} submitted ${record.title}. Open the teacher submission queue to review it.`,
        dedupeKeyPrefix: `submission:created:${record.id}`,
        mailIdempotencyKeyPrefix: `mail:submission-created:${record.id}`,
      });
    }

    return this.decorate(record);
  }

  async teacherList(filters?: { teacherId?: string; section?: string; status?: string; subjectId?: string }) {
    const rows: any[] = await this.submissionRepository.listTeacherSubmissions(filters);
    const decorated = await Promise.all(rows.map((row) => this.decorate(row)));
    if (filters?.section) return decorated.filter((row: any) => row.section === filters.section);
    return decorated;
  }

  async teacherDetail(id: string, teacherId?: string) {
    const record = await this.submissionRepository.findSubmissionById(id);
    if (!record) throw new NotFoundException('Submission not found.');
    await this.access.requireTeacherCanReviewSubmission(teacherId, id);
    return this.decorate(record);
  }

  async teacherExport(filters?: { teacherId?: string; section?: string; status?: string; subjectId?: string }) {
    const rows = await this.teacherList(filters);
    return {
      fileName: `teacher-submissions-${Date.now()}.csv`,
      rows,
    };
  }

  async review(id: string, body: { status?: string; grade?: number; feedback?: string; actorUserId?: string }) {
    const existing: any = await this.submissionRepository.findSubmissionById(id);
    if (!existing) throw new NotFoundException('Submission not found.');
    await this.access.requireTeacherCanReviewSubmission(body.actorUserId, id);
    const nextStatus = normalizeSubmissionLifecycleStatus(body.status || existing.status);
    if (!canTransitionSubmissionStatus(existing.status, nextStatus)) {
      throw new BadRequestException(`Invalid submission status transition: ${existing.status || 'UNKNOWN'} -> ${nextStatus}.`);
    }
    if (nextStatus === 'GRADED' && (body.grade === undefined || body.grade === null || Number.isNaN(Number(body.grade)))) {
      throw new BadRequestException('A numeric grade is required before grading a submission.');
    }

    const record: any = await this.submissionRepository.reviewSubmission(id, { ...body, status: nextStatus });
    if (!record) throw new NotFoundException('Submission not found.');

    await this.auditLogs.record({
      actorUserId: body.actorUserId,
      actorRole: 'TEACHER',
      action: 'SUBMISSION_REVIEWED',
      module: 'Submissions',
      target: record.title,
      entityId: record.id,
      result: 'Success',
      afterValue: record.status,
    });
    await this.recordSubmissionEvent({
      submissionId: record.id,
      actorUserId: body.actorUserId,
      action: eventActionForSubmission(existing.status, record.status),
      fromStatus: existing.status,
      toStatus: record.status,
      details: {
        grade: record.grade,
        hasFeedback: Boolean(record.feedback),
      },
    });

    const decorated = await this.decorate(record);
    const recipientIds = this.getSubmissionRecipientUserIds(decorated);
    if (recipientIds.length) {
      const activityTitle = decorated.activityTitle || decorated.title || 'Your submission';
      const subjectName = decorated.subjectName || 'your subject';
      const statusMessage =
        nextStatus === 'GRADED'
          ? {
              title: `${activityTitle} graded`,
              body: `${activityTitle} in ${subjectName} has been graded. Open your submissions to review the feedback and score.`,
            }
          : nextStatus === 'NEEDS_REVISION'
            ? {
                title: `${activityTitle} needs revision`,
                body: `${activityTitle} in ${subjectName} was returned for revision. Review the teacher feedback and resubmit when ready.`,
              }
            : {
                title: `${activityTitle} status updated`,
                body: `${activityTitle} in ${subjectName} now shows ${String(nextStatus).replace(/_/g, ' ').toLowerCase()}.`,
              };

      await this.notifyOperationalUsers(recipientIds, {
        ...statusMessage,
        dedupeKeyPrefix: `submission:reviewed:${decorated.id}`,
        mailIdempotencyKeyPrefix: `mail:submission-reviewed:${decorated.id}`,
      });
    }

    return decorated;
  }


  private async canStudentAccessSubmission(userId: string, record: any) {
    if (record.studentUserId === userId || record.studentId === userId) return true;
    if (record.groupId) {
      const subjectId = record.subjectId || record.task?.subjectId;
      if (!subjectId) return false;
      const groups: any[] = await this.subjectRepository.listGroupsBySubject(subjectId);
      const group = groups.find((item: any) => item.id === record.groupId);
      return Boolean(group?.memberUserIds?.includes?.(userId) || group?.members?.some?.((member: any) => member.studentId === userId));
    }
    return false;
  }

  private async validateStudentSubmission(body: {
    activityId: string;
    groupId?: string;
    externalLinks?: string[];
    externalLink?: string;
    files?: { uploadId?: string; name: string; sizeKb: number }[];
  }, activity: any, userId: string) {
    const { subject } = await this.access.requireStudentEnrolledInSubject(userId, activity.subjectId);
    if (!subject.isOpen) {
      throw new BadRequestException('This subject is closed for submissions.');
    }

    const now = Date.now();
    const openAt = activity.openAt ? new Date(activity.openAt).getTime() : null;
    const closeAt = activity.closeAt ? new Date(activity.closeAt).getTime() : null;
    const dueAt = activity.dueAt ? new Date(activity.dueAt).getTime() : activity.deadline ? new Date(activity.deadline).getTime() : null;
    if (openAt && now < openAt) {
      throw new BadRequestException('This activity is not open for submission yet.');
    }
    if (closeAt && now > closeAt) {
      throw new BadRequestException('This activity is already closed for submission.');
    }
    if (activity.isOpen === false) {
      throw new BadRequestException('This activity is not open for submission.');
    }

    const allowLate = Boolean(activity.allowLateSubmission);
    const isLate = Boolean(dueAt && now > dueAt);
    if (isLate && !allowLate) {
      throw new BadRequestException('The submission deadline has passed and late submissions are disabled.');
    }

    const acceptedTypes = Array.isArray(activity.acceptedFileTypes)
      ? activity.acceptedFileTypes.map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean)
      : [];
    const maxFileSizeKb = Math.max(1, Number(activity.maxFileSizeMb || 10)) * 1024;
    for (const file of body.files || []) {
      const fileName = String(file.name || '').trim();
      const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}`.toLowerCase() : '';
      if (acceptedTypes.length && !acceptedTypes.includes(extension) && !acceptedTypes.includes(extension.replace(/^\./, ''))) {
        throw new BadRequestException(`File type ${extension || 'unknown'} is not accepted for this activity.`);
      }
      if (Number(file.sizeKb || 0) > maxFileSizeKb) {
        throw new BadRequestException(`File ${fileName || 'upload'} exceeds the ${activity.maxFileSizeMb || 10} MB limit.`);
      }
    }

    const externalLinks = [
      ...(Array.isArray(body.externalLinks) ? body.externalLinks : []),
      body.externalLink,
    ].map((value) => String(value || '').trim()).filter(Boolean);
    if (externalLinks.length && activity.externalLinksAllowed === false) {
      throw new BadRequestException('External links are not allowed for this activity.');
    }

    const groupMode = String(activity.submissionMode || '').toUpperCase() === 'GROUP';
    if (!groupMode && body.groupId) {
      throw new BadRequestException('This activity requires an individual submission.');
    }

    if (!groupMode) {
      return { status: isLate ? 'LATE' : 'SUBMITTED', groupId: undefined };
    }

    const membership = await this.prisma.group.findFirst({
      where: {
        subjectId: activity.subjectId,
        members: { some: { studentId: userId, status: { not: 'REMOVED' } } },
        status: 'ACTIVE',
      },
      include: { members: true },
    });
    if (!membership) {
      throw new BadRequestException('You must belong to an active group before submitting this group activity.');
    }
    if (body.groupId && String(body.groupId) !== String(membership.id)) {
      throw new ForbiddenException('Submission group does not match your current subject group.');
    }

    return { status: isLate ? 'LATE' : 'SUBMITTED', groupId: membership.id };
  }

  private async recordSubmissionEvent(input: {
    submissionId: string;
    actorUserId?: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    details?: Record<string, unknown>;
  }) {
    await this.prisma.submissionEvent.create({
      data: {
        submissionId: input.submissionId,
        actorUserId: input.actorUserId,
        action: input.action,
        fromStatus: input.fromStatus || null,
        toStatus: input.toStatus || null,
        details: input.details ? (input.details as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private async canTeacherAccessSubmission(teacherId: string, record: any) {
    const subjectId = record.subjectId || record.task?.subjectId;
    if (!subjectId) return false;
    const subject: any = await this.subjectRepository.findSubjectById(subjectId);
    const actor: any = await this.userRepository.findById(teacherId);
    const allowedTeacherId = actor?.teacherProfile?.id ?? teacherId;
    return String(subject?.teacherId || '') === String(allowedTeacherId);
  }

  private async getNotificationPreferences() {
    const settings = await this.prisma.systemSetting.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        classroomActivityEmailsEnabled: true,
        classroomActivitySystemNotificationsEnabled: true,
      },
    });

    return {
      classroomActivityEmailsEnabled:
        settings?.classroomActivityEmailsEnabled ?? false,
      classroomActivitySystemNotificationsEnabled:
        settings?.classroomActivitySystemNotificationsEnabled ?? true,
    };
  }

  private getSubmissionRecipientUserIds(record: any) {
    const memberIds = Array.isArray(record?.members)
      ? record.members
          .map((member: any) => member?.id)
          .filter((value: any): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    return Array.from(
      new Set(
        [record?.studentUserId, record?.studentId, ...memberIds].filter(
          (value: any): value is string => typeof value === 'string' && value.trim().length > 0,
        ),
      ),
    );
  }

  private async notifyOperationalUsers(
    userIds: string[],
    input: {
      title: string;
      body: string;
      dedupeKeyPrefix?: string;
      mailIdempotencyKeyPrefix?: string;
    },
  ) {
    const uniqueUserIds = Array.from(
      new Set(userIds.filter((value) => typeof value === 'string' && value.trim().length > 0)),
    );
    if (!uniqueUserIds.length) {
      return;
    }

    const preferences = await this.getNotificationPreferences();
    if (preferences.classroomActivitySystemNotificationsEnabled) {
      await Promise.all(
        uniqueUserIds.map((userId) =>
          this.notificationRepository.create({
            userId,
            title: input.title,
            body: input.body,
            type: 'system',
            dedupeKey: input.dedupeKeyPrefix
              ? `${input.dedupeKeyPrefix}:${userId}`
              : undefined,
          }),
        ),
      );
    }

    if (!preferences.classroomActivityEmailsEnabled) {
      return;
    }

    const users = await Promise.all(uniqueUserIds.map((id) => this.userRepository.findById(id)));
    try {
      await Promise.all(
        users
          .filter((user: any) => user?.email)
          .map((user: any) =>
            this.mailService.queueTransactional({
              to: user.email,
              recipientName:
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                'ProjTrack user',
              templateKey: MAIL_TEMPLATE_KEYS.BROADCAST,
              subject: input.title,
              payload: {
                name:
                  [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                  'ProjTrack user',
                title: input.title,
                body: input.body,
                mailCategory: MAIL_CATEGORY_KEYS.NOTIFICATION,
              },
              idempotencyKey: input.mailIdempotencyKeyPrefix
                ? `${input.mailIdempotencyKeyPrefix}:${String(user.email).trim().toLowerCase()}`
                : undefined,
            }),
          ),
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unknown mail queue failure.';
      this.logger.warn(
        `Skipping submission email queue while keeping in-app notifications active: ${detail}`,
      );
    }
  }

  private async decorate(record: any) {
    const subject: any = record.subjectId ? await this.subjectRepository.findSubjectById(record.subjectId) : null;
    const activity: any = record.activityId ? await this.subjectRepository.findActivityById(record.activityId) : record.task;
    const student: any = record.studentUserId
      ? await this.userRepository.findById(record.studentUserId)
      : record.studentId
        ? await this.userRepository.findById(record.studentId)
        : record.student || null;

    let group: any = record.group;
    if (!group && record.groupId && subject?.id) {
      const groups: any[] = await this.subjectRepository.listGroupsBySubject(subject.id);
      group = groups.find((item: any) => item.id === record.groupId);
    }

    let members: any[] = [];
    if (group?.memberUserIds) {
      const users = await Promise.all(group.memberUserIds.map((id: string) => this.userRepository.findById(id)));
      members = users.filter(Boolean).map((user: any) => ({ id: user.id, name: `${user.firstName} ${user.lastName}` }));
    } else if (group?.members) {
      members = group.members.map((member: any) => {
        const target = member.student;
        return { id: member.studentId, name: target ? `${target.firstName} ${target.lastName}` : member.studentId };
      });
    }

    const section =
      student?.section ||
      student?.studentProfile?.section?.name ||
      (group?.leaderUserId ? (await this.userRepository.findById(group.leaderUserId) as any)?.section : undefined);

    return {
      ...record,
      activityId: record.activityId || record.taskId,
      subjectName: subject?.name,
      subjectId: subject?.id,
      section,
      activityTitle: activity?.title,
      submissionMode: activity?.submissionMode,
      studentName: student ? `${student.firstName} ${student.lastName}` : undefined,
      groupName: group?.name,
      members,
      description: record.description,
      notes: record.notes,
      externalLinks: Array.isArray(record.externalLinks) ? record.externalLinks : [],
      externalLink: Array.isArray(record.externalLinks) && record.externalLinks.length ? record.externalLinks[0] : undefined,
      timeline: (record.events || []).map((event: any) => ({
        id: event.id,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        details: event.details || null,
        createdAt: event.createdAt,
      })),
      files: record.files?.map?.((file: any) => ({
        id: file.id,
        name: file.name || file.fileName,
        sizeKb: file.sizeKb || file.fileSize,
        relativePath: file.relativePath,
      })) || [],
    };
  }
}
