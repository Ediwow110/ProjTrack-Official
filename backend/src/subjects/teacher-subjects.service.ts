import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
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
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';
import {
  buildMasterListFileName,
  buildMasterListWorkbookBuffer,
} from '../common/utils/master-list-export';
import { buildStudentSubjectLink } from '../common/utils/frontend-links';

function normalizedText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function requiredText(value: unknown, fieldLabel: string) {
  const normalized = normalizedText(value);
  if (!normalized) {
    throw new BadRequestException(`${fieldLabel} is required.`);
  }
  return normalized;
}

function studentSubjectLink(subjectId: string) {
  return buildStudentSubjectLink(subjectId);
}

const DEFAULT_TEACHER_STUDENTS_TAKE = 100;
const MAX_TEACHER_STUDENTS_TAKE = 500;

@Injectable()
export class TeacherSubjectsService {
  private readonly logger = new Logger(TeacherSubjectsService.name);

  constructor(
    private readonly subjectRepository: SubjectRepository,
    private readonly submissionRepository: SubmissionRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly auditLogs: AuditLogsService,
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

  private async ensureTeacherOwnsSubject(subjectId: string, teacherId?: string) {
    const teacherUserId = this.requireAuthenticatedUserId(teacherId, 'teacher');
    await this.access.requireTeacherOwnsSubject(teacherUserId, subjectId);
    const subject: any = await this.subjectRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundException('Subject not found.');
    return subject;
  }

  private getSubjectStudentUserIds(subject: any): string[] {
    return Array.from(new Set((subject?.enrollments || [])
      .map((enrollment: any) => enrollment.student?.user?.id)
      .filter((value: any): value is string => typeof value === 'string' && value.trim().length > 0)));
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

  private async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    type = 'system',
    dedupeKeyPrefix?: string,
  ) {
    const preferences = await this.getNotificationPreferences();
    if (!preferences.classroomActivitySystemNotificationsEnabled) {
      return 0;
    }
    await Promise.all(
      userIds.map((userId) =>
        this.notificationRepository.create({
          userId,
          title,
          body,
          type,
          dedupeKey: dedupeKeyPrefix ? `${dedupeKeyPrefix}:${userId}` : undefined,
        }),
      ),
    );
    return userIds.length;
  }

  private async queueEmailsForUsers(
    userIds: string[],
    input: {
      templateKey: string;
      title: string;
      body: string;
      subjectName?: string;
      teacherName?: string;
      activityLink?: string;
      suppressDeliveryErrors?: boolean;
      idempotencyKeyPrefix?: string;
      rateLimit?: {
        actorUserId?: string;
        subjectId?: string;
        action: string;
      };
    },
  ) {
    const warnings: string[] = [];
    const preferences = await this.getNotificationPreferences();
    if (!preferences.classroomActivityEmailsEnabled) {
      warnings.push('Classroom activity emails are disabled in system settings.');
      return { emailJobsQueued: 0, emailQueueWarnings: warnings };
    }
    if (input.rateLimit) {
      const allowed = await this.consumeTeacherEmailRateLimit(input.rateLimit);
      if (!allowed) {
        const message = `Teacher notification email rate limit reached for subject ${input.rateLimit.subjectId || 'unknown'}.`;
        this.logger.warn(`Skipping classroom email queue because ${message}`);
        warnings.push(message);
        return { emailJobsQueued: 0, emailQueueWarnings: warnings };
      }
    }
    const users = await Promise.all(userIds.map((id) => this.userRepository.findById(id)));
    const unique = new Map<string, any>();
    users.filter(Boolean).forEach((user: any) => {
      if (user?.email) unique.set(String(user.email).trim().toLowerCase(), user);
    });

    if (unique.size === 0) {
      warnings.push('No enrolled recipients had an email address, so no email jobs were queued.');
      return { emailJobsQueued: 0, emailQueueWarnings: warnings };
    }

    try {
      const jobs = await Promise.all(
        Array.from(unique.values()).map((user: any) =>
          this.mailService.queueTransactional({
            to: user.email,
            recipientName:
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              'Student',
            templateKey: input.templateKey,
            subject: input.title,
            payload: {
              firstName: user.firstName || undefined,
              name:
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                'Student',
              title: input.title,
              body: input.body,
              subjectName: input.subjectName,
              teacherName: input.teacherName,
              activityLink: input.activityLink,
              mailCategory: MAIL_CATEGORY_KEYS.NOTIFICATION,
            },
            idempotencyKey: input.idempotencyKeyPrefix
              ? `${input.idempotencyKeyPrefix}:${String(user.email).trim().toLowerCase()}`
              : undefined,
          }),
        ),
      );
      const queued = jobs.filter((job: any) => Boolean(job?.id)).length;
      if (queued !== unique.size) {
        warnings.push(`Mail queue confirmed ${queued} of ${unique.size} expected jobs.`);
      }
      return { emailJobsQueued: queued, emailQueueWarnings: warnings };
    } catch (error) {
      if (!input.suppressDeliveryErrors) {
        throw error;
      }

      const detail =
        error instanceof Error ? error.message : 'Unknown mail queue failure.';
      this.logger.warn(
        `Skipping classroom email queue while keeping in-app notifications active: ${detail}`,
      );
      warnings.push(`Email jobs were not queued: ${detail}`);
      return { emailJobsQueued: 0, emailQueueWarnings: warnings };
    }
  }

  private async consumeTeacherEmailRateLimit(input: {
    actorUserId?: string;
    subjectId?: string;
    action: string;
  }) {
    const actorUserId = String(input.actorUserId || '').trim();
    const subjectId = String(input.subjectId || '').trim();
    if (!actorUserId || !subjectId) {
      return true;
    }

    const action = `teacher:classroom-email:${String(input.action || 'notify').trim().toLowerCase() || 'notify'}`;
    const key = `${actorUserId}|${subjectId}`;
    const limit = Math.max(1, Number(process.env.TEACHER_CLASSROOM_EMAIL_MAX_PER_HOUR || 20));
    const windowMs = Math.max(60_000, Number(process.env.TEACHER_CLASSROOM_EMAIL_WINDOW_MS || 60 * 60 * 1000));
    const blockMs = Math.max(60_000, Number(process.env.TEACHER_CLASSROOM_EMAIL_BLOCK_MS || 60 * 60 * 1000));
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    await this.prisma.authRateLimit.deleteMany({
      where: {
        action,
        key,
        firstAttemptAt: { lte: windowStart },
      },
    });

    const updated = await this.prisma.authRateLimit.upsert({
      where: { action_key: { action, key } },
      update: {
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
      create: {
        action,
        key,
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      },
    });

    if (updated.blockedUntil && updated.blockedUntil.getTime() > now.getTime()) {
      return false;
    }

    if (updated.attempts > limit) {
      await this.prisma.authRateLimit.update({
        where: { action_key: { action, key } },
        data: {
          blockedUntil: new Date(now.getTime() + blockMs),
          lastAttemptAt: now,
        },
      });
      return false;
    }

    return true;
  }

  private async lookupUserName(userId?: string) {
    if (!userId) return 'Unknown';
    const user: any = await this.userRepository.findById(userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  }

  private formatUserName(user: { firstName?: string | null; lastName?: string | null } | any) {
    return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Unknown';
  }

  private formatStatusLabel(value: string) {
    const normalized = String(value || 'ACTIVE').trim().toUpperCase().replace(/_/g, ' ');
    if (normalized === 'ACTIVE') return 'Active';
    if (normalized === 'INACTIVE') return 'Inactive';
    return normalized.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async teacherSubjects(teacherId?: string) {
    return this.subjectRepository.listSubjectsForTeacher(
      this.requireAuthenticatedUserId(teacherId, 'teacher'),
    );
  }

  async teacherStudents(
    teacherId?: string,
    search?: string,
    section?: string,
    options?: { take?: number; skip?: number },
  ) {
    const teacherUserId = this.requireAuthenticatedUserId(teacherId, 'teacher');
    const subjects: any[] = await this.subjectRepository.listSubjectsForTeacher(teacherUserId);
    if (!subjects.length) {
      return [];
    }

    const byStudent = new Map<string, any>();
    const subjectIds = subjects.map((subject: any) => subject.id).filter(Boolean);
    const assignedActivities = subjects.reduce(
      (total: number, subject: any) => total + (Array.isArray(subject.tasks) ? subject.tasks.length : 0),
      0,
    );

    for (const subject of subjects) {
      for (const enrollment of subject.enrollments || []) {
        const user = enrollment.student?.user;
        if (!user?.id) continue;
        const existing = byStudent.get(user.id) || {
          user,
          studentProfile: enrollment.student,
          sectionName: enrollment.section?.name || enrollment.student?.section?.name || '—',
          subjectIds: new Set<string>(),
        };
        existing.subjectIds.add(subject.id);
        byStudent.set(user.id, existing);
      }
    }

    if (!byStudent.size) {
      return [];
    }

    const q = String(search || '').trim().toLowerCase();
    const filteredStudents = Array.from(byStudent.entries())
      .map(([studentUserId, row]) => {
        const user = row.user;
        const studentIdVal = row.studentProfile?.studentNumber || user.studentNumber || user.id;
        const name = `${user.firstName} ${user.lastName}`.trim();
        const email = user.email || '';
        const sectionName = row.sectionName || '—';
        return {
          studentUserId,
          row,
          studentId: studentIdVal,
          name,
          email,
          section: sectionName,
        };
      })
      .filter((item) => {
        return !section || section === 'All' || item.section === section;
      })
      .filter((item) => {
        return !q ||
          item.name.toLowerCase().includes(q) ||
          item.studentId.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q);
      });

    const take = options?.take !== undefined ? Math.max(1, Math.min(options.take, MAX_TEACHER_STUDENTS_TAKE)) : DEFAULT_TEACHER_STUDENTS_TAKE;
    const skip = options?.skip !== undefined ? Math.max(0, options.skip) : 0;
    const paginatedStudents = filteredStudents.slice(skip, skip + take);
    const paginatedStudentIds = paginatedStudents.map(item => item.studentUserId);

    let progressRows: any[] = [];
    if (paginatedStudentIds.length > 0) {
      progressRows = await this.prisma.submission.findMany({
        where: {
          subjectId: { in: subjectIds },
          OR: [
            { studentId: { in: paginatedStudentIds } },
            { group: { members: { some: { studentId: { in: paginatedStudentIds } } } } },
          ],
        },
        include: {
          group: { include: { members: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });
    }

    return paginatedStudents.map(({ studentUserId, row, studentId, name, email, section: sectionName }) => {
      const user = row.user;
      const studentSubmissions = progressRows.filter((submission: any) => {
        if (submission.studentId === studentUserId) return true;
        return submission.group?.members?.some((member: any) => member.studentId === studentUserId);
      });
      return {
        id: user.id,
        studentId,
        academicYear:
          row.studentProfile?.academicYear?.name ||
          row.studentProfile?.section?.academicYear?.name ||
          '—',
        name,
        email,
        section: sectionName,
        subjects: row.subjectIds.size,
        assignedActivities,
        submittedCount: studentSubmissions.filter((item: any) => ['SUBMITTED', 'PENDING_REVIEW', 'REVIEWED', 'GRADED', 'LATE', 'NEEDS_REVISION'].includes(String(item.status).toUpperCase())).length,
        gradedCount: studentSubmissions.filter((item: any) => String(item.status).toUpperCase() === 'GRADED').length,
        needsRevisionCount: studentSubmissions.filter((item: any) => String(item.status).toUpperCase() === 'NEEDS_REVISION').length,
        lateCount: studentSubmissions.filter((item: any) => String(item.status).toUpperCase() === 'LATE').length,
        lastSubmissionDate: studentSubmissions[0]?.submittedAt?.toISOString?.() || null,
        status:
          user.status === 'ACTIVE'
            ? 'Active'
            : String(user.status || 'ACTIVE')
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, (match) => match.toUpperCase()),
      };
    });
  }

  async teacherSections(teacherUserId: string, options?: { take?: number; skip?: number }) {
    const teacherProfile = await this.prisma.teacherProfile.findFirst({
      where: { userId: teacherUserId },
    });
    if (!teacherProfile) {
      return [];
    }

    const take = options?.take !== undefined ? Math.max(1, Math.min(options.take, 500)) : 100;
    const skip = options?.skip !== undefined ? Math.max(0, options.skip) : 0;

    const sections = await this.prisma.section.findMany({
      take,
      skip,
      where: {
        enrollments: {
          some: {
            subject: { teacherId: teacherProfile.id },
          },
        },
      },
      include: {
        academicYear: true,
        academicYearLevel: true,
        students: true,
        enrollments: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [{ academicYear: { name: 'desc' } }, { name: 'asc' }],
    });

    return sections.map((section) => ({
      id: section.id,
      code: section.name,
      academicYear: section.academicYear?.name || 'Unassigned',
      yearLevel:
        section.academicYearLevel?.name ||
        section.yearLevelName ||
        (section.yearLevel ? `${section.yearLevel}` : 'Unassigned'),
      course: section.course || '',
      students: section.students.length,
      subjects: new Set(
        section.enrollments
          .filter((enrollment) => enrollment.subject?.teacherId === teacherProfile.id)
          .map((enrollment) => enrollment.subjectId),
      ).size,
      adviser: String(section.adviserName ?? '').trim() || 'Unassigned',
    }));
  }

  async teacherSectionMasterList(sectionId: string, teacherUserId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findFirst({
      where: { userId: teacherUserId },
    });
    if (!teacherProfile) {
      throw new ForbiddenException('Teacher access is required.');
    }

    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        enrollments: {
          some: {
            subject: { teacherId: teacherProfile.id },
          },
        },
      },
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
      throw new ForbiddenException('You can only access master lists for your assigned sections.');
    }

    const rows = section.students
      .map((student) => ({
        id: student.userId,
        studentId: student.studentNumber,
        lastName: student.user.lastName,
        firstName: student.user.firstName,
        middleInitial: String(student.middleInitial ?? '').trim(),
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

        const middleInitialCompare = left.middleInitial.localeCompare(right.middleInitial, 'en', {
          sensitivity: 'base',
        });
        if (middleInitialCompare !== 0) return middleInitialCompare;

        return left.studentId.localeCompare(right.studentId, 'en', {
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
          (section.yearLevel ? `${section.yearLevel}` : 'Unassigned'),
        course: section.course || '',
      },
      rows,
    };
  }

  async teacherSectionMasterListExport(sectionId: string, teacherUserId: string) {
    const masterList = await this.teacherSectionMasterList(sectionId, teacherUserId);
    return {
      fileName: buildMasterListFileName({
        academicYear: masterList.section.academicYear,
        yearLevel: masterList.section.yearLevel,
        section: masterList.section.name,
        adviser: masterList.section.adviser,
      }),
      buffer: await buildMasterListWorkbookBuffer(
        {
          academicYear: masterList.section.academicYear,
          yearLevel: masterList.section.yearLevel,
          section: masterList.section.name,
          adviser: masterList.section.adviser,
        },
        masterList.rows,
      ),
    };
  }

  async teacherSubjectDetail(id: string, teacherId?: string) {
    const subject: any = await this.ensureTeacherOwnsSubject(id, teacherId);

    const submissions = await this.subjectRepository.listActivitiesBySubject(id);
    const groups = await this.subjectRepository.listGroupsBySubject(id);
    const enrollments = (subject.enrollments || []).map((enrollment: any) => {
      const user = enrollment.student?.user;
      return {
        id: enrollment.id,
        section: enrollment.section
          ? { id: enrollment.section.id, name: enrollment.section.name }
          : enrollment.student?.section
            ? { id: enrollment.student.section.id, name: enrollment.student.section.name }
            : null,
        student: user
          ? {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName,
              lastName: user.lastName,
              status: user.status,
              avatarUrl: user.avatarUrl,
              studentNumber: enrollment.student?.studentNumber,
              section: enrollment.student?.section
                ? { id: enrollment.student.section.id, name: enrollment.student.section.name }
                : null,
            }
          : null,
      };
    });
    const students = enrollments
      .map((enrollment: any) =>
        enrollment.student
          ? {
              ...enrollment.student,
              studentProfile: {
                studentNumber: enrollment.student.studentNumber,
                section: enrollment.student.section || enrollment.section,
              },
            }
          : null,
      )
      .filter(Boolean);
    const safeGroups = (groups || []).map((group: any) => ({
      id: group.id,
      subjectId: group.subjectId,
      sectionId: group.sectionId,
      name: group.name,
      inviteCode: group.inviteCode,
      leaderId: group.leaderId,
      status: group.status,
      createdAt: group.createdAt,
      section: group.section ? { id: group.section.id, name: group.section.name } : null,
      members: (group.members || []).map((member: any) => ({
        id: member.id,
        studentId: member.studentId,
        role: member.role,
        status: member.status,
        student: member.student
          ? {
              id: member.student.id,
              email: member.student.email,
              role: member.student.role,
              firstName: member.student.firstName,
              lastName: member.student.lastName,
              status: member.student.status,
              avatarUrl: member.student.avatarUrl,
            }
          : null,
      })),
      subject: {
        enrollments: enrollments.map((enrollment: any) => ({ section: enrollment.section })),
      },
    }));

    return {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      status: subject.status,
      isOpen: subject.isOpen,
      allowLateSubmission: subject.allowLateSubmission,
      groupEnabled: subject.groupEnabled,
      minGroupSize: subject.minGroupSize,
      maxGroupSize: subject.maxGroupSize,
      teacher: subject.teacher?.user
        ? {
            user: {
              id: subject.teacher.user.id,
              email: subject.teacher.user.email,
              role: subject.teacher.user.role,
              firstName: subject.teacher.user.firstName,
              lastName: subject.teacher.user.lastName,
              status: subject.teacher.user.status,
              avatarUrl: subject.teacher.user.avatarUrl,
            },
          }
        : null,
      enrollments,
      submissions,
      students,
      groups: safeGroups,
    };
  }

  async createTeacherActivity(subjectId: string, body: any) {
    const subject: any = await this.ensureTeacherOwnsSubject(subjectId, body.actorUserId);
    const activityTitle = requiredText(body.title, 'Activity title');
    const teacherName = await this.lookupUserName(body.actorUserId);
    const activityLink = `${studentSubjectLink(subject.id)}?tab=activities`;

    const activity: any = await this.subjectRepository.createActivity(subjectId, {
      ...body,
      title: activityTitle,
    });
    const studentUserIds = this.getSubjectStudentUserIds(subject);
    const safeActivityTitle = normalizedText(activity?.title, activityTitle) || 'New activity';
    const notificationTitle =
      normalizedText(body.notificationTitle) ||
      `New submission posted in ${subject.code || subject.name}`;
    const notificationBody =
      normalizedText(body.notificationBody) ||
      `${safeActivityTitle} is now available. Check the subject activities and submit before the deadline.`;
    const inAppNotificationsCreated = await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'submission',
      `classroom:activity-created:${activity.id}`,
    );
    let mailQueue = { emailJobsQueued: 0, emailQueueWarnings: [] as string[] };

    if (body.notifyByEmail) {
      mailQueue = await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName,
      activityLink,
      suppressDeliveryErrors: true,
      idempotencyKeyPrefix: `mail:activity-created:${activity.id}`,
      rateLimit: {
        actorUserId: body.actorUserId,
        subjectId: subject.id,
        action: 'activity-created',
      },
    });
    }

    await this.auditLogs.record({
      actorUserId: body.actorUserId,
      actorRole: 'TEACHER',
      action: 'ACTIVITY_CREATED',
      module: 'Subjects',
      target: safeActivityTitle,
      entityId: activity.id,
      result: 'Success',
      details: `Created activity in subject ${subjectId}.`,
    });
    return {
      ...activity,
      success: true,
      notified: studentUserIds.length,
      inAppNotificationsCreated,
      emailJobsQueued: mailQueue.emailJobsQueued,
      emailQueueWarnings: mailQueue.emailQueueWarnings,
    };
  }

  async updateTeacherActivity(subjectId: string, activityId: string, body: any) {
    await this.access.requireTeacherOwnsActivity(body.actorUserId, subjectId, activityId);

    const activity: any = await this.subjectRepository.updateActivity(activityId, body);
    if (!activity) throw new NotFoundException('Activity not found.');

    await this.auditLogs.record({
      actorUserId: body.actorUserId,
      actorRole: 'TEACHER',
      action: 'ACTIVITY_UPDATED',
      module: 'Subjects',
      target: activity.title,
      entityId: activity.id,
      result: 'Success',
      details: `Updated activity in subject ${subjectId}.`,
    });
    return activity;
  }

  async notifySubjectStudents(subjectId: string, body: any) {
    const subject: any = await this.ensureTeacherOwnsSubject(subjectId, body.actorUserId);
    const notificationTitle =
      normalizedText(body.title) || `Update from ${subject.code || subject.name}`;
    const notificationBody = requiredText(
      body.message || body.body,
      'Notification message',
    );
    const teacherName = await this.lookupUserName(body.actorUserId);
    const activityLink = studentSubjectLink(subject.id);

    const studentUserIds = this.getSubjectStudentUserIds(subject);
    const inAppNotificationsCreated = await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      body.type || 'announcement',
    );
    const mailQueue = await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName,
      activityLink,
      suppressDeliveryErrors: true,
      rateLimit: {
        actorUserId: body.actorUserId,
        subjectId: subject.id,
        action: 'manual-notify',
      },
    });

    await this.auditLogs.record({
      actorUserId: body.actorUserId,
      actorRole: 'TEACHER',
      action: 'STUDENTS_NOTIFIED',
      module: 'Subjects',
      target: subject.name,
      entityId: subject.id,
      result: 'Success',
      details: `Notified ${studentUserIds.length} enrolled students.`,
    });

    return {
      success: true,
      notified: studentUserIds.length,
      inAppNotificationsCreated,
      emailJobsQueued: mailQueue.emailJobsQueued,
      emailQueueWarnings: mailQueue.emailQueueWarnings,
    };
  }

  async updateRestrictions(subjectId: string, body: any) {
    await this.ensureTeacherOwnsSubject(subjectId, body.actorUserId);
    const subject: any = await this.subjectRepository.updateRestrictions(subjectId, body);
    if (!subject) throw new NotFoundException('Subject not found.');

    await this.auditLogs.record({
      actorUserId: body.actorUserId,
      actorRole: 'TEACHER',
      action: 'RESTRICTIONS_UPDATED',
      module: 'Subjects',
      target: subject.name,
      entityId: subject.id,
      result: 'Success',
      details: 'Updated subject restrictions.',
    });
    return subject;
  }

  async reopenSubject(subjectId: string, actorUserId?: string) {
    await this.ensureTeacherOwnsSubject(subjectId, actorUserId);
    const subject: any = await this.subjectRepository.reopenSubject(subjectId);
    if (!subject) throw new NotFoundException('Subject not found.');

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'SUBJECT_REOPENED',
      module: 'Subjects',
      target: subject.name,
      entityId: subject.id,
      result: 'Success',
    });

