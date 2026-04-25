import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTeacherProfileId(teacherId: string) {
    const direct = await this.prisma.teacherProfile.findUnique({ where: { id: teacherId } });
    if (direct) return direct.id;
    const byUser = await this.prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
    return byUser?.id ?? teacherId;
  }

  private async resolveStudentProfileId(userId: string) {
    const direct = await this.prisma.studentProfile.findUnique({ where: { id: userId } });
    if (direct) return direct.id;
    const byUser = await this.prisma.studentProfile.findUnique({ where: { userId } });
    return byUser?.id ?? userId;
  }

  async listSubjects() {
    return this.prisma.subject.findMany({
      include: {
        teacher: { include: { user: true } },
        tasks: true,
        enrollments: { include: { student: { include: { user: true, section: true } }, section: true } },
        groups: { include: { members: { include: { student: true } } } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findSubjectById(id: string) {
    return this.prisma.subject.findUnique({
      where: { id },
      include: {
        teacher: { include: { user: true } },
        tasks: true,
        enrollments: { include: { student: { include: { user: true, section: true } }, section: true } },
        groups: { include: { members: { include: { student: true } } } },
      },
    });
  }

  async findActivityById(id: string) {
    return this.prisma.submissionTask.findUnique({
      where: { id },
      include: { submissions: true },
    });
  }

  async listActivitiesBySubject(subjectId: string) {
    return this.prisma.submissionTask.findMany({
      where: { subjectId },
      include: { submissions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listGroupsBySubject(subjectId: string) {
    return this.prisma.group.findMany({
      where: { subjectId },
      include: {
        members: {
          include: { student: true },
        },
        section: true,
        subject: {
          include: {
            enrollments: { include: { section: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSubjectsForStudent(userId: string) {
    const resolvedStudentId = await this.resolveStudentProfileId(userId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: resolvedStudentId },
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            tasks: true,
            enrollments: { include: { section: true } },
          },
        },
        section: true,
      },
    });

    return enrollments.map((enrollment) => ({
      ...enrollment.subject,
      sections: enrollment.section ? [enrollment.section.name] : [],
    }));
  }

  async listSubjectsForTeacher(teacherId: string) {
    const resolvedTeacherId = await this.resolveTeacherProfileId(teacherId);
    return this.prisma.subject.findMany({
      where: { teacherId: resolvedTeacherId },
      include: {
        teacher: { include: { user: true } },
        tasks: true,
        enrollments: { include: { student: { include: { user: true, section: true } }, section: true } },
        groups: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async createActivity(subjectId: string, body: any) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException('Activity title is required.');
    }

    return this.prisma.submissionTask.create({
      data: {
        subjectId,
        title,
        description: String(body.instructions ?? '').trim(),
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        dueAt: body.deadline ? new Date(body.deadline) : undefined,
        openAt: body.openAt ? new Date(body.openAt) : undefined,
        closeAt: body.closeAt ? new Date(body.closeAt) : undefined,
        submissionMode: body.submissionMode || 'INDIVIDUAL',
        isOpen: true,
        allowLateSubmission: !!body.allowLateSubmission,
        acceptedFileTypes: Array.isArray(body.acceptedFileTypes) ? body.acceptedFileTypes : undefined,
        maxFileSizeMb: Number(body.maxFileSizeMb || 10),
        externalLinksAllowed: body.externalLinksAllowed !== false,
        notifyByEmail: !!body.notifyByEmail,
      },
    });
  }

  async updateActivity(activityId: string, body: any) {
    const nextTitle = String(body.title ?? '').trim();
    if (!nextTitle) {
      throw new BadRequestException('Activity title is required.');
    }

    return this.prisma.submissionTask.update({
      where: { id: activityId },
      data: {
        title: nextTitle,
        description: String(body.instructions ?? body.description ?? '').trim(),
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        dueAt: body.deadline ? new Date(body.deadline) : undefined,
        openAt: body.openAt ? new Date(body.openAt) : undefined,
        closeAt: body.closeAt ? new Date(body.closeAt) : undefined,
        submissionMode: body.submissionMode || undefined,
        allowLateSubmission: body.allowLateSubmission ?? undefined,
        acceptedFileTypes: Array.isArray(body.acceptedFileTypes) ? body.acceptedFileTypes : undefined,
        maxFileSizeMb: body.maxFileSizeMb ? Number(body.maxFileSizeMb) : undefined,
        externalLinksAllowed: body.externalLinksAllowed ?? undefined,
        notifyByEmail: body.notifyByEmail ?? undefined,
        isOpen: body.isOpen ?? undefined,
      },
    });
  }

  async reopenActivity(activityId: string) {
    return this.prisma.submissionTask.update({
      where: { id: activityId },
      data: { isOpen: true },
    });
  }

  async updateRestrictions(subjectId: string, body: any) {
    const current = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!current) return null;
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        allowLateSubmission: body.allowLate ?? current.allowLateSubmission,
        groupEnabled: body.groupEnabled ?? current.groupEnabled,
        minGroupSize: body.minGroupSize ?? current.minGroupSize,
        maxGroupSize: body.maxGroupSize ?? current.maxGroupSize,
        isOpen: body.isOpen ?? current.isOpen,
      },
    });
  }

  async reopenSubject(subjectId: string) {
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: { isOpen: true },
    });
  }

  async createGroup(body: { subjectId: string; name: string; leaderUserId: string }) {
    const normalizedName = String(body.name || '').trim();
    if (!normalizedName) {
      throw new BadRequestException('Group name is required.');
    }

    const subject = await this.prisma.subject.findUnique({ where: { id: body.subjectId } });
    if (!subject) throw new NotFoundException('Subject not found.');
    if (!subject.groupEnabled) throw new BadRequestException('This subject does not allow group creation.');

    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: body.leaderUserId,
        group: { subjectId: body.subjectId },
      },
      include: { group: true },
    });
    if (existingMembership) {
      throw new ConflictException('You are already assigned to a group for this subject.');
    }

    const leaderProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: body.leaderUserId },
    });

    return this.prisma.group.create({
      data: {
        subjectId: body.subjectId,
        sectionId: leaderProfile?.sectionId,
        name: normalizedName,
        inviteCode: `PRJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        leaderId: body.leaderUserId,
        status: 'PENDING',
        members: {
          create: [{ studentId: body.leaderUserId, role: 'LEADER', status: 'ACTIVE' }],
        },
      },
      include: { members: true },
    });
  }

  async joinGroupByCode(body: { code: string; userId: string }) {
    const normalizedCode = String(body.code || '').trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('Invite code is required.');
    }

    const group = await this.prisma.group.findFirst({
      where: { inviteCode: normalizedCode },
      include: { members: true, subject: true },
    });
    if (!group) throw new NotFoundException('Group not found for the provided invite code.');
    if (!group.subject?.groupEnabled) throw new BadRequestException('This subject does not allow group membership.');
    if (group.status === 'LOCKED') throw new BadRequestException('This group is locked and cannot accept new members.');

    const maxGroupSize = Number(group.subject?.maxGroupSize || 1);
    if (group.members.length >= maxGroupSize) {
      throw new BadRequestException('This group is already full.');
    }

    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        studentId: body.userId,
        group: { subjectId: group.subjectId },
      },
    });
    if (existingMembership) {
      throw new ConflictException('You are already assigned to a group for this subject.');
    }

    const joiningProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: body.userId },
    });
    if (group.sectionId && joiningProfile?.sectionId && group.sectionId !== joiningProfile.sectionId) {
      throw new BadRequestException('This invite code belongs to a different section.');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        studentId: body.userId,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });
    if (group.status === 'PENDING') {
      await this.prisma.group.update({ where: { id: group.id }, data: { status: 'ACTIVE' } });
    }

    return this.prisma.group.findUnique({
      where: { id: group.id },
      include: { members: { include: { student: true } } },
    });
  }
}
