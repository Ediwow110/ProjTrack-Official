import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  ) {}

  async studentList(userId = 'usr_student_1', status?: string) {
    const rows: any[] = await this.submissionRepository.listStudentSubmissions(userId, status);
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async studentDetail(id: string, userId?: string) {
    const record = await this.submissionRepository.findSubmissionById(id);
    if (!record) throw new NotFoundException('Submission not found.');
    if (!userId || !(await this.canStudentAccessSubmission(userId, record))) {
      throw new ForbiddenException('You do not have access to this submission.');
    }
    return this.decorate(record);
  }

  async submit(body: { activityId: string; title?: string; userId?: string; groupId?: string; description?: string; notes?: string; externalLinks?: string[]; files?: { name: string; sizeKb: number; relativePath?: string }[] }) {
    const userId = body.userId;
    if (!userId) throw new ForbiddenException('Authenticated student session is required.');

    const activity: any = await this.subjectRepository.findActivityById(body.activityId);
    if (!activity) throw new NotFoundException('Activity not found.');

    const windowStatus = String(activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED')).toUpperCase();
    if (!['OPEN', 'REOPENED'].includes(windowStatus)) {
      throw new BadRequestException('This activity is not open for submission.');
    }

    const groupMode = String(activity.submissionMode || '').toUpperCase() === 'GROUP';
    if (groupMode) {
      const groups: any[] = await this.subjectRepository.listGroupsBySubject(activity.subjectId);
      const membership = groups.find((group: any) => group.memberUserIds?.includes?.(userId) || group.members?.some?.((member: any) => member.studentId === userId));
      if (!membership) {
        throw new BadRequestException('You must belong to a valid group before submitting this group activity.');
      }
      if (String(membership.status || '').toUpperCase() === 'LOCKED') {
        throw new BadRequestException('This group is locked and cannot submit right now.');
      }
      if (body.groupId && String(body.groupId) !== String(membership.id)) {
        throw new ForbiddenException('Submission group does not match your current subject group.');
      }
      body.groupId = membership.id;
    } else {
      body.groupId = undefined;
    }

    const existingSubmission: any = groupMode && body.groupId
      ? await this.submissionRepository.findExistingSubmission(body.activityId, undefined, body.groupId)
      : await this.submissionRepository.findExistingSubmission(body.activityId, userId);

    if (existingSubmission && !canStudentEditSubmission(existingSubmission.status)) {
      throw new BadRequestException('This submission can no longer be edited or resubmitted from the student workflow.');
    }

    const record: any = await this.submissionRepository.createOrUpdateSubmission({
      ...body,
      userId,
    });
    if (!record) throw new NotFoundException('Activity not found.');
    const subject: any = await this.subjectRepository.findSubjectById(activity.subjectId);
    const actor: any = await this.userRepository.findById(userId);

    const linkedPaths = (body.files || [])
      .map((file) => file.relativePath)
      .filter(Boolean) as string[];

    if (linkedPaths.length) {
      this.filesService.attachFilesToSubmission({
        relativePaths: linkedPaths,
        submissionId: record.id,
        activityId: body.activityId,
        subjectId: record.subjectId,
      });
    }

    await this.auditLogs.record({
      actorUserId: userId,
      actorRole: 'STUDENT',
      action: 'SUBMISSION_CREATED',
      module: 'Submissions',
      target: record.title,
      entityId: record.id,
      result: 'Success',
    });

    const teacherUserId = subject?.teacher?.user?.id;
    if (teacherUserId) {
      const studentName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'A student';
      await this.notifyOperationalUsers([teacherUserId], {
        title: `New submission in ${subject?.name || 'your subject'}`,
        body: `${studentName} submitted ${record.title}. Open the teacher submission queue to review it.`,
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
    if (!teacherId || !(await this.canTeacherAccessSubmission(teacherId, record))) {
      throw new ForbiddenException('You do not have access to this submission.');
    }
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
    if (!body.actorUserId || !(await this.canTeacherAccessSubmission(body.actorUserId, existing))) {
      throw new ForbiddenException('You do not have access to review this submission.');
    }
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

      await this.notifyOperationalUsers(recipientIds, statusMessage);
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
    input: { title: string; body: string },
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
      files: record.files?.map?.((file: any) => ({
        id: file.id,
        name: file.name || file.fileName,
        sizeKb: file.sizeKb || file.fileSize,
        relativePath: file.relativePath,
      })) || [],
    };
  }
}