    const studentUserIds = this.getSubjectStudentUserIds(subject);
    const notificationTitle = `${subject.code || subject.name} has reopened`;
    const notificationBody =
      'Your teacher reopened this subject for updates and follow-up work.';
    const inAppNotificationsCreated = await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'announcement',
      `classroom:subject-reopened:${subject.id}`,
    );
    const mailQueue = await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName: await this.lookupUserName(actorUserId),
      activityLink: studentSubjectLink(subject.id),
      suppressDeliveryErrors: true,
      idempotencyKeyPrefix: `mail:subject-reopened:${subject.id}`,
      rateLimit: {
        actorUserId,
        subjectId: subject.id,
        action: 'subject-reopened',
      },
    });

    return {
      success: true,
      notified: studentUserIds.length,
      inAppNotificationsCreated,
      emailJobsQueued: mailQueue.emailJobsQueued,
      emailQueueWarnings: mailQueue.emailQueueWarnings,
    };
  }

  async reopenTeacherActivity(subjectId: string, activityId: string, actorUserId?: string) {
    await this.access.requireTeacherOwnsActivity(actorUserId, subjectId, activityId);
    const subject: any = await this.ensureTeacherOwnsSubject(subjectId, actorUserId);

    const activity: any = await this.subjectRepository.reopenActivity(activityId);
    if (!activity) throw new NotFoundException('Activity not found.');
    const safeActivityTitle = normalizedText(activity?.title, 'This activity');

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'ACTIVITY_REOPENED',
      module: 'Subjects',
      target: safeActivityTitle,
      entityId: activity.id,
      result: 'Success',
    });

    const studentUserIds = this.getSubjectStudentUserIds(subject);
    const notificationTitle = `${safeActivityTitle} reopened`;
    const notificationBody =
      'This submission has been reopened. Review the requirements and submit your updated work if needed.';
    const inAppNotificationsCreated = await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'submission',
      `classroom:activity-reopened:${activity.id}`,
    );
    const mailQueue = await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName: await this.lookupUserName(actorUserId),
      activityLink: `${studentSubjectLink(subject.id)}?tab=activities`,
      suppressDeliveryErrors: true,
      idempotencyKeyPrefix: `mail:activity-reopened:${activity.id}`,
      rateLimit: {
        actorUserId,
        subjectId: subject.id,
        action: 'activity-reopened',
      },
    });

    return {
      success: true,
      notified: studentUserIds.length,
      inAppNotificationsCreated,
      emailJobsQueued: mailQueue.emailJobsQueued,
      emailQueueWarnings: mailQueue.emailQueueWarnings,
    };
  }
}
