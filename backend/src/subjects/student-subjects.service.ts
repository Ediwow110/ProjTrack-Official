import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class StudentSubjectsService {
  constructor(
    private readonly subjectRepository: SubjectRepository,
    private readonly submissionRepository: SubmissionRepository,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
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

  private formatUserName(user: { firstName?: string | null; lastName?: string | null } | any) {
    return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Unknown';
  }

  private formatStatusLabel(value: string) {
    const normalized = String(value || 'ACTIVE').trim().toUpperCase().replace(/_/g, ' ');
    if (normalized === 'ACTIVE') return 'Active';
    if (normalized === 'INACTIVE') return 'Inactive';
    return normalized.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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
}
