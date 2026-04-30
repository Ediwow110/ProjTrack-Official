import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertAllowed, assertFound, SAFE_USER_SELECT } from './policies/subject-access.policy';
import { normalizeRole } from './policies/file-access.policy';
import { isJoinableGroupStatus } from './policies/group-access.policy';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeId(value?: string | null, label = 'Identifier') {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new UnauthorizedException(`${label} is required.`);
    }
    return normalized;
  }

  async requireActiveUser(userId?: string | null) {
    const id = this.normalizeId(userId, 'Authenticated user');
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User session is no longer active.');
    }
    return user;
  }

  async requireStudentProfile(userId?: string | null) {
    const id = this.normalizeId(userId, 'Student user');
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: id },
      include: { section: true },
    });
    if (!profile) {
      throw new ForbiddenException('Student profile is required for this action.');
    }
    return profile;
  }

  async requireTeacherProfile(userId?: string | null) {
    const id = this.normalizeId(userId, 'Teacher user');
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: id },
    });
    if (!profile) {
      throw new ForbiddenException('Teacher profile is required for this action.');
    }
    return profile;
  }

  async requireStudentEnrolledInSubject(userId: string | undefined | null, subjectId: string) {
    const student = await this.requireStudentProfile(userId);
    const subject = assertFound(
      await this.prisma.subject.findUnique({
        where: { id: this.normalizeId(subjectId, 'Subject') },
        select: { id: true, isOpen: true, groupEnabled: true, maxGroupSize: true },
      }),
      'Subject not found.',
    );
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, subjectId: subject.id },
      include: { section: true },
    });
    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this subject.');
    }
    return { student, subject, enrollment };
  }

  async requireTeacherOwnsSubject(userId: string | undefined | null, subjectId: string) {
    const teacher = await this.requireTeacherProfile(userId);
    const subject = assertFound(
      await this.prisma.subject.findUnique({
        where: { id: this.normalizeId(subjectId, 'Subject') },
      }),
      'Subject not found.',
    );
    assertAllowed(
      String(subject.teacherId ?? '') === String(teacher.id),
      'You do not have access to this subject.',
    );
    return { teacher, subject };
  }

  async requireTeacherOwnsActivity(
    userId: string | undefined | null,
    subjectId: string,
    activityId: string,
  ) {
    const ownership = await this.requireTeacherOwnsSubject(userId, subjectId);
    const activity = assertFound(
      await this.prisma.submissionTask.findUnique({
        where: { id: this.normalizeId(activityId, 'Activity') },
      }),
      'Activity not found.',
    );
    assertAllowed(
      String(activity.subjectId) === String(ownership.subject.id),
      'Activity does not belong to the selected subject.',
    );
    return { ...ownership, activity };
  }

  async requireTeacherCanReviewSubmission(userId: string | undefined | null, submissionId: string) {
    const teacher = await this.requireTeacherProfile(userId);
    const submission = assertFound(
      await this.prisma.submission.findUnique({
        where: { id: this.normalizeId(submissionId, 'Submission') },
        include: { subject: true, task: true },
      }),
      'Submission not found.',
    );
    assertAllowed(
      String(submission.subject?.teacherId ?? '') === String(teacher.id),
      'You do not have access to review this submission.',
    );
    return { teacher, submission };
  }

  async requireStudentCanAccessSubmission(userId: string | undefined | null, submissionId: string) {
    const studentUserId = this.normalizeId(userId, 'Student user');
    const submission = assertFound(
      await this.prisma.submission.findUnique({
        where: { id: this.normalizeId(submissionId, 'Submission') },
        include: {
          group: { include: { members: true } },
        },
      }),
      'Submission not found.',
    );
    await this.requireStudentEnrolledInSubject(studentUserId, submission.subjectId);
    const ownsIndividual = submission.studentId === studentUserId;
    const ownsGroup = Boolean(
      submission.group?.members.some(
        (member) => member.studentId === studentUserId && String(member.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
      ),
    );
    assertAllowed(ownsIndividual || ownsGroup, 'You do not have access to this submission.');
    return submission;
  }

  async requireUserCanDownloadFile(userId: string | undefined | null, role: string | undefined, fileIdOrPath: string) {
    const normalizedRole = normalizeRole(role);
    const value = this.normalizeId(fileIdOrPath, 'File');
    const meta = await this.prisma.submissionFile.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: value }, { relativePath: value }],
      },
      include: {
        submission: {
          include: {
            subject: { select: { id: true, teacherId: true } },
            group: { include: { members: true } },
          },
        },
      },
    });

    if (normalizedRole === 'ADMIN') {
      return meta;
    }

    if (!meta) {
      throw new NotFoundException('File not found.');
    }

    if (normalizedRole === 'TEACHER') {
      const teacher = await this.requireTeacherProfile(userId);
      assertAllowed(
        String(meta.submission?.subject?.teacherId ?? '') === String(teacher.id),
        'You do not have access to this file.',
      );
      return meta;
    }

    if (normalizedRole === 'STUDENT') {
      const studentUserId = this.normalizeId(userId, 'Student user');
      const ownsIndividual = meta.submission?.studentId === studentUserId;
      const ownsGroup = Boolean(
        meta.submission?.group?.members.some(
          (member) => member.studentId === studentUserId && String(member.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
        ),
      );
      assertAllowed(ownsIndividual || ownsGroup, 'You do not have access to this file.');
      return meta;
    }

    throw new ForbiddenException('You do not have access to this file.');
  }

  async requireStudentCanCreateGroup(userId: string | undefined | null, subjectId: string) {
    const { student, subject, enrollment } = await this.requireStudentEnrolledInSubject(userId, subjectId);
    if (!subject.isOpen) {
      throw new BadRequestException('This subject is closed for group creation.');
    }
    if (!subject.groupEnabled) {
      throw new BadRequestException('This subject does not allow group creation.');
    }
    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.userId,
        status: { not: 'REMOVED' },
        group: { subjectId: subject.id, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already assigned to a group for this subject.');
    }
    return { student, subject, enrollment };
  }

  async requireStudentCanJoinGroup(
    userId: string | undefined | null,
    subjectId: string,
    inviteCode: string,
  ) {
    const { student, subject, enrollment } = await this.requireStudentEnrolledInSubject(userId, subjectId);
    if (!subject.isOpen) {
      throw new BadRequestException('This subject is closed for group membership.');
    }
    if (!subject.groupEnabled) {
      throw new BadRequestException('This subject does not allow group membership.');
    }

    const normalizedCode = String(inviteCode ?? '').trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('Invite code is required.');
    }

    const group = assertFound(
      await this.prisma.group.findFirst({
        where: { inviteCode: normalizedCode, subjectId: subject.id },
        include: { members: true, subject: true },
      }),
      'Invite code not found for this subject.',
    );

    if (!isJoinableGroupStatus(group.status)) {
      throw new BadRequestException('This group is not accepting new members.');
    }
    if (group.sectionId && group.sectionId !== enrollment.sectionId) {
      throw new BadRequestException('This invite code belongs to a different section.');
    }
    if (group.members.length >= Number(group.subject?.maxGroupSize || 1)) {
      throw new BadRequestException('This group is already full.');
    }

    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: student.userId,
        status: { not: 'REMOVED' },
        group: { subjectId: subject.id, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already assigned to a group for this subject.');
    }

    return { student, subject, enrollment, group };
  }
}
