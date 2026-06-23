import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

export type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminGroupsService {
  private readonly logger = new Logger(AdminGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async groups(section?: string, status?: string) {
    const groups = await this.prisma.group.findMany({
      include: {
        subject: {
          include: {
            enrollments: { include: { section: true } },
          },
        },
        section: true,
        members: {
          include: {
            student: { select: SAFE_USER_SELECT },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return groups
      .filter((group) => {
        const sectionNames = this.groupSectionNames(group);
        const matchesSection = !section || sectionNames.includes(section);
        const matchesStatus = !status || String(group.status).toUpperCase() === String(status).toUpperCase();
        return matchesSection && matchesStatus;
      })
      .map((group) => {
        const members = group.members.map((member) => ({
          id: member.studentId,
          name: this.userName(member.student),
          isLeader: group.leaderId === member.studentId,
        }));

        return {
          id: group.id,
          name: group.name,
          subjectId: group.subjectId,
          inviteCode: group.inviteCode,
          status: group.status,
          subject: group.subject?.name ?? group.subjectId,
          section: this.groupSectionNames(group).join(', '),
          leader: members.find((member) => member.isLeader)?.name ?? 'Unassigned',
          members,
        };
      });
  }

  async groupDetail(id: string) {
    const group = (await this.groups()).find((item) => item.id === id);
    if (!group) throw new NotFoundException('Group not found.');
    return group;
  }

  async approveGroup(id: string) {
    const group = await this.requireGroup(id);
    const minGroupSize = Math.max(1, Number(group.subject?.minGroupSize || 1));
    if (group.members.length < minGroupSize) {
      throw new BadRequestException(`Group must have at least ${minGroupSize} member(s) before it can become active.`);
    }
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'ACTIVE' },
    });
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'GROUP_APPROVED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
    });
    return { success: true, id: updated.id, status: updated.status };
  }

  async lockGroup(id: string) {
    const group = await this.requireGroup(id);
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'LOCKED' },
    });
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'GROUP_LOCKED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
    });
    return { success: true, id: updated.id, status: updated.status };
  }

  async unlockGroup(id: string) {
    const group = await this.requireGroup(id);
    const minGroupSize = Math.max(1, Number(group.subject?.minGroupSize || 1));
    if (group.members.length < minGroupSize) {
      throw new BadRequestException(`Group must have at least ${minGroupSize} member(s) before it can become active.`);
    }
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { status: 'ACTIVE' },
    });
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'GROUP_UNLOCKED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
    });
    return { success: true, id: updated.id, status: updated.status };
  }

  async assignGroupLeader(id: string, memberId?: string) {
    const group = await this.requireGroup(id);
    if (String(group.status).toUpperCase() === 'LOCKED') {
      throw new NotFoundException('Locked groups cannot change leaders.');
    }

    const member = group.members.find((item) => item.studentId === memberId);
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
      actorRole: 'ADMIN',
      action: 'GROUP_LEADER_ASSIGNED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: `Reassigned leader from ${this.userNameById(previousLeaderUserId, group.members)} to ${this.userName(member.student)}.`,
    });

    return { success: true, id: group.id, leaderUserId: memberId };
  }

  async removeGroupMember(id: string, memberId: string) {
    const group = await this.requireGroup(id);
    const member = group.members.find((item) => item.studentId === memberId);
    if (!member) throw new NotFoundException('Member not found in group.');
    if (group.members.length <= 1) {
      throw new NotFoundException('Cannot remove the only remaining member from the group.');
    }

    const remainingMembers = group.members.filter((item) => item.studentId !== memberId);
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
      actorRole: 'ADMIN',
      action: 'GROUP_MEMBER_REMOVED',
      module: 'Groups',
      target: group.name,
      entityId: group.id,
      result: 'Success',
      details: nextLeaderId && nextLeaderId !== group.leaderId
        ? `Removed ${this.userName(member.student)} from the group and reassigned leadership.`
        : `Removed ${this.userName(member.student)} from the group.`,
    });

    return { success: true, id: group.id, leaderUserId: nextLeaderId, members: remainingMembers.map((item) => item.studentId), status: nextStatus };
  }

  // --- Private helpers ---

  private userName(user: { firstName?: string | null; lastName?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private userNameById(userId: string | null | undefined, members: Array<{ studentId: string; student: { firstName: string; lastName: string } }>) {
    if (!userId) return '';
    const match = members.find((item) => item.studentId === userId);
    return match ? this.userName(match.student) : userId;
  }

  private toTitleWords(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private groupSectionNames(group: {
    section?: { name?: string | null } | null;
    subject?: { enrollments?: Array<{ section?: { name?: string | null } | null }> } | null;
  }) {
    const direct = group.section?.name ? [group.section.name] : [];
    const fromSubject = group.subject?.enrollments?.map((item) => item.section?.name).filter(Boolean) as string[] | undefined;
    return Array.from(new Set([...(direct || []), ...((fromSubject || []))]));
  }

  private async requireGroup(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { student: { select: SAFE_USER_SELECT } },
        },
        subject: {
          include: {
            enrollments: { include: { section: true } },
          },
        },
        section: true,
      },
    });
    if (!group) throw new NotFoundException('Group not found.');
    return group;
  }
}
