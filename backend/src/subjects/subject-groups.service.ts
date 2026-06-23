import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SubjectRepository } from '../repositories/subject.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

@Injectable()
export class SubjectGroupsService {
  constructor(
    private readonly subjectRepository: SubjectRepository,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly auditLogs: AuditLogsService,
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

  private async lookupUserName(userId?: string) {
    if (!userId) return 'Unknown';
    const user: any = await this.prisma.user.findUnique({ where: { id: userId } });
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
    const subjectId = (() => {
      const normalized = String(body.subjectId || '').trim();
      if (!normalized) {
        throw new BadRequestException('Subject is required.');
      }
      return normalized;
    })();
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
}
