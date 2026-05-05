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

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

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
      throw new ForbiddenException('You do not have access to this subject.');
    }

    return studentProfile;
  }

  async studentSubjects(userId?: string) {
    const rows = await this.subjectRepository.listSubjectsForStudent(
      this.requireAuthenticatedUserId(userId, 'student'),
    );
    return rows.map((subject: any) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      status: subject.status,
      isOpen: subject.isOpen,
      groupEnabled: subject.groupEnabled,
      sections: subject.sections || [],
      teacher: subject.teacher?.user
        ? {
            id: subject.teacher.user.id,
            firstName: subject.teacher.user.firstName,
            lastName: subject.teacher.user.lastName,
          }
        : null,
      activities: (subject.tasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        deadline: task.deadline,
        submissionMode: task.submissionMode,
        isOpen: task.isOpen,
      })),
    }));
  }

  async studentSubmitCatalog(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(studentUserId);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId);

    const canSubmitFromActivity = (activity: any, match: any) => {
      const windowStatus = String(activity?.windowStatus ?? (activity?.isOpen ? 'OPEN' : 'CLOSED')).trim().toUpperCase();
      const submissionStatus = String(match?.status ?? 'NOT_STARTED').trim().toUpperCase();
      if (['SUBMITTED', 'PENDING_REVIEW', 'REVIEWED', 'GRADED', 'LATE'].includes(submissionStatus)) return false;
      if (submissionStatus === 'NEEDS_REVISION' || windowStatus === 'REOPENED') return true;
      return windowStatus === 'OPEN' || submissionStatus === 'DRAFT';
    };

    const catalog = {
      subjects: [] as string[],
      activities: {} as Record<string, any[]>,
    };

    for (const subject of subjects) {
      const subjectId = String(subject?.id || '').trim();
      const subjectName = String(subject?.name || '').trim();
      if (!subjectId || !subjectName) continue;

      const activities: any[] = await this.subjectRepository.listActivitiesBySubject(subjectId);
      const groups: any[] = await this.subjectRepository.listGroupsBySubject(subjectId);
      const group = groups.find((item: any) => item.memberUserIds?.includes?.(studentUserId) || item.members?.some?.((member: any) => member.studentId === studentUserId)) || null;

      catalog.subjects.push(subjectName);
      catalog.activities[subjectName] = await Promise.all(activities.map(async (activity: any) => {
        const match = submissions.find((submission: any) => submission.activityId === activity.id || submission.taskId === activity.id);
        const members = group ? await this.mapGroupMembers(group) : [];
        const type = String(activity?.submissionMode || '').toUpperCase() === 'GROUP' ? 'group' : 'individual';
        const canSubmit = canSubmitFromActivity(activity, match);
        const submissionStatus = String(match?.status ?? 'NOT_STARTED').replace(/_/g, ' ');
        return {
          id: activity.id,
          subjectId,
          title: activity.title,
          type,
          due: activity.deadline
            ? new Date(activity.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '—',
          rules: Array.isArray(activity?.rules) && activity.rules.length
            ? activity.rules
            : [
                'Accepted file types depend on the selected activity.',
                'Your teacher controls whether this submission is individual or group-based.',
                'Submitted work will appear in your submission history after saving.',
              ],
          groupId: group?.id,
          groupName: group?.name,
          members: members.map((member: any) => member.name),
          canSubmit,
          submissionContext: {
            submissionMode: type,
            accessLabel: canSubmit ? 'Can submit now' : (submissionStatus !== 'NOT STARTED' ? `Already ${submissionStatus.toLowerCase()}` : 'Window not open'),
            availabilityMessage: canSubmit
              ? 'This activity is open for submission.'
              : submissionStatus !== 'NOT STARTED'
                ? 'You already have a recorded submission for this activity. Open your submissions to review it.'
                : 'This activity is configured, but the submission window is not open yet.',
            group: type === 'group'
              ? {
                  id: group?.id,
                  name: group?.name,
                  leader: group ? await this.lookupUserName(group.leaderUserId || group.leaderId) : undefined,
                  members: members.map((member: any) => member.name),
                }
              : null,
          },
        };
      }));
    }

    catalog.subjects = Array.from(new Set(catalog.subjects));
    return catalog;
  }

  async studentSubjectDetail(id: string, userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const subject: any = await this.subjectRepository.findSubjectById(id);
    if (!subject) throw new NotFoundException('Subject not found.');
    await this.ensureStudentEnrolledInSubject(studentUserId, id);

    const activities: any[] = await this.subjectRepository.listActivitiesBySubject(id);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId);
    const groups: any[] = await this.subjectRepository.listGroupsBySubject(id);
    const group = groups.find((item: any) =>
      item.memberUserIds?.includes?.(studentUserId) ||
      item.members?.some?.((member: any) => member.studentId === studentUserId)
    ) || null;
    const groupMembers = group ? await this.mapGroupMembers(group) : [];
    const groupLeader = group
      ? groupMembers.find((member: any) => member.isLeader)?.name || await this.lookupUserName(group.leaderUserId || group.leaderId)
      : undefined;

    return {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      status: subject.status,
      isOpen: subject.isOpen,
      groupEnabled: subject.groupEnabled,
      minGroupSize: subject.minGroupSize,
      maxGroupSize: subject.maxGroupSize,
      teacher: subject.teacher?.user
        ? {
            id: subject.teacher.user.id,
            firstName: subject.teacher.user.firstName,
            lastName: subject.teacher.user.lastName,
          }
        : null,
      activities: activities.map((activity: any) => {
        const match = submissions.find((submission: any) =>
          submission.activityId === activity.id || submission.taskId === activity.id,
        );
        const submissionStatus = match?.status ?? 'NOT_STARTED';
        const windowStatus = activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED');
        const actionLabel =
          submissionStatus === 'DRAFT' ? 'Continue' :
          submissionStatus === 'GRADED' ? 'View Result' :
          submissionStatus === 'SUBMITTED' || submissionStatus === 'PENDING_REVIEW' || submissionStatus === 'REVIEWED' || submissionStatus === 'LATE' ? 'View' :
          submissionStatus === 'NEEDS_REVISION' || windowStatus === 'REOPENED' ? 'Resubmit' :
          windowStatus === 'OPEN' ? 'Submit' : 'Closed';

        return {
          ...activity,
          windowStatus,
          submissionStatus,
          actionLabel,
        };
      }),
      group: group
        ? {
            id: group.id,
            name: group.name,
            status: group.status,
            inviteCode: group.inviteCode,
            leader: groupLeader,
            members: groupMembers,
          }
        : null,
    };
  }

  async studentSubmissionContext(activityId: string, userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const activity: any = await this.subjectRepository.findActivityById(activityId);
    if (!activity) throw new NotFoundException('Activity not found.');
    await this.ensureStudentEnrolledInSubject(studentUserId, activity.subjectId);

    const groups: any[] = await this.subjectRepository.listGroupsBySubject(activity.subjectId);
    const group = (activity.submissionMode === 'GROUP')
      ? groups.find((item: any) =>
          item.memberUserIds?.includes?.(studentUserId) ||
          item.members?.some?.((member: any) => member.studentId === studentUserId)
        )
      : null;

    return {
      activityId: activity.id,
      title: activity.title,
      submissionMode: activity.submissionMode,
      windowStatus: activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED'),
      canSubmit: (activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED')) === 'OPEN' || (activity.windowStatus === 'REOPENED'),
      group: group
        ? {
            id: group.id,
            name: group.name,
            inviteCode: group.inviteCode,
            leader: await this.lookupUserName(group.leaderUserId || group.leaderId),
            members: await this.mapGroupMembers(group),
          }
        : null,
    };
  }

  async teacherSubjects(teacherId?: string) {
    return this.subjectRepository.listSubjectsForTeacher(
      this.requireAuthenticatedUserId(teacherId, 'teacher'),
    );
  }

  async teacherStudents(teacherId?: string, search?: string, section?: string) {
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

    const progressRows = await this.prisma.submission.findMany({
      where: {
        subjectId: { in: subjectIds },
        OR: [
          { studentId: { in: Array.from(byStudent.keys()) } },
          { group: { members: { some: { studentId: { in: Array.from(byStudent.keys()) } } } } },
        ],
      },
      include: {
        group: { include: { members: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const q = String(search || '').trim().toLowerCase();
    return Array.from(byStudent.entries())
      .map(([studentUserId, row]) => {
        const user = row.user;
        const studentSubmissions = progressRows.filter((submission: any) => {
          if (submission.studentId === studentUserId) return true;
          return submission.group?.members?.some((member: any) => member.studentId === studentUserId);
        });
        const sectionName = row.sectionName || '—';
        return {
          id: user.id,
          studentId: row.studentProfile?.studentNumber || user.studentNumber || user.id,
          academicYear:
            row.studentProfile?.academicYear?.name ||
            row.studentProfile?.section?.academicYear?.name ||
            '—',
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
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
      })
      .filter((user: any) => {
        return !section || section === 'All' || user.section === section;
      })
      .filter(
        (row: any) =>
          !q ||
          row.name.toLowerCase().includes(q) ||
          row.studentId.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q),
      );
  }

  async teacherSections(teacherUserId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findFirst({
      where: { userId: teacherUserId },
    });
    if (!teacherProfile) {
      return [];
    }

    const sections = await this.prisma.section.findMany({
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

  async studentCalendar(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(studentUserId);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId);
    const items: any[] = [];

    for (const subject of subjects) {
      const activities: any[] = await this.subjectRepository.listActivitiesBySubject(subject.id);
      for (const activity of activities) {
        const match = submissions.find((submission: any) => submission.activityId === activity.id);
        items.push({
          id: activity.id,
          activityId: activity.id,
          subjectId: subject.id,
          subjectName: subject.name,
          title: activity.title,
          deadline: activity.deadline,
          submissionMode: activity.submissionMode,
          windowStatus: activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED'),
          submissionStatus: match?.status ?? 'NOT_STARTED',
          submissionId: match?.id,
        });
      }
    }

    return items.sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
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

  async createGroup(body: { subjectId: string; name: string; leaderUserId?: string }) {
    const leaderUserId = this.requireAuthenticatedUserId(body.leaderUserId, 'student');
    await this.access.requireStudentCanCreateGroup(leaderUserId, body.subjectId);
    return this.subjectRepository.createGroup({
      subjectId: body.subjectId,
      name: body.name,
      leaderUserId,
    });
  }

  async joinGroupByCode(body: { code: string; subjectId?: string; userId?: string }) {
    const userId = this.requireAuthenticatedUserId(body.userId, 'student');
    const subjectId = requiredText(body.subjectId, 'Subject');
    await this.access.requireStudentCanJoinGroup(userId, subjectId, body.code);
    const group = await this.subjectRepository.joinGroupByCode({
      code: body.code,
      subjectId,
      userId,
    });
    if (!group) throw new NotFoundException('Invite code not found.');
    return group;
  }

  async teacherApproveGroup(subjectId: string, groupId: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
    const minGroupSize = Math.max(1, Number(group.subject?.minGroupSize || 1));
    if (group.members.length < minGroupSize) {
      throw new BadRequestException(`Group must have at least ${minGroupSize} member(s) before it can become active.`);
    }
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'ACTIVE' },
    });

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'GROUP_APPROVED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: 'Teacher approved a subject group.',
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async teacherLockGroup(subjectId: string, groupId: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'LOCKED' },
    });

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'GROUP_LOCKED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: 'Teacher locked a subject group.',
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async teacherUnlockGroup(subjectId: string, groupId: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
    const minGroupSize = Math.max(1, Number(group.subject?.minGroupSize || 1));
    if (group.members.length < minGroupSize) {
      throw new BadRequestException(`Group must have at least ${minGroupSize} member(s) before it can become active.`);
    }
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'ACTIVE' },
    });

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'GROUP_UNLOCKED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: 'Teacher unlocked a subject group.',
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async teacherAssignGroupLeader(subjectId: string, groupId: string, memberId?: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
    if (String(group.status).toUpperCase() === 'LOCKED') {
      throw new BadRequestException('Locked groups cannot change leaders.');
    }

    const member = group.members.find((item: any) => item.studentId === memberId);
    if (!member || !memberId) {
      throw new NotFoundException('Member not found in group.');
    }

    const previousLeaderUserId = group.leaderId;
    await this.prisma.$transaction([
      this.prisma.group.update({
        where: { id: group.id },
        data: { leaderId: memberId },
      }),
      this.prisma.groupMember.updateMany({
        where: { groupId: group.id },
        data: { role: 'MEMBER' },
      }),
      this.prisma.groupMember.updateMany({
        where: { groupId: group.id, studentId: memberId },
        data: { role: 'LEADER' },
      }),
    ]);

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'GROUP_LEADER_ASSIGNED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: `Teacher reassigned group leadership from ${this.userNameById(previousLeaderUserId, group.members)} to ${this.formatUserName(member.student)}.`,
    });

    return { success: true, id: group.id, leaderUserId: memberId };
  }

  async teacherRemoveGroupMember(subjectId: string, groupId: string, memberId: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
    const member = group.members.find((item: any) => item.studentId === memberId);
    if (!member) throw new NotFoundException('Member not found in group.');
    if (group.members.length <= 1) {
      throw new BadRequestException('Cannot remove the only remaining member from the group.');
    }

    const remainingMembers = group.members.filter((item: any) => item.studentId !== memberId);
    const nextLeaderId = group.leaderId === memberId ? remainingMembers[0]?.studentId ?? null : group.leaderId;
    const minGroupSize = Math.max(1, Number(group.subject?.minGroupSize || 1));
    const nextStatus = remainingMembers.length >= minGroupSize ? group.status : 'PENDING';

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: {
          groupId_studentId: {
            groupId: group.id,
            studentId: memberId,
          },
        },
      });
      await tx.group.update({
        where: { id: group.id },
        data: {
          leaderId: nextLeaderId,
          status: nextStatus,
        },
      });
      if (nextLeaderId) {
        await tx.groupMember.updateMany({
          where: { groupId: group.id },
          data: { role: 'MEMBER' },
        });
        await tx.groupMember.updateMany({
          where: { groupId: group.id, studentId: nextLeaderId },
          data: { role: 'LEADER' },
        });
      }
    });

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'TEACHER',
      action: 'GROUP_MEMBER_REMOVED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details:
        nextLeaderId && nextLeaderId !== group.leaderId
          ? `Teacher removed ${this.formatUserName(member.student)} and reassigned group leadership.`
          : `Teacher removed ${this.formatUserName(member.student)} from the group.`,
    });

    return {
      success: true,
      id: group.id,
      leaderUserId: nextLeaderId,
      members: remainingMembers.map((item: any) => item.studentId),
      status: nextStatus,
    };
  }


  private async ensureTeacherOwnsSubject(subjectId: string, teacherId?: string) {
    const teacherUserId = this.requireAuthenticatedUserId(teacherId, 'teacher');
    await this.access.requireTeacherOwnsSubject(teacherUserId, subjectId);
    const subject: any = await this.subjectRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundException('Subject not found.');
    return subject;
  }

  private async requireTeacherOwnedGroup(subjectId: string, groupId: string, teacherId?: string) {
    await this.ensureTeacherOwnsSubject(subjectId, teacherId);
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        subjectId,
      },
      include: {
        members: {
          include: { student: { select: SAFE_USER_SELECT } },
        },
        subject: {
          select: { minGroupSize: true },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found.');
    return group;
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

  private async mapGroupMembers(group: any) {
    const leaderId = group?.leaderUserId || group?.leaderId;
    if (group.memberUserIds) {
      const users = await Promise.all(group.memberUserIds.map((id: string) => this.userRepository.findById(id)));
      return users.filter(Boolean).map((user: any) => {
        const isLeader = user.id === leaderId;
        return {
          id: user.id,
          name: this.formatUserName(user),
          role: isLeader ? 'LEADER' : 'MEMBER',
          status: this.formatStatusLabel(user.status || 'ACTIVE'),
          isLeader,
        };
      });
    }

    if (group.members) {
      return group.members.map((member: any) => {
        const student = member.student;
        const isLeader = member.studentId === leaderId || String(member.role || '').toUpperCase() === 'LEADER';
        return {
          id: member.studentId,
          name: student ? this.formatUserName(student) : member.studentId,
          role: member.role || (isLeader ? 'LEADER' : 'MEMBER'),
          status: this.formatStatusLabel(member.status || student?.status || 'ACTIVE'),
          isLeader,
        };
      });
    }

    return [];
  }

  private async lookupUserName(userId?: string) {
    if (!userId) return 'Unknown';
    const user: any = await this.userRepository.findById(userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  }

  private userNameById(userId: string | null | undefined, members: Array<{ studentId: string; student: { firstName: string; lastName: string } }>) {
    if (!userId) return '';
    const match = members.find((item) => item.studentId === userId);
    return match ? this.formatUserName(match.student) : userId;
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
}
