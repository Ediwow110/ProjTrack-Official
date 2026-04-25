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
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildMasterListFileName,
  buildMasterListWorkbookBuffer,
} from '../common/utils/master-list-export';

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
  const appUrl = String(process.env.APP_URL || 'http://localhost:5173').replace(
    /\/+$/,
    '',
  );
  return `${appUrl}/student/subjects/${encodeURIComponent(subjectId)}`;
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
  ) {}

  async studentSubjects(userId = 'usr_student_1') {
    return this.subjectRepository.listSubjectsForStudent(userId);
  }

  async studentSubmitCatalog(userId = 'usr_student_1') {
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(userId);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(userId);

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
      const group = groups.find((item: any) => item.memberUserIds?.includes?.(userId) || item.members?.some?.((member: any) => member.studentId === userId)) || null;

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

  async studentSubjectDetail(id: string, userId = 'usr_student_1') {
    const subject: any = await this.subjectRepository.findSubjectById(id);
    if (!subject) throw new NotFoundException('Subject not found.');

    const activities: any[] = await this.subjectRepository.listActivitiesBySubject(id);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(userId);
    const groups: any[] = await this.subjectRepository.listGroupsBySubject(id);
    const group = groups.find((item: any) =>
      item.memberUserIds?.includes?.(userId) ||
      item.members?.some?.((member: any) => member.studentId === userId)
    ) || null;
    const groupMembers = group ? await this.mapGroupMembers(group) : [];
    const groupLeader = group
      ? groupMembers.find((member: any) => member.isLeader)?.name || await this.lookupUserName(group.leaderUserId || group.leaderId)
      : undefined;

    return {
      ...subject,
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
            ...group,
            leader: groupLeader,
            members: groupMembers,
          }
        : null,
    };
  }

  async studentSubmissionContext(activityId: string, userId = 'usr_student_1') {
    const activity: any = await this.subjectRepository.findActivityById(activityId);
    if (!activity) throw new NotFoundException('Activity not found.');

    const groups: any[] = await this.subjectRepository.listGroupsBySubject(activity.subjectId);
    const group = (activity.submissionMode === 'GROUP')
      ? groups.find((item: any) =>
          item.memberUserIds?.includes?.(userId) ||
          item.members?.some?.((member: any) => member.studentId === userId)
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

  async teacherSubjects(teacherId = 'usr_teacher_1') {
    return this.subjectRepository.listSubjectsForTeacher(teacherId);
  }

  async teacherStudents(teacherId = 'usr_teacher_1', search?: string, section?: string) {
    const subjects: any[] = await this.subjectRepository.listSubjectsForTeacher(teacherId);
    const allowedSections = new Set(subjects.flatMap((subject: any) => subject.sections || []));
    const q = String(search || '').trim().toLowerCase();
    return (await this.userRepository.listAll())
      .filter((user: any) => user.role === 'STUDENT')
      .filter((user: any) => {
        const sectionName =
          user.studentProfile?.section?.name || user.studentProfile?.section || user.section || '';
        return !allowedSections.size || allowedSections.has(sectionName);
      })
      .filter((user: any) => {
        const sectionName =
          user.studentProfile?.section?.name || user.studentProfile?.section || user.section || '';
        return !section || section === 'All' || sectionName === section;
      })
      .map((user: any) => {
        const sectionName =
          user.studentProfile?.section?.name || user.studentProfile?.section || user.section || '—';
        return {
          id: user.id,
          studentId: user.studentProfile?.studentNumber || user.studentNumber || user.id,
          academicYear:
            user.studentProfile?.academicYear?.name ||
            user.studentProfile?.section?.academicYear?.name ||
            '—',
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          section: sectionName,
          subjects: subjects.filter((subject: any) => (subject.sections || []).includes(sectionName)).length,
          status:
            user.status === 'ACTIVE'
              ? 'Active'
              : String(user.status || 'ACTIVE')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, (match) => match.toUpperCase()),
        };
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
            user: true,
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
      buffer: buildMasterListWorkbookBuffer(
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

  async studentCalendar(userId = 'usr_student_1') {
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(userId);
    const submissions: any[] = await this.submissionRepository.listStudentSubmissions(userId);
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
    const students = (subject.enrollments || []).map((enrollment: any) => enrollment.student?.user).filter(Boolean);

    return { ...subject, submissions, students, groups };
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
    await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'submission',
    );

    if (body.notifyByEmail) {
      await this.queueEmailsForUsers(studentUserIds, {
        templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
        title: notificationTitle,
        body: notificationBody,
        subjectName: subject.name,
        teacherName,
        activityLink,
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
    return activity;
  }

  async updateTeacherActivity(subjectId: string, activityId: string, body: any) {
    const subject: any = await this.ensureTeacherOwnsSubject(subjectId, body.actorUserId);

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
    await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      body.type || 'announcement',
    );
    const emailJobsQueued = await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName,
      activityLink,
      suppressDeliveryErrors: true,
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
      emailJobsQueued,
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
    await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'announcement',
    );
    await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName: await this.lookupUserName(actorUserId),
      activityLink: studentSubjectLink(subject.id),
      suppressDeliveryErrors: true,
    });

    return { success: true };
  }

  async reopenTeacherActivity(subjectId: string, activityId: string, actorUserId?: string) {
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
    await this.notifyUsers(
      studentUserIds,
      notificationTitle,
      notificationBody,
      'submission',
    );
    await this.queueEmailsForUsers(studentUserIds, {
      templateKey: MAIL_TEMPLATE_KEYS.TEACHER_ACTIVITY_NOTICE,
      title: notificationTitle,
      body: notificationBody,
      subjectName: subject.name,
      teacherName: await this.lookupUserName(actorUserId),
      activityLink: `${studentSubjectLink(subject.id)}?tab=activities`,
      suppressDeliveryErrors: true,
    });

    return { success: true };
  }

  async createGroup(body: { subjectId: string; name: string; leaderUserId?: string }) {
    return this.subjectRepository.createGroup({
      subjectId: body.subjectId,
      name: body.name,
      leaderUserId: body.leaderUserId || 'usr_student_1',
    });
  }

  async joinGroupByCode(body: { code: string; userId?: string }) {
    const group = await this.subjectRepository.joinGroupByCode({
      code: body.code,
      userId: body.userId || 'usr_student_1',
    });
    if (!group) throw new NotFoundException('Invite code not found.');
    return group;
  }

  async teacherApproveGroup(subjectId: string, groupId: string, actorUserId?: string) {
    const group = await this.requireTeacherOwnedGroup(subjectId, groupId, actorUserId);
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
    const nextStatus = remainingMembers.length === 1 ? 'PENDING' : group.status;

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
    const subject: any = await this.subjectRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundException('Subject not found.');
    const actor: any = teacherId ? await this.userRepository.findById(teacherId) : null;
    const allowedTeacherId = actor?.teacherProfile?.id ?? teacherId;
    if (teacherId && String(subject.teacherId || '') !== String(allowedTeacherId || '')) {
      throw new ForbiddenException('You do not have access to this subject.');
    }
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
          include: { student: true },
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

  private async notifyUsers(userIds: string[], title: string, body: string, type = 'system') {
    const preferences = await this.getNotificationPreferences();
    if (!preferences.classroomActivitySystemNotificationsEnabled) {
      return;
    }
    await Promise.all(userIds.map((userId) => this.notificationRepository.create({ userId, title, body, type })));
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
    },
  ) {
    const preferences = await this.getNotificationPreferences();
    if (!preferences.classroomActivityEmailsEnabled) {
      return 0;
    }
    const users = await Promise.all(userIds.map((id) => this.userRepository.findById(id)));
    const unique = new Map<string, any>();
    users.filter(Boolean).forEach((user: any) => {
      if (user?.email) unique.set(user.email, user);
    });
    try {
      await Promise.all(
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
          }),
        ),
      );
    } catch (error) {
      if (!input.suppressDeliveryErrors) {
        throw error;
      }

      const detail =
        error instanceof Error ? error.message : 'Unknown mail queue failure.';
      this.logger.warn(
        `Skipping classroom email queue while keeping in-app notifications active: ${detail}`,
      );
      return 0;
    }

    return unique.size;
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
