import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { AdminReportsRepository } from '../repositories/admin-reports.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { MAIL_CATEGORY_KEYS } from '../common/constants/mail.constants';
import { buildActivationLink, buildResetPasswordLink } from '../common/utils/frontend-links';
import { FilesService } from '../files/files.service';
import {
  buildMasterListFileName,
  buildMasterListWorkbookBuffer,
} from '../common/utils/master-list-export';
import {
  canSendPasswordRecoveryInstructions,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';
import { isPendingReviewStatus } from '../access/policies/submission-access.policy';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mail: MailService,
    private readonly accountActionTokens: AccountActionTokenService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
    private readonly adminOpsRepository: AdminOpsRepository,
    private readonly adminReportsRepository: AdminReportsRepository,
  ) {}

  async reportSummary(section?: string, subjectId?: string) {
    return this.adminReportsRepository.summary(section, subjectId);
  }

  async reportCurrentView(section?: string, subjectId?: string) {
    return this.adminReportsRepository.currentView(section, subjectId);
  }

  async reportExport(section?: string, subjectId?: string) {
    return this.adminReportsRepository.exportCsv(section, subjectId);
  }

  async reportDashboard(section?: string, subjectId?: string) {
    return this.adminReportsRepository.reportBundle(section, subjectId);
  }

  async users(search?: string, role?: string, status?: string) {
    const q = this.normalizeSearch(search);
    const normalizedRole = String(role ?? '').trim().toUpperCase();
    const normalizedStatus = String(status ?? '').trim();
    const rows = await this.prisma.user.findMany({
      include: {
        studentProfile: {
          include: {
            section: true,
          },
        },
        teacherProfile: true,
      },
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });

    return rows
      .filter((user) => {
        const displayStatus = this.formatUserStatus(user.status);
        const matchesSearch =
          !q ||
          [
            user.id,
            user.email,
            user.firstName,
            user.lastName,
            user.studentProfile?.studentNumber,
            user.teacherProfile?.employeeId,
          ].some((value) => String(value ?? '').toLowerCase().includes(q));
        const matchesRole = !normalizedRole || normalizedRole === 'ALL' || user.role === normalizedRole;
        const matchesStatus =
          !normalizedStatus ||
          normalizedStatus === 'All' ||
          displayStatus === normalizedStatus ||
          String(user.status) === normalizedStatus.toUpperCase().replace(/\s+/g, '_');

        return matchesSearch && matchesRole && matchesStatus;
      })
      .map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        status: this.formatUserStatus(user.status),
        statusKey: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? '',
        office: user.office ?? '',
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        profileLabel: this.userProfileLabel(user),
        studentNumber: user.studentProfile?.studentNumber ?? null,
        employeeId: user.teacherProfile?.employeeId ?? null,
        isSeedCandidate: this.isSeedUserCandidate(user),
      }));
  }

  async createAdmin(
    payload: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      office?: string;
      sendActivationEmail?: boolean;
    },
    actor?: AdminActorContext,
  ) {
    const firstName = String(payload.firstName ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const phone = String(payload.phone ?? '').trim() || null;
    const office = String(payload.office ?? '').trim() || null;
    const sendActivationEmail = payload.sendActivationEmail !== false;

    if (!firstName || !lastName || !email) {
      throw new BadRequestException('First name, last name, and email are required.');
    }
    await this.assertAdminRateLimit('create-admin', actor, email, {
      limit: Number(process.env.ADMIN_CREATE_MAX_PER_HOUR || 10),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with that email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        role: 'ADMIN',
        status: 'PENDING_ACTIVATION',
        firstName,
        lastName,
        phone,
        office,
      },
    });

    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({
      token: session.token,
      ref: session.publicRef,
      role: 'admin',
    });

    if (sendActivationEmail) {
      await this.mail.queueAccountActivation({
        to: user.email,
        recipientName: this.userName(user),
        activationLink,
        firstName: user.firstName,
        publicRef: session.publicRef,
      });

      await this.notifications.createInAppNotification(
        user.id,
        'Account activation ready',
        'An activation link has been queued for email delivery.',
      );
    }

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'ADMIN_CREATED',
      module: 'Users',
      target: `${this.userName(user)} (${user.email})`,
      entityId: user.id,
      result: 'Success',
      details: sendActivationEmail
        ? `Admin account created and activation email queued by ${actor?.actorEmail ?? 'an administrator'}.`
        : `Admin account created without sending an activation email by ${actor?.actorEmail ?? 'an administrator'}.`,
      afterValue: 'PENDING_ACTIVATION',
      ipAddress: actor?.ipAddress,
    });

    return {
      success: true,
      id: user.id,
      email: user.email,
      role: user.role,
      status: this.formatUserStatus(user.status),
      activationQueued: sendActivationEmail,
    };
  }

  async activateUser(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') {
      return this.activateStudent(id, actor);
    }
    if (user.role === 'TEACHER') {
      return this.activateTeacher(id, actor);
    }
    await this.assertAdminRateLimit('activate-user', actor, user.id);
    return this.queueAdminActivation(user.id, actor, 'ACTIVATE');
  }

  async deactivateUser(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') {
      return this.deactivateStudent(id, actor);
    }
    if (user.role === 'TEACHER') {
      return this.deactivateTeacher(id, actor);
    }
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, {
      limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    if (actor?.actorUserId && actor.actorUserId === user.id) {
      throw new ForbiddenException('Admins cannot deactivate themselves from the admin users page.');
    }

    await this.assertAdminActionAllowed(user.id, user.status);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
    ]);

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DEACTIVATE',
      module: 'Users',
      target: `${this.userName(user)} (${user.email})`,
      entityId: user.id,
      result: 'Success',
      details: `Admin account deactivated by ${actor?.actorEmail ?? 'an administrator'}.`,
      beforeValue: String(user.status),
      afterValue: 'INACTIVE',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, status: 'INACTIVE' };
  }

  async sendUserResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') {
      return this.sendStudentResetLink(id, actor);
    }
    if (user.role === 'TEACHER') {
      return this.sendTeacherResetLink(id, actor);
    }
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    return this.queueAdminReset(user.id, actor);
  }

  async resendUserActivation(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') {
      return this.activateStudent(id, actor);
    }
    if (user.role === 'TEACHER') {
      return this.activateTeacher(id, actor);
    }
    await this.assertAdminRateLimit('resend-activation', actor, user.email);
    return this.queueAdminActivation(user.id, actor, 'RESEND_ACTIVATION');
  }

  async deleteUser(id: string, confirmation?: string, actor?: AdminActorContext) {
    const normalizedConfirmation = String(confirmation ?? '').trim().toUpperCase();
    if (normalizedConfirmation !== 'DELETE USER') {
      throw new BadRequestException('Type DELETE USER to confirm deleting a user.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        teacherProfile: true,
        groupMemberships: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    await this.assertAdminRateLimit('delete-user', actor, user.id, {
      limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    if (actor?.actorUserId && actor.actorUserId === user.id) {
      throw new ForbiddenException('Admins cannot delete themselves.');
    }

    await this.assertAdminActionAllowed(user.id, user.status);

    if (!this.isSeedUserCandidate(user)) {
      throw new BadRequestException(
        'Hard delete is intended only for safely identifiable seed, demo, or test users. Deactivate real users instead.',
      );
    }

    if (!this.allowSeedCleanup()) {
      throw new ForbiddenException(
        'Hard delete is disabled. Set ALLOW_SEED_DATA_CLEANUP=true for controlled demo or seed cleanup work.',
      );
    }

    const dependencySummary = await this.getUserDeletionDependencySummary(user.id);
    if (dependencySummary.blockers.length > 0) {
      throw new BadRequestException(
        `This user cannot be hard-deleted safely: ${dependencySummary.blockers.join(' ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { actorUserId: user.id },
        data: { actorUserId: null },
      });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.accountActionToken.deleteMany({ where: { userId: user.id } });
      if (user.studentProfile?.id) {
        await tx.enrollment.deleteMany({ where: { studentId: user.studentProfile.id } });
        await tx.studentProfile.delete({ where: { id: user.studentProfile.id } });
      }
      if (user.teacherProfile?.id) {
        await tx.teacherProfile.delete({ where: { id: user.teacherProfile.id } });
      }
      await tx.user.delete({ where: { id: user.id } });
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Users',
      target: `${this.userName(user)} (${user.email})`,
      entityId: user.id,
      result: 'Success',
      details:
        `Seed/demo user hard-deleted by ${actor?.actorEmail ?? 'an administrator'}. ` +
        'Notifications, sessions, account tokens, and removable profile records were also deleted.',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, deleted: true };
  }

  async teachers(search?: string, status?: string) {
    const q = this.normalizeSearch(search);
    const [teachers, subjects] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'TEACHER' },
        include: { teacherProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subject.findMany({
        include: {
          teacher: { include: { user: { select: SAFE_USER_SELECT } } },
          enrollments: { include: { student: { include: { user: { select: SAFE_USER_SELECT }, section: true } } } },
        },
      }),
    ]);

    return teachers
      .map((user) => {
        const teacherSubjects = subjects.filter((subject) => subject.teacherId === user.teacherProfile?.id);
        const studentIds = new Set<string>();
        for (const subject of teacherSubjects) {
          for (const enrollment of subject.enrollments) {
            if (enrollment.student?.user?.id) {
              studentIds.add(enrollment.student.user.id);
            }
          }
        }

        return {
          id: user.id,
          name: this.userName(user),
          email: user.email,
          dept: user.teacherProfile?.department || 'Unassigned Department',
          employeeId: user.teacherProfile?.employeeId ?? null,
          subjects: teacherSubjects.length,
          students: studentIds.size,
          status: this.formatUserStatus(user.status),
          lastActive: user.updatedAt.toISOString(),
        };
      })
      .filter((row) => {
        const matchesSearch =
          !q ||
          [row.id, row.name, row.email, row.dept].some((value) =>
            String(value || '').toLowerCase().includes(q),
          );
        const matchesStatus = !status || status === 'All' || row.status === status;
        return matchesSearch && matchesStatus;
      });
  }

  async sections(search?: string, academicYearId?: string) {
    return this.adminOpsRepository.listSections({ search, academicYearId });
  }

  async academicYears(search?: string) {
    return this.adminOpsRepository.listAcademicYears(search);
  }

  async departments(search?: string) {
    return this.adminOpsRepository.listDepartments(search);
  }

  async createAcademicYear(payload: { name?: string; status?: string }) {
    const created = await this.adminOpsRepository.createAcademicYear(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Academic Years',
      target: created.name,
      entityId: created.id,
      result: 'Success',
      details: `Academic year created with ${created.status.toLowerCase()} status.`,
    });
    return created;
  }

  async createDepartment(payload: { name?: string; description?: string }) {
    const created = await this.adminOpsRepository.createDepartment(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Departments',
      target: created.name,
      entityId: created.id,
      result: 'Success',
      details: 'Department catalog entry created.',
    });
    return created;
  }

  async createAcademicYearLevel(payload: {
    academicYearId?: string;
    name?: string;
    sortOrder?: number | string;
  }) {
    const created = await this.adminOpsRepository.createAcademicYearLevel(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Academic Years',
      target: `${created.academicYear} / ${created.name}`,
      entityId: created.id,
      result: 'Success',
      details: 'Academic year level created.',
    });
    return created;
  }

  async sectionMasterList(sectionId: string) {
    return this.adminOpsRepository.getSectionMasterList(sectionId);
  }

  async sectionMasterListExport(sectionId: string) {
    const masterList = await this.adminOpsRepository.getSectionMasterList(sectionId);
    const fileName = buildMasterListFileName({
      academicYear: masterList.section.academicYear,
      yearLevel: masterList.section.yearLevel,
      section: masterList.section.name,
      adviser: masterList.section.adviser,
    });

    return {
      fileName,
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

  async notificationsList(role?: string, type?: string) {
    return this.prisma.notification.findMany({
      where: {
        ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
        ...(role ? { user: { role: String(role).toUpperCase() as any } } : {}),
      },
      include: { user: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationRead(id: string) {
    const target = await this.prisma.notification.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Notification not found.');

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'READ',
      module: 'Notifications',
      target: target.title,
      result: 'Success',
      details: 'Admin marked a notification as read.',
    });

    return { success: true, id };
  }

  async markAllNotificationsRead(actor?: AdminActorContext) {
    if (!actor?.actorUserId) {
      throw new ForbiddenException('Admin user context is required.');
    }
    const result = await this.prisma.notification.updateMany({
      where: { isRead: false, userId: actor?.actorUserId },
      data: { isRead: true },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'READ_ALL',
      module: 'Notifications',
      target: 'Admin notification feed',
      result: 'Success',
      details: 'Admin marked their notifications as read.',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, count: result.count };
  }

  async deleteNotifications(ids: string[]) {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)),
    );

    if (!normalizedIds.length) {
      throw new BadRequestException('At least one notification must be selected.');
    }

    const targets = await this.prisma.notification.findMany({
      where: { id: { in: normalizedIds } },
      select: { id: true, title: true },
    });

    const result = await this.prisma.notification.deleteMany({
      where: { id: { in: normalizedIds } },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: normalizedIds.length === 1 ? 'DELETE' : 'BULK_DELETE',
      module: 'Notifications',
      target:
        normalizedIds.length === 1
          ? targets[0]?.title ?? 'Notification'
          : `${result.count} notifications`,
      result: 'Success',
      details:
        normalizedIds.length === 1
          ? 'Admin deleted a notification from the feed.'
          : `Admin deleted ${result.count} notifications from the feed.`,
    });

    return { success: true, count: result.count };
  }

  async broadcast(body: { title: string; body: string; audience: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS'; channel: 'system' | 'email' | 'both' }) {
    const audienceUsers = await this.resolveAudience(body.audience);
    const audienceCount = audienceUsers.length;
    const activeUsers = audienceUsers.filter((user) => user.status === 'ACTIVE');
    const skippedInactive = audienceCount - activeUsers.length;
    const created: any[] = [];
    let emailJobsQueued = 0;

    for (const user of activeUsers) {
      if (body.channel === 'system' || body.channel === 'both') {
        created.push(await this.notifications.createInAppNotification(user.id, body.title, body.body));
      }
      if (body.channel === 'email' || body.channel === 'both') {
        await this.mail.queue({
          to: user.email,
          templateKey: 'broadcast',
          payload: {
            title: body.title,
            body: body.body,
            audience: body.audience,
            mailCategory: MAIL_CATEGORY_KEYS.ADMIN,
          },
        });
        emailJobsQueued += 1;
      }
    }

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'BROADCAST_CREATED',
      module: 'Notifications',
      target: body.title,
      result: 'Queued',
      details: `Broadcast queued for ${activeUsers.length} active ${body.audience} recipient(s); ${skippedInactive} inactive skipped.`,
    });

    return {
      success: true,
      audienceCount,
      activeRecipients: activeUsers.length,
      skippedInactive,
      emailJobsQueued,
      inAppCreated: created.length,
      notificationsCreated: created.length,
    };
  }

  async announcements() {
    return this.adminOpsRepository.listAnnouncements();
  }

  async createAnnouncement(body: { title: string; body: string; audience?: string; status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'; publishAt?: string }) {
    const record = await this.adminOpsRepository.createAnnouncement(body);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'ANNOUNCEMENT_CREATED',
      module: 'Announcements',
      target: record.title,
      entityId: record.id,
      result: 'Success',
    });
    return record;
  }

  async deleteAnnouncements(ids: string[]) {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)),
    );

    if (!normalizedIds.length) {
      throw new BadRequestException('At least one announcement must be selected.');
    }

    const deleted = await this.adminOpsRepository.deleteAnnouncements(normalizedIds);

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: normalizedIds.length === 1 ? 'DELETE' : 'BULK_DELETE',
      module: 'Announcements',
      target:
        normalizedIds.length === 1
          ? deleted.titles[0] ?? 'Announcement'
          : `${deleted.count} announcements`,
      result: 'Success',
      details:
        normalizedIds.length === 1
          ? 'Admin deleted an announcement.'
          : `Admin deleted ${deleted.count} announcements.`,
    });

    return { success: true, count: deleted.count };
  }

  async calendarEvents(audience?: string, section?: string) {
    const [tasks, announcements] = await Promise.all([
      this.prisma.submissionTask.findMany({
        where: {
          deadline: { not: null },
          ...(section
            ? {
                subject: {
                  enrollments: {
                    some: {
                      section: { name: section },
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          subject: {
            include: {
              enrollments: { include: { section: true } },
            },
          },
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.announcement.findMany({
        where: !audience || audience === 'ALL' ? undefined : { audience: { in: [audience, 'ALL'] } },
        orderBy: { publishAt: 'asc' },
      }),
    ]);

    const activityEvents = tasks
      .filter(() => !audience || audience === 'ALL' || audience === 'STUDENTS' || audience === 'TEACHERS')
      .map((task) => ({
        id: task.id,
        type: 'activity',
        title: task.title,
        audience: 'STUDENTS',
        startsAt: task.deadline?.toISOString() ?? task.createdAt.toISOString(),
        subject: task.subject?.name ?? task.subjectId,
        windowStatus: task.isOpen ? 'OPEN' : 'CLOSED',
      }));

    const announcementEvents = announcements.map((item) => ({
      id: item.id,
      type: 'announcement',
      title: item.title,
      audience: item.audience,
      startsAt: item.publishAt.toISOString(),
      subject: null,
      windowStatus: item.status,
    }));

    return [...activityEvents, ...announcementEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async calendarEventDetail(id: string) {
    const events = await this.calendarEvents();
    const event = events.find((item) => item.id === id);
    if (!event) throw new NotFoundException('Calendar event not found.');
    return event;
  }

  async auditList(module?: string, role?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(module && module !== 'All' ? { module } : {}),
        ...(role && role !== 'All' ? { actorRole: role.toUpperCase() } : {}),
      },
      include: { actor: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async auditDetail(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: { select: SAFE_USER_SELECT } },
    });
    if (!log) throw new NotFoundException('Audit log not found.');
    return log;
  }

  async students(search?: string, status?: string) {
    const q = this.normalizeSearch(search);
    const rows = await this.prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: {
        studentProfile: {
          include: {
            section: { include: { academicYear: true, academicYearLevel: true } },
            academicYear: true,
            academicYearLevel: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
    });

    return rows
      .map((user) => ({
        id: user.id,
        studentId: user.studentProfile?.studentNumber ?? user.id,
        lastName: user.lastName,
        firstName: user.firstName,
        middleInitial: String(user.studentProfile?.middleInitial ?? '').trim(),
        academicYear:
          user.studentProfile?.academicYear?.name ??
          user.studentProfile?.section?.academicYear?.name ??
          '—',
        yearLevel:
          user.studentProfile?.academicYearLevel?.name ??
          user.studentProfile?.yearLevelName ??
          user.studentProfile?.section?.academicYearLevel?.name ??
          user.studentProfile?.section?.yearLevelName ??
          (user.studentProfile?.yearLevel ? `${user.studentProfile.yearLevel}` : '—'),
        name: this.userName(user),
        email: user.email,
        course: user.studentProfile?.course ?? user.studentProfile?.section?.course ?? '—',
        section: user.studentProfile?.section?.name ?? '—',
        sectionId: user.studentProfile?.section?.id ?? '',
        status: this.formatStudentStatus(user.status),
        createdBy: 'Admin',
        lastActive: user.updatedAt.toISOString(),
      }))
      .filter((row) => {
        const matchesSearch =
          !q ||
          [row.studentId, row.name, row.email, row.section].some((value) =>
            String(value || '').toLowerCase().includes(q),
          );
        const matchesStatus = !status || status === 'All' || row.status === status;
        return matchesSearch && matchesStatus;
      });
  }

  async createSection(payload: {
    code?: string;
    program?: string;
    adviserName?: string;
    description?: string;
    yearLevelId?: string;
    yearLevelName?: string;
    yearLevel?: number | string;
    academicYearId?: string;
    academicYear?: string;
  }) {
    const created = await this.adminOpsRepository.createSection(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Sections',
      target: created.code,
      entityId: created.id,
      result: 'Success',
      details: `Section created for ${created.academicYear} / ${created.yearLevel}.`,
    });

    return {
      success: true,
      id: created.id,
      code: created.code,
      academicYear: created.academicYear,
    };
  }

  async createStudent(payload: {
    firstName?: string;
    middleInitial?: string;
    lastName?: string;
    email?: string;
    studentNumber?: string;
    section?: string;
    yearLevelId?: string;
    yearLevelName?: string;
    course?: string;
    yearLevel?: number | string;
    academicYearId?: string;
    academicYear?: string;
  }) {
    const firstName = String(payload.firstName ?? '').trim();
    const middleInitial = String(payload.middleInitial ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const studentNumber = String(payload.studentNumber ?? '').trim();
    const sectionValue = String(payload.section ?? '').trim();

    if (!firstName || !lastName || !email || !studentNumber) {
      throw new BadRequestException('First name, last name, email, and student number are required.');
    }

    const [existingEmail, existingStudentNumber] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.studentProfile.findUnique({ where: { studentNumber } }),
    ]);

    if (existingEmail) throw new ConflictException('A user with that email already exists.');
    if (existingStudentNumber) throw new ConflictException('That student number is already assigned.');

    const placement = await this.adminOpsRepository.resolveSectionPlacement({
      academicYearId: payload.academicYearId,
      academicYear: payload.academicYear,
      academicYearLevelId: payload.yearLevelId,
      yearLevelName: payload.yearLevelName,
      course: payload.course,
      yearLevel: payload.yearLevel,
      sectionId: sectionValue,
      section: sectionValue,
      requireSection: Boolean(sectionValue),
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        role: 'STUDENT',
        status: 'PENDING_SETUP',
        firstName,
        lastName,
        studentProfile: {
          create: {
            studentNumber,
            middleInitial: middleInitial || null,
            sectionId: placement.section?.id ?? null,
            academicYearId: placement.academicYear?.id ?? placement.section?.academicYearId ?? null,
            academicYearLevelId:
              placement.academicYearLevel?.id ?? placement.section?.academicYearLevelId ?? null,
            course: placement.course,
            yearLevel: placement.yearLevel,
            yearLevelName:
              placement.yearLevelName ?? placement.section?.yearLevelName ?? null,
          },
        },
      },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Students',
      target: `${firstName} ${lastName}`.trim(),
      entityId: user.id,
      result: 'Success',
      details: 'Admin created a student account.',
      afterValue: 'PENDING_SETUP',
    });

    return { success: true, id: user.id };
  }

  async updateStudent(id: string, payload: {
    firstName?: string;
    middleInitial?: string;
    lastName?: string;
    email?: string;
    studentNumber?: string;
    section?: string;
    yearLevelId?: string;
    yearLevelName?: string;
    course?: string;
    yearLevel?: number | string;
    academicYearId?: string;
    academicYear?: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'STUDENT' },
      include: {
        studentProfile: {
          include: { section: true, academicYear: true, academicYearLevel: true },
        },
      },
    });
    if (!user?.studentProfile) throw new NotFoundException('Student not found.');

    const firstName = String(payload.firstName ?? user.firstName).trim();
    const middleInitial = String(
      payload.middleInitial ?? user.studentProfile.middleInitial ?? '',
    ).trim();
    const lastName = String(payload.lastName ?? user.lastName).trim();
    const email = String(payload.email ?? user.email).trim().toLowerCase();
    const studentNumber = String(payload.studentNumber ?? user.studentProfile.studentNumber).trim();
    const sectionValue = String(payload.section ?? user.studentProfile.sectionId ?? '').trim();

    const [existingEmail, existingStudentNumber, placement] = await Promise.all([
      this.prisma.user.findFirst({ where: { email, id: { not: user.id } } }),
      this.prisma.studentProfile.findFirst({ where: { studentNumber, userId: { not: user.id } } }),
      this.adminOpsRepository.resolveSectionPlacement({
        academicYearId:
          payload.academicYearId ?? user.studentProfile.academicYearId ?? user.studentProfile.section?.academicYearId ?? undefined,
        academicYear:
          payload.academicYear ?? user.studentProfile.academicYear?.name ?? undefined,
        academicYearLevelId:
          payload.yearLevelId ?? user.studentProfile.academicYearLevelId ?? undefined,
        yearLevelName:
          payload.yearLevelName ??
          user.studentProfile.yearLevelName ??
          user.studentProfile.academicYearLevel?.name ??
          undefined,
        course: payload.course ?? user.studentProfile.course ?? undefined,
        yearLevel: payload.yearLevel ?? user.studentProfile.yearLevel ?? undefined,
        sectionId: sectionValue,
        section: sectionValue,
        requireSection: Boolean(sectionValue),
      }),
    ]);

    if (existingEmail) throw new ConflictException('A different user already uses that email.');
    if (existingStudentNumber) throw new ConflictException('A different student already uses that student number.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        firstName,
        lastName,
        studentProfile: {
          update: {
            studentNumber,
            middleInitial: middleInitial || null,
            sectionId: placement.section?.id ?? null,
            academicYearId:
              placement.academicYear?.id ?? placement.section?.academicYearId ?? null,
            academicYearLevelId:
              placement.academicYearLevel?.id ?? placement.section?.academicYearLevelId ?? null,
            course: placement.course,
            yearLevel: placement.yearLevel,
            yearLevelName:
              placement.yearLevelName ?? placement.section?.yearLevelName ?? null,
          },
        },
      },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Students',
      target: `${firstName} ${lastName}`.trim(),
      entityId: user.id,
      result: 'Success',
      details: 'Admin updated a student account profile.',
    });

    return { success: true, id: user.id };
  }

  async subjects(search?: string) {
    const q = this.normalizeSearch(search);
    const rows = await this.prisma.subject.findMany({
      include: {
        teacher: { include: { user: { select: SAFE_USER_SELECT } } },
        tasks: true,
        enrollments: { include: { section: true } },
      },
      orderBy: { code: 'asc' },
    });

    return rows
      .map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        teacher: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned',
        sections: Array.from(
          new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[]),
        ),
        activities: subject.tasks.length,
        students: subject.enrollments.length,
        status: this.formatSubjectStatus(subject.status, subject.isOpen),
      }))
      .filter((row) => {
        if (!q) return true;
        return [row.code, row.name, row.teacher].some((value) =>
          String(value || '').toLowerCase().includes(q),
        );
      });
  }

  async createTeacher(payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    employeeId?: string;
    department?: string;
  }) {
    const firstName = String(payload.firstName ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const employeeId = String(payload.employeeId ?? '').trim() || null;

    if (!firstName || !lastName || !email) {
      throw new BadRequestException('First name, last name, and email are required.');
    }

    const department = await this.adminOpsRepository.ensureDepartmentName(payload.department);

    const [existingEmail, existingEmployeeId] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      employeeId ? this.prisma.teacherProfile.findFirst({ where: { employeeId } }) : Promise.resolve(null),
    ]);

    if (existingEmail) throw new ConflictException('A user with that email already exists.');
    if (existingEmployeeId) throw new ConflictException('That employee ID is already assigned.');

    const user = await this.prisma.user.create({
      data: {
        email,
        role: 'TEACHER',
        status: 'PENDING_ACTIVATION',
        firstName,
        lastName,
        teacherProfile: {
          create: {
            employeeId,
            department,
          },
        },
      },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Teachers',
      target: `${firstName} ${lastName}`.trim(),
      entityId: user.id,
      result: 'Success',
      details: 'Admin created a teacher account.',
      afterValue: 'PENDING_ACTIVATION',
    });

    return { success: true, id: user.id };
  }

  async updateTeacher(id: string, payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    employeeId?: string;
    department?: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'TEACHER' },
      include: { teacherProfile: true },
    });
    if (!user?.teacherProfile) throw new NotFoundException('Teacher not found.');

    const firstName = String(payload.firstName ?? user.firstName).trim();
    const lastName = String(payload.lastName ?? user.lastName).trim();
    const email = String(payload.email ?? user.email).trim().toLowerCase();
    const employeeId = String(payload.employeeId ?? user.teacherProfile.employeeId ?? '').trim() || null;
    const department = await this.adminOpsRepository.ensureDepartmentName(
      payload.department ?? user.teacherProfile.department,
    );

    const [existingEmail, existingEmployeeId] = await Promise.all([
      this.prisma.user.findFirst({ where: { email, id: { not: user.id } } }),
      employeeId ? this.prisma.teacherProfile.findFirst({ where: { employeeId, userId: { not: user.id } } }) : Promise.resolve(null),
    ]);

    if (existingEmail) throw new ConflictException('A different user already uses that email.');
    if (existingEmployeeId) throw new ConflictException('A different teacher already uses that employee ID.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        firstName,
        lastName,
        teacherProfile: {
          update: {
            employeeId,
            department,
          },
        },
      },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Teachers',
      target: `${firstName} ${lastName}`.trim(),
      entityId: user.id,
      result: 'Success',
      details: 'Admin updated a teacher account profile.',
    });

    return { success: true, id: user.id };
  }

  async createSubject(payload: {
    code?: string;
    name?: string;
    teacherId?: string | null;
    status?: string;
    groupEnabled?: boolean;
    allowLateSubmission?: boolean;
    sectionIds?: string[];
    sectionCodes?: string[];
  }) {
    const code = String(payload.code ?? '').trim();
    const name = String(payload.name ?? '').trim();
    const teacherId = String(payload.teacherId ?? '').trim() || null;
    const sectionIds = Array.isArray(payload.sectionIds) ? payload.sectionIds.map((item) => String(item).trim()).filter(Boolean) : [];
    const sectionCodes = Array.isArray(payload.sectionCodes) ? payload.sectionCodes.map((item) => String(item).trim()).filter(Boolean) : [];

    if (!code || !name) {
      throw new BadRequestException('Subject code and subject name are required.');
    }

    const existing = await this.prisma.subject.findUnique({ where: { code } });
    if (existing) throw new ConflictException('That subject code already exists.');

    const teacherProfile = teacherId
      ? await this.prisma.teacherProfile.findFirst({ where: { userId: teacherId } })
      : null;

    const sectionsForAssignment = sectionIds.length || sectionCodes.length
      ? sectionIds.length
        ? await this.prisma.section.findMany({
            where: { id: { in: sectionIds } },
            include: { students: true },
          })
        : await this.prisma.section.findMany({
            where: { name: { in: sectionCodes } },
            include: { students: true },
          })
      : [];

    if (!sectionIds.length && sectionCodes.length) {
      const byName = new Map<string, number>();
      for (const section of sectionsForAssignment) {
        byName.set(section.name, (byName.get(section.name) || 0) + 1);
      }
      const ambiguous = Array.from(byName.entries()).filter(([, count]) => count > 1).map(([name]) => name);
      if (ambiguous.length) {
        throw new BadRequestException(`Section IDs are required for ambiguous section names: ${ambiguous.join(', ')}.`);
      }
    }

    const subject = await this.prisma.subject.create({
      data: {
        code,
        name,
        teacherId: teacherProfile?.id ?? null,
        status: String(payload.status ?? 'ACTIVE').toUpperCase(),
        groupEnabled: payload.groupEnabled ?? true,
        allowLateSubmission: payload.allowLateSubmission ?? true,
      },
    });

    if (sectionsForAssignment.length) {
      await this.prisma.subjectSection.createMany({
        data: sectionsForAssignment.map((section) => ({ subjectId: subject.id, sectionId: section.id })),
        skipDuplicates: true,
      });

      const enrollmentData = sectionsForAssignment.flatMap((section) =>
        section.students.map((student) => ({
          studentId: student.id,
          subjectId: subject.id,
          sectionId: section.id,
        })),
      );

      if (enrollmentData.length) {
        await this.prisma.enrollment.createMany({
          data: enrollmentData,
          skipDuplicates: true,
        });
      }
    }

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'CREATE',
      module: 'Subjects',
      target: `${code} ${name}`.trim(),
      entityId: subject.id,
      result: 'Success',
      details: 'Admin created a subject.',
    });

    return { success: true, id: subject.id };
  }

  async updateSubject(id: string, payload: {
    code?: string;
    name?: string;
    teacherId?: string | null;
    status?: string;
    groupEnabled?: boolean;
    allowLateSubmission?: boolean;
    sectionIds?: string[];
  }) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found.');

    const code = String(payload.code ?? subject.code).trim();
    const name = String(payload.name ?? subject.name).trim();
    const teacherId = String(payload.teacherId ?? '').trim() || null;
    const teacherProfile = teacherId
      ? await this.prisma.teacherProfile.findFirst({ where: { userId: teacherId } })
      : null;
    const existing = await this.prisma.subject.findFirst({
      where: { code, id: { not: subject.id } },
    });
    if (existing) throw new ConflictException('A different subject already uses that code.');

    await this.prisma.$transaction(async (tx) => {
      await tx.subject.update({
        where: { id: subject.id },
        data: {
          code,
          name,
          teacherId: teacherProfile?.id ?? null,
          status: payload.status ? String(payload.status).toUpperCase() : subject.status,
          groupEnabled: payload.groupEnabled ?? subject.groupEnabled,
          allowLateSubmission: payload.allowLateSubmission ?? subject.allowLateSubmission,
        },
      });

      if (Array.isArray(payload.sectionIds)) {
        const sectionIds = payload.sectionIds.map((item) => String(item).trim()).filter(Boolean);
        await tx.subjectSection.deleteMany({ where: { subjectId: subject.id } });
        if (sectionIds.length) {
          await tx.subjectSection.createMany({
            data: sectionIds.map((sectionId) => ({ subjectId: subject.id, sectionId })),
            skipDuplicates: true,
          });
        }
      }
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Subjects',
      target: `${code} ${name}`.trim(),
      entityId: subject.id,
      result: 'Success',
      details: 'Admin updated subject details.',
    });

    return { success: true, id: subject.id };
  }

  async activateStudent(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.assertAdminRateLimit('activate-user', actor, user.email);
    return this.queueStudentSetupLink(user, 'ACTIVATE', actor);
  }

  async sendStudentResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    return this.queueStudentSetupLink(user, 'RESET', actor);
  }

  async deactivateStudent(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, {
      limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
    ]);

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'DEACTIVATE',
      module: 'Students',
      target: this.userName(user),
      entityId: user.id,
      result: 'Success',
      details: `Admin deactivated the student account${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`,
      afterValue: 'INACTIVE',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, status: 'INACTIVE' };
  }

  async deactivateTeacher(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, {
      limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
    ]);

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'DEACTIVATE',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Success',
      details: `Admin deactivated the teacher account${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`,
      afterValue: 'INACTIVE',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, status: 'INACTIVE' };
  }

  async studentDetail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'STUDENT' },
      include: {
        studentProfile: {
          include: {
            section: { include: { academicYear: true, academicYearLevel: true } },
            academicYear: true,
            academicYearLevel: true,
            enrollments: {
              include: { subject: true },
            },
          },
        },
        groupMemberships: {
          include: {
            group: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Student not found.');

    const recentSubmissions = await this.prisma.submission.findMany({
      where: {
        OR: [
          { studentId: user.id },
          { group: { members: { some: { studentId: user.id } } } },
        ],
      },
      include: { subject: true },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    });

    return {
      initials: this.initials(user.firstName, user.lastName),
      name: this.userName(user),
      subtitle: `${user.studentProfile?.studentNumber ?? 'No ID'} · ${user.studentProfile?.course ?? '—'} · ${user.studentProfile?.section?.name ?? '—'}`,
      status: this.formatStudentStatus(user.status),
      form: {
        firstName: user.firstName,
        middleInitial: user.studentProfile?.middleInitial ?? '',
        lastName: user.lastName,
        email: user.email,
        studentNumber: user.studentProfile?.studentNumber ?? '',
        section: user.studentProfile?.section?.id ?? user.studentProfile?.section?.name ?? '',
        course: user.studentProfile?.course ?? '',
        yearLevel:
          user.studentProfile?.academicYearLevel?.name ??
          user.studentProfile?.yearLevelName ??
          String(user.studentProfile?.yearLevel ?? ''),
        yearLevelId: user.studentProfile?.academicYearLevelId ?? '',
        yearLevelName:
          user.studentProfile?.academicYearLevel?.name ??
          user.studentProfile?.yearLevelName ??
          '',
        academicYearId:
          user.studentProfile?.academicYearId ?? user.studentProfile?.section?.academicYearId ?? '',
        academicYear:
          user.studentProfile?.academicYear?.name ??
          user.studentProfile?.section?.academicYear?.name ??
          '',
      },
      accountDetails: [
        { label: 'Email', value: user.email },
        { label: 'Student ID', value: user.studentProfile?.studentNumber ?? '—' },
        {
          label: 'Academic Year',
          value:
            user.studentProfile?.academicYear?.name ??
            user.studentProfile?.section?.academicYear?.name ??
            '—',
        },
        { label: 'Section', value: user.studentProfile?.section?.name ?? '—' },
        {
          label: 'Year Level',
          value:
            user.studentProfile?.academicYearLevel?.name ??
            user.studentProfile?.yearLevelName ??
            String(user.studentProfile?.yearLevel ?? '—'),
        },
        {
          label: 'M.I.',
          value: String(user.studentProfile?.middleInitial ?? '').trim() || '—',
        },
      ],
      assignedSubjects: (user.studentProfile?.enrollments ?? []).map((enrollment) => enrollment.subject.name),
      stats: [
        { l: 'Total Submissions', v: String(recentSubmissions.length) },
        { l: 'Group Projects', v: String(user.groupMemberships.length) },
        { l: 'Status', v: this.formatStudentStatus(user.status) },
      ],
      recentSubmissions: recentSubmissions.map((submission) => ({
        title: submission.title,
        subject: submission.subject?.name ?? submission.subjectId,
        date: submission.submittedAt ? this.formatDate(submission.submittedAt) : '—',
        status: this.formatSubmissionStatus(submission.status),
      })),
    };
  }

  async activateTeacher(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('activate-user', actor, user.email);
    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({
      token: session.token,
      ref: session.publicRef,
      role: 'teacher',
    });

    await this.mail.queueAccountActivation({
      to: user.email,
      recipientName: this.userName(user),
      activationLink,
      firstName: user.firstName,
      publicRef: session.publicRef,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'PENDING_PASSWORD_SETUP',
      },
    });

    await this.notifications.createInAppNotification(
      user.id,
      'Account activation ready',
      'An activation link has been queued for email delivery.',
    );

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'ACTIVATE',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: `Admin queued a teacher activation / password setup link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`,
      afterValue: 'PENDING_PASSWORD_SETUP',
      ipAddress: actor?.ipAddress,
    });

    return {
      success: true,
      queued: true,
      status: 'PENDING_PASSWORD_SETUP',
      ...(this.canExposeAccountActionLinks() ? { activationLink } : {}),
    };
  }

  async sendTeacherResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: 'teacher',
    });

    await this.mail.queuePasswordReset({
      to: user.email,
      recipientName: this.userName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'PENDING_PASSWORD_SETUP',
      },
    });

    await this.notifications.createInAppNotification(
      user.id,
      'Password reset ready',
      'A password reset link has been queued for email delivery.',
    );

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'RESET',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: `Admin queued a teacher password reset link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`,
      afterValue: 'PENDING_PASSWORD_SETUP',
      ipAddress: actor?.ipAddress,
    });

    return {
      success: true,
      queued: true,
      status: 'PENDING_PASSWORD_SETUP',
      ...(this.canExposeAccountActionLinks() ? { resetLink } : {}),
    };
  }

  async teacherDetail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'TEACHER' },
      include: {
        teacherProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Teacher not found.');

    const handledSubjects = await this.prisma.subject.findMany({
      where: { teacherId: user.teacherProfile?.id },
      include: {
        enrollments: { include: { section: true } },
      },
      orderBy: { code: 'asc' },
    });

    const pendingReviews = await this.prisma.submission.count({
      where: {
        status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'LATE'] },
        subject: { teacherId: user.teacherProfile?.id },
      },
    });

    return {
      initials: this.initials(user.firstName, user.lastName),
      name: this.userName(user),
      subtitle: `${user.teacherProfile?.employeeId ?? '—'} · Faculty`,
      status: this.formatUserStatus(user.status),
      form: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        employeeId: user.teacherProfile?.employeeId ?? '',
        department: user.teacherProfile?.department ?? '',
      },
      accountDetails: [
        { label: 'Email', value: user.email },
        { label: 'Employee ID', value: user.teacherProfile?.employeeId ?? '—' },
        { label: 'Assigned Subjects', value: String(handledSubjects.length) },
      ],
      stats: [
        { l: 'Subjects', v: String(handledSubjects.length) },
        { l: 'Pending Reviews', v: String(pendingReviews) },
        { l: 'Sections', v: String(new Set(handledSubjects.flatMap((subject) => subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean))).size) },
      ],
      handledSubjects: handledSubjects.map((subject) => ({
        code: subject.code,
        name: subject.name,
        section: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])).join(', '),
        students: subject.enrollments.length,
      })),
    };
  }

  async subjectDetail(id: string) {
    const [subject, settings] = await Promise.all([
      this.prisma.subject.findUnique({
        where: { id },
        include: {
          teacher: { include: { user: { select: SAFE_USER_SELECT } } },
          tasks: true,
          enrollments: { include: { section: true } },
        },
      }),
      this.adminOpsRepository.getAcademicSettings(),
    ]);
    if (!subject) throw new NotFoundException('Subject not found.');

    const acceptedTypes = new Set<string>();
    for (const task of subject.tasks) {
      const values = Array.isArray(task.acceptedFileTypes) ? task.acceptedFileTypes : [];
      for (const value of values) {
        acceptedTypes.add(String(value));
      }
    }

    return {
      code: subject.code,
      name: subject.name,
      term: `${settings?.schoolYear ?? 'Not configured'} · ${settings?.semester ?? 'Not configured'}`,
      status: this.formatSubjectStatus(subject.status, subject.isOpen),
      form: {
        code: subject.code,
        name: subject.name,
        teacherId: subject.teacher?.userId ?? '',
        teacherName: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned',
        status: this.formatSubjectStatus(subject.status, subject.isOpen),
        groupEnabled: subject.groupEnabled,
        allowLateSubmission: subject.allowLateSubmission,
        sectionCodes: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])),
      },
      details: [
        { l: 'Teacher', v: subject.teacher?.user ? this.userName(subject.teacher.user) : 'Unassigned' },
        { l: 'Sections', v: Array.from(new Set(subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[])).join(', ') || '—' },
        { l: 'Allowed Types', v: acceptedTypes.size ? Array.from(acceptedTypes).join(', ') : 'Any' },
        { l: 'Group Work', v: subject.groupEnabled ? 'Enabled' : 'Disabled' },
      ],
      stats: [
        { l: 'Activities', v: String(subject.tasks.length) },
        { l: 'Students', v: String(subject.enrollments.length) },
        { l: 'Open Window', v: subject.isOpen ? 'Yes' : 'No' },
      ],
    };
  }

  async submissions(
    search?: string,
    status?: string,
    subjectId?: string,
    studentId?: string,
    section?: string,
  ) {
    const q = this.normalizeSearch(search);
    const normalizedStatus = String(status ?? '').trim();
    const rows = await this.prisma.submission.findMany({
      where: {
        ...(subjectId ? { subjectId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        task: true,
        subject: {
          include: {
            teacher: {
              include: {
                user: { select: SAFE_USER_SELECT },
              },
            },
          },
        },
        student: {
          include: {
            studentProfile: {
              include: {
                section: true,
              },
            },
          },
        },
        group: {
          include: {
            section: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rows
      .map((submission) => {
        const ownerName = submission.student
          ? this.userName(submission.student)
          : submission.group?.name ?? 'Unknown group';
        const studentNumber = submission.student?.studentProfile?.studentNumber ?? null;
        const sectionLabel =
          submission.student?.studentProfile?.section?.name ??
          submission.group?.section?.name ??
          '—';

        return {
          id: submission.id,
          title: submission.title,
          student: studentNumber ? `${ownerName} · ${studentNumber}` : ownerName,
          studentNumber,
          teacher: submission.subject?.teacher?.user
            ? this.userName(submission.subject.teacher.user)
            : 'Unassigned',
          subject: submission.subject?.name ?? submission.subjectId,
          subjectCode: submission.subject?.code ?? submission.subjectId,
          section: sectionLabel,
          due: submission.task?.deadline ? this.formatDateTime(submission.task.deadline) : '—',
          submitted: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '—',
          status: this.formatSubmissionStatus(submission.status),
          statusKey: submission.status,
          grade: submission.grade == null ? '—' : String(submission.grade),
          taskId: submission.taskId,
          taskTitle: submission.task?.title ?? submission.title,
          subjectId: submission.subjectId,
          studentId: submission.studentId,
          groupId: submission.groupId,
          ownerLabel: ownerName,
          externalLinks: Array.isArray(submission.externalLinks) ? submission.externalLinks : [],
          feedback: submission.feedback ?? '',
          notes: submission.notes ?? '',
        };
      })
      .filter((submission) => {
        const matchesSearch =
          !q ||
          [
            submission.id,
            submission.title,
            submission.student,
            submission.subject,
            submission.subjectCode,
            submission.teacher,
            submission.taskId,
            submission.taskTitle,
          ].some((value) => String(value ?? '').toLowerCase().includes(q));
        const matchesStatus =
          !normalizedStatus ||
          normalizedStatus === 'All' ||
          submission.status === normalizedStatus ||
          submission.statusKey === normalizedStatus.toUpperCase().replace(/\s+/g, '_');
        const matchesSection =
          !section || section === 'All' || submission.section === section;
        return matchesSearch && matchesStatus && matchesSection;
      });
  }

  async createSubmission(payload: any, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('create-submission', actor, String(payload?.taskId ?? 'manual-submission'));
    const taskId = String(payload?.taskId ?? '').trim();
    const subjectId = String(payload?.subjectId ?? '').trim();
    const studentId = String(payload?.studentId ?? '').trim() || null;
    const groupId = String(payload?.groupId ?? '').trim() || null;
    const title = String(payload?.title ?? '').trim();
    const normalizedStatus = this.normalizeSubmissionStatusInput(payload?.status);

    if (!taskId || !subjectId || !title || !normalizedStatus) {
      throw new BadRequestException('taskId, subjectId, title, and status are required.');
    }

    if ((studentId && groupId) || (!studentId && !groupId)) {
      throw new BadRequestException('Provide either studentId or groupId, but not both.');
    }

    const task = await this.prisma.submissionTask.findUnique({
      where: { id: taskId },
      include: { subject: true },
    });
    if (!task) {
      throw new NotFoundException('Submission task not found.');
    }
    if (task.subjectId !== subjectId) {
      throw new BadRequestException('The selected task does not belong to the selected subject.');
    }

    let targetStudent: any = null;
    let targetGroup: any = null;
    if (studentId) {
      targetStudent = await this.prisma.user.findFirst({
        where: { id: studentId, role: 'STUDENT' },
        include: { studentProfile: true },
      });
      if (!targetStudent) {
        throw new BadRequestException('studentId must belong to a valid student account.');
      }
    }

    if (groupId) {
      targetGroup = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: { section: true },
      });
      if (!targetGroup) {
        throw new BadRequestException('groupId must belong to a valid group.');
      }
      if (targetGroup.subjectId !== subjectId) {
        throw new BadRequestException('The selected group does not belong to the selected subject.');
      }
    }

    try {
      const created = await this.prisma.submission.create({
        data: {
          taskId,
          subjectId,
          studentId,
          groupId,
          submittedById: actor?.actorUserId ?? null,
          title,
          status: normalizedStatus,
          submittedAt: this.parseOptionalDate(payload?.submittedAt),
          grade: this.parseOptionalGrade(payload?.grade),
          feedback: this.nullableText(payload?.feedback),
          notes: this.nullableText(payload?.notes),
          externalLinks: this.normalizeExternalLinks(payload?.externalLinks),
        },
      });

      await this.auditLogs.record({
        actorUserId: actor?.actorUserId,
        actorRole: actor?.actorRole ?? 'ADMIN',
        action: 'CREATE',
        module: 'Submissions',
        target: title,
        entityId: created.id,
        result: 'Success',
        details:
          `Manual submission record created for ${targetStudent ? this.userName(targetStudent) : targetGroup?.name ?? 'group'}.`,
        ipAddress: actor?.ipAddress,
      });

      return { success: true, id: created.id, status: this.formatSubmissionStatus(created.status) };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          studentId
            ? 'A submission for this task and student already exists.'
            : 'A submission for this task and group already exists.',
        );
      }
      throw error;
    }
  }

  async updateSubmission(id: string, payload: any, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('update-submission', actor, id);
    const existing = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        student: { select: SAFE_USER_SELECT },
        group: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Submission not found.');
    }

    const data: Record<string, any> = {};
    if (payload?.status !== undefined) {
      data.status = this.normalizeSubmissionStatusInput(payload.status);
    }
    if (payload?.grade !== undefined) {
      data.grade = this.parseOptionalGrade(payload.grade);
    }
    if (payload?.feedback !== undefined) {
      data.feedback = this.nullableText(payload.feedback);
    }
    if (payload?.notes !== undefined) {
      data.notes = this.nullableText(payload.notes);
    }
    if (payload?.submittedAt !== undefined) {
      data.submittedAt = this.parseOptionalDate(payload.submittedAt);
    }
    if (payload?.externalLinks !== undefined) {
      data.externalLinks = this.normalizeExternalLinks(payload.externalLinks);
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data,
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'UPDATE',
      module: 'Submissions',
      target: existing.title,
      entityId: existing.id,
      result: 'Success',
      details: `Admin updated submission metadata for ${existing.student ? this.userName(existing.student) : existing.group?.name ?? 'group owner'}.`,
      beforeValue: `${existing.status}${existing.grade != null ? `:${existing.grade}` : ''}`,
      afterValue: `${updated.status}${updated.grade != null ? `:${updated.grade}` : ''}`,
      ipAddress: actor?.ipAddress,
    });

    return { success: true, id: updated.id, status: this.formatSubmissionStatus(updated.status) };
  }

  async deleteSubmission(id: string, confirmation?: string, actor?: AdminActorContext) {
    const normalizedConfirmation = String(confirmation ?? '').trim().toUpperCase();
    if (normalizedConfirmation !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm deleting a submission.');
    }
    await this.assertAdminRateLimit('delete-submission', actor, id, {
      limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        student: { select: SAFE_USER_SELECT },
        group: true,
        files: true,
      },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    for (const file of submission.files) {
      const relativePath = String(file.relativePath ?? '').trim();
      if (!relativePath) {
        continue;
      }
      try {
        await this.files.remove(relativePath);
      } catch {
        throw new BadRequestException(
          'The submission could not be deleted safely because one or more stored files could not be removed.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.submissionFile.deleteMany({ where: { submissionId: submission.id } });
      await tx.submission.delete({ where: { id: submission.id } });
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DELETE',
      module: 'Submissions',
      target: submission.title,
      entityId: submission.id,
      result: 'Success',
      details:
        `Admin deleted a submission owned by ${submission.student ? this.userName(submission.student) : submission.group?.name ?? 'group owner'}.`,
      ipAddress: actor?.ipAddress,
    });

    return { success: true, deleted: true };
  }

  async submissionDetail(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        subject: true,
        student: { select: SAFE_USER_SELECT },
        group: {
          include: {
            members: {
              include: { student: { select: SAFE_USER_SELECT } },
            },
          },
        },
        submittedBy: true,
        files: true,
      },
    });
    if (!submission) throw new NotFoundException('Submission not found.');

    const owner = submission.student
      ? this.userName(submission.student)
      : submission.group?.name ?? submission.groupId ?? 'Unknown';

    return {
      title: submission.title,
      subtitle: `${owner} · ${submission.subject?.name ?? submission.subjectId}`,
      status: this.formatSubmissionStatus(submission.status),
      details: [
        { l: 'Subject', v: submission.subject?.name ?? submission.subjectId },
        { l: 'Owner', v: owner },
        { l: 'Submitted By', v: submission.submittedBy ? this.userName(submission.submittedBy) : '—' },
        { l: 'Submitted At', v: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '—' },
      ],
      files: submission.files.map((file) => ({
        name: file.fileName,
        fileName: file.fileName,
        relativePath: file.relativePath,
      })),
      timeline: [
        { e: 'Created', t: this.formatDateTime(submission.createdAt) },
        { e: 'Submitted', t: submission.submittedAt ? this.formatDateTime(submission.submittedAt) : '—' },
        { e: 'Current Status', t: this.formatSubmissionStatus(submission.status) },
      ],
      feedback: submission.feedback ?? 'No feedback yet.',
      adminNote: submission.notes ?? '',
    };
  }

  async saveSubmissionNote(id: string, note: string) {
    const submission: any = await this.adminOpsRepository.saveSubmissionNote(id, note);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'SUBMISSION_NOTE_UPDATED',
      module: 'Submissions',
      target: submission.title,
      entityId: submission.id,
      result: 'Success',
      details: 'Administrative submission note updated.',
    });
    return { success: true, note: submission.notes ?? '' };
  }

  async requests(status?: string) {
    return this.adminOpsRepository.listRequests(status);
  }

  async requestAction(id: string, status: 'Approved' | 'Rejected') {
    const request = await this.adminOpsRepository.updateRequestStatus(id, status);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: status.toUpperCase(),
      module: 'Requests',
      target: `${request.type} – ${request.requester}`,
      result: 'Success',
      details: `Request moved to ${status}.`,
    });
    return { ok: true, status };
  }

  async getAcademicSettings() {
    return this.adminOpsRepository.getAcademicSettings();
  }

  async saveAcademicSettings(payload: any, actor?: AdminActorContext) {
    const saved = await this.adminOpsRepository.saveAcademicSettings(payload);
    if (saved?.schoolYear) {
      await this.adminOpsRepository.ensureAcademicYear(saved.schoolYear, 'ACTIVE');
    }
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Academic Settings',
      target: 'Academic term configuration',
      result: 'Success',
      details: `Academic settings updated${actor?.actorEmail ? ` by ${actor.actorEmail}` : ''}.`,
      ipAddress: actor?.ipAddress,
    });
    return saved;
  }

  async getSystemSettings() {
    return this.adminOpsRepository.getSystemSettings();
  }

  async saveSystemSettings(payload: any, actor?: AdminActorContext) {
    const saved = await this.adminOpsRepository.saveSystemSettings(payload);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Settings',
      target: 'System settings',
      result: 'Success',
      details: `System settings updated${actor?.actorEmail ? ` by ${actor.actorEmail}` : ''}.`,
      ipAddress: actor?.ipAddress,
    });
    return saved;
  }

  async getSystemTools() {
    const tools = await this.adminOpsRepository.getSystemTools();
    if (tools.some((tool: any) => String(tool?.id ?? tool?.key ?? '').trim() === 'seed-cleanup')) {
      return tools;
    }
    return [...tools, this.buildSeedCleanupToolRecord()];
  }

  async runSystemTool(id: string, payload: any = {}, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('system-tool-run', actor, id, {
      limit: Number(process.env.ADMIN_SYSTEM_TOOL_MAX_PER_HOUR || 10),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    if (id === 'seed-cleanup') {
      const response = await this.runSeedCleanupTool(payload, actor);
      await this.auditLogs.record({
        actorUserId: actor?.actorUserId,
        actorRole: actor?.actorRole ?? 'ADMIN',
        action:
          String(payload?.mode ?? 'preview').toLowerCase() === 'execute'
            ? 'RUN'
            : 'PREVIEW',
        module: 'System Tools',
        target: response.result.title ?? id,
        entityId: 'seed-cleanup',
        result:
          response.result.status.includes('Failed') ||
          response.result.status.includes('Blocked')
            ? 'Failed'
            : 'Success',
        details: response.result.summary,
        ipAddress: actor?.ipAddress,
      });
      return response;
    }

    const response = await this.adminOpsRepository.runSystemTool(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'RUN',
      module: 'System Tools',
      target: response.result.title ?? id,
      result:
        response.result.status.includes('Failed') ||
        response.result.status.includes('Restricted')
          ? 'Failed'
          : 'Success',
      details: response.result.summary,
      ipAddress: actor?.ipAddress,
    });
    return response;
  }

  downloadSystemToolArtifact(path: string) {
    return this.adminOpsRepository.resolveSystemToolArtifact(path);
  }

  async importSystemToolBackup(fileName: string, contentBase64: string) {
    const response = this.adminOpsRepository.importBackupArtifact({ fileName, contentBase64 });
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'IMPORT',
      module: 'System Tools',
      target: response.title,
      result: 'Success',
      details: response.summary,
    });
    return response;
  }

  async getBulkMoveData() {
    return this.adminOpsRepository.getBulkMoveData();
  }

  async moveStudents(sourceSectionId: string, destSectionId: string, ids: string[]) {
    const result = await this.adminOpsRepository.moveStudents(sourceSectionId, destSectionId, ids);
    const sourceSection = result.sections.find((section: any) => section.id === sourceSectionId);
    const destSection = result.sections.find((section: any) => section.id === destSectionId);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'MOVE',
      module: 'Students',
      target: `${ids.length} students`,
      result: 'Success',
      details: `Moved ${ids.length} students from ${sourceSection?.code ?? sourceSectionId} to ${destSection?.code ?? destSectionId}.`,
    });
    return result;
  }

  private buildSeedCleanupToolRecord() {
    const production = this.isProductionRuntime();
    const cleanupEnabled = this.allowSeedCleanup();
    const productionOverride = this.allowProductionAdminToolRuns();
    const status = !cleanupEnabled
      ? 'Disabled'
      : production && !productionOverride
        ? 'Production locked'
        : 'Guarded';

    return {
      id: 'seed-cleanup',
      key: 'seed-cleanup',
      title: 'Seed Data Cleanup',
      desc:
        'Preview and remove safely identifiable demo, seed, or test records only after backup confirmation and typed approval.',
      btn: 'Preview Cleanup',
      danger: true,
      tone: 'rose',
      status,
      lastRun: 'Confirmation required',
      lastRunAt: undefined,
    };
  }

  private async runSeedCleanupTool(payload: any, actor?: AdminActorContext) {
    const mode = String(payload?.mode ?? 'preview').trim().toLowerCase() === 'execute'
      ? 'execute'
      : 'preview';
    const preview = await this.buildSeedCleanupPreview(actor);
    const ranAt = new Date().toISOString();
    const toolRecord = this.buildSeedCleanupToolRecord();
    const tools = await this.getSystemTools();

    const previewStatus = preview.safeToExecute ? 'Preview ready' : 'Preview blocked';
    const previewSummary = preview.safeToExecute
      ? `Preview ready. ${preview.totalRecords} record(s) across ${preview.nonZeroEntityCount} entity group(s) match the guarded seed cleanup rules. No data has been deleted.`
      : preview.summary;

    if (mode !== 'execute') {
      return {
        tools,
        result: {
          toolId: toolRecord.id,
          title: toolRecord.title,
          status: previewStatus,
          summary: previewSummary,
          details: preview.details,
          ranAt,
          preview,
        },
      };
    }

    if (!this.allowSeedCleanup()) {
      throw new ForbiddenException(
        'Seed cleanup is disabled. Set ALLOW_SEED_DATA_CLEANUP=true before running this tool.',
      );
    }

    if (this.isProductionRuntime() && !this.allowProductionAdminToolRuns()) {
      throw new ForbiddenException(
        'Seed cleanup is locked in production. Set ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true only during a controlled maintenance window.',
      );
    }

    if (!preview.safeToExecute) {
      throw new BadRequestException(preview.summary);
    }

    const confirmation = String(payload?.confirmation ?? '').trim().toUpperCase();
    if (confirmation !== 'CLEAN SEED DATA') {
      throw new BadRequestException('Type CLEAN SEED DATA to confirm seed cleanup.');
    }

    if (payload?.backupConfirmed !== true) {
      throw new BadRequestException(
        'Confirm that a fresh backup has been created before running seed cleanup.',
      );
    }

    for (const file of preview.submissionFiles) {
      const relativePath = String(file.relativePath ?? '').trim();
      if (!relativePath) {
        continue;
      }
      try {
        await this.files.remove(relativePath);
      } catch {
        throw new BadRequestException(
          `Seed cleanup stopped because the stored file ${relativePath} could not be removed safely.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (preview.userIds.length > 0) {
        await tx.auditLog.updateMany({
          where: { actorUserId: { in: preview.userIds } },
          data: { actorUserId: null },
        });
      }

      if (preview.notificationIds.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: preview.notificationIds } },
        });
      }

      if (preview.mailJobIds.length > 0) {
        await tx.emailJob.deleteMany({
          where: { id: { in: preview.mailJobIds } },
        });
      }

      if (preview.submissionIds.length > 0) {
        await tx.submissionFile.deleteMany({
          where: { submissionId: { in: preview.submissionIds } },
        });
        await tx.submission.deleteMany({
          where: { id: { in: preview.submissionIds } },
        });
      }

      if (preview.groupIds.length > 0) {
        await tx.groupMember.deleteMany({
          where: { groupId: { in: preview.groupIds } },
        });
        await tx.group.deleteMany({
          where: { id: { in: preview.groupIds } },
        });
      }

      if (preview.subjectIds.length > 0 || preview.studentProfileIds.length > 0) {
        await tx.enrollment.deleteMany({
          where: {
            OR: [
              preview.subjectIds.length > 0 ? { subjectId: { in: preview.subjectIds } } : undefined,
              preview.studentProfileIds.length > 0
                ? { studentId: { in: preview.studentProfileIds } }
                : undefined,
            ].filter(Boolean) as any[],
          },
        });
      }

      if (preview.taskIds.length > 0) {
        await tx.submissionTask.deleteMany({
          where: { id: { in: preview.taskIds } },
        });
      }

      if (preview.subjectIds.length > 0) {
        await tx.subject.deleteMany({
          where: { id: { in: preview.subjectIds } },
        });
      }

      if (preview.userIds.length > 0) {
        await tx.accountActionToken.deleteMany({
          where: { userId: { in: preview.userIds } },
        });
        await tx.authSession.deleteMany({
          where: { userId: { in: preview.userIds } },
        });
      }

      if (preview.studentProfileIds.length > 0) {
        await tx.studentProfile.deleteMany({
          where: { id: { in: preview.studentProfileIds } },
        });
      }

      if (preview.teacherProfileIds.length > 0) {
        await tx.teacherProfile.deleteMany({
          where: { id: { in: preview.teacherProfileIds } },
        });
      }

      if (preview.userIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: preview.userIds } },
        });
      }
    });

    return {
      tools,
      result: {
        toolId: toolRecord.id,
        title: toolRecord.title,
        status: 'Completed',
        summary: `Seed cleanup removed ${preview.totalRecords} record(s) across ${preview.nonZeroEntityCount} entity group(s).`,
        details: [
          'Run completed after typed confirmation and backup acknowledgement.',
          ...preview.executionDetails,
        ],
        ranAt,
        preview,
      },
    };
  }

  private async buildSeedCleanupPreview(actor?: AdminActorContext) {
    const [users, subjects, groups, submissions, notifications, emailJobs] = await Promise.all([
      this.prisma.user.findMany({
        include: {
          studentProfile: true,
          teacherProfile: true,
        },
      }),
      this.prisma.subject.findMany({
        include: {
          teacher: {
            include: {
              user: { select: SAFE_USER_SELECT },
            },
          },
          tasks: true,
          groups: {
            include: {
              members: true,
            },
          },
          enrollments: {
            include: {
              student: {
                include: {
                  user: { select: SAFE_USER_SELECT },
                },
              },
            },
          },
        },
      }),
      this.prisma.group.findMany({
        include: {
          members: true,
        },
      }),
      this.prisma.submission.findMany({
        include: {
          files: true,
        },
      }),
      this.prisma.notification.findMany(),
      this.prisma.emailJob.findMany(),
    ]);

    const seedUsers = users.filter((user) => this.isSeedUserCandidate(user));
    const seedUserIds = new Set(seedUsers.map((user) => user.id));
    const seedUserEmails = new Set(seedUsers.map((user) => String(user.email ?? '').toLowerCase()));
    const seedStudentProfileIds = new Set(
      seedUsers.map((user) => user.studentProfile?.id).filter(Boolean) as string[],
    );
    const seedTeacherProfileIds = new Set(
      seedUsers.map((user) => user.teacherProfile?.id).filter(Boolean) as string[],
    );

    const explicitSeedSubjectIds = new Set(
      subjects
        .filter(
          (subject) =>
            this.isSeedLabel(subject.code) ||
            this.isSeedLabel(subject.name),
        )
        .map((subject) => subject.id),
    );

    const seedSubjects = subjects.filter((subject) => {
      if (explicitSeedSubjectIds.has(subject.id)) {
        return true;
      }

      const teacherUserId = String(subject.teacher?.userId ?? '').trim();
      if (!teacherUserId || !seedUserIds.has(teacherUserId)) {
        return false;
      }

      return subject.enrollments.every((enrollment) =>
        seedStudentProfileIds.has(enrollment.studentId),
      );
    });

    const seedSubjectIds = new Set(seedSubjects.map((subject) => subject.id));
    const seedTasks = seedSubjects.flatMap((subject) => subject.tasks);
    const seedTaskIds = new Set(seedTasks.map((task) => task.id));
    const seedGroups = groups.filter((group) => seedSubjectIds.has(group.subjectId));
    const seedGroupIds = new Set(seedGroups.map((group) => group.id));
    const seedSubmissions = submissions.filter(
      (submission) =>
        seedSubjectIds.has(submission.subjectId) ||
        seedTaskIds.has(submission.taskId) ||
        (submission.groupId ? seedGroupIds.has(submission.groupId) : false),
    );
    const seedSubmissionIds = new Set(seedSubmissions.map((submission) => submission.id));

    const seedNotifications = notifications.filter((notification) =>
      seedUserIds.has(notification.userId),
    );
    const seedNotificationIds = new Set(seedNotifications.map((notification) => notification.id));

    const seedEmailJobs = emailJobs.filter((job) => {
      const email = String(job.userEmail ?? '').trim().toLowerCase();
      const domain = email.split('@')[1] ?? '';
      return (
        seedUserEmails.has(email) ||
        domain === 'projtrack.local' ||
        domain.endsWith('.test') ||
        domain.endsWith('.example')
      );
    });
    const seedMailJobIds = new Set(seedEmailJobs.map((job) => job.id));

    const blockers: string[] = [];
    const activeAdminCount = users.filter(
      (user) => user.role === 'ADMIN' && String(user.status).toUpperCase() === 'ACTIVE',
    ).length;
    const activeSeedAdminCount = seedUsers.filter(
      (user) => user.role === 'ADMIN' && String(user.status).toUpperCase() === 'ACTIVE',
    ).length;

    if (actor?.actorUserId && seedUserIds.has(actor.actorUserId)) {
      blockers.push('The currently signed-in admin is part of the cleanup set. Remove that account from the seed dataset before running cleanup.');
    }

    if (activeSeedAdminCount > 0 && activeAdminCount - activeSeedAdminCount < 1) {
      blockers.push('Running this cleanup would remove the last active admin account.');
    }

    for (const subject of seedSubjects) {
      const nonSeedEnrollments = subject.enrollments.filter(
        (enrollment) => !seedStudentProfileIds.has(enrollment.studentId),
      );
      if (nonSeedEnrollments.length > 0) {
        blockers.push(
          `Subject ${subject.code} (${subject.id}) still contains non-seed enrollments and cannot be removed safely.`,
        );
      }
    }

    for (const group of groups) {
      if (!seedGroupIds.has(group.id)) {
        continue;
      }

      const nonSeedMembers = group.members.filter((member) => !seedUserIds.has(member.studentId));
      if (nonSeedMembers.length > 0) {
        blockers.push(
          `Group ${group.name} (${group.id}) includes non-seed members and cannot be removed safely.`,
        );
      }
    }

    for (const user of seedUsers) {
      if (user.teacherProfile?.id) {
        const nonSeedSubjects = subjects.filter(
          (subject) =>
            subject.teacherId === user.teacherProfile?.id && !seedSubjectIds.has(subject.id),
        );
        if (nonSeedSubjects.length > 0) {
          blockers.push(
            `Teacher ${this.userName(user)} (${user.id}) is still assigned to non-seed subjects.`,
          );
        }
      }

      if (user.studentProfile?.id) {
        const nonSeedEnrollments = subjects.flatMap((subject) =>
          subject.enrollments.filter(
            (enrollment) =>
              enrollment.studentId === user.studentProfile?.id && !seedSubjectIds.has(subject.id),
          ),
        );
        if (nonSeedEnrollments.length > 0) {
          blockers.push(
            `Student ${this.userName(user)} (${user.id}) is still enrolled in non-seed subjects.`,
          );
        }
      }

      const nonSeedMemberships = groups.filter(
        (group) =>
          group.members.some((member) => member.studentId === user.id) &&
          !seedGroupIds.has(group.id),
      );
      if (nonSeedMemberships.length > 0) {
        blockers.push(
          `User ${this.userName(user)} (${user.id}) still belongs to non-seed groups.`,
        );
      }

      const nonSeedSubmissionRefs = submissions.filter(
        (submission) =>
          !seedSubmissionIds.has(submission.id) &&
          (submission.studentId === user.id ||
            submission.submittedById === user.id ||
            submission.reviewerId === user.id),
      );
      if (nonSeedSubmissionRefs.length > 0) {
        blockers.push(
          `User ${this.userName(user)} (${user.id}) is still referenced by non-seed submissions.`,
        );
      }
    }

    const uniqueBlockers = Array.from(new Set(blockers));
    const counts = {
      users: seedUsers.length,
      studentProfiles: seedUsers.filter((user) => user.studentProfile?.id).length,
      teacherProfiles: seedUsers.filter((user) => user.teacherProfile?.id).length,
      subjects: seedSubjects.length,
      activities: seedTasks.length,
      groups: seedGroups.length,
      submissions: seedSubmissions.length,
      notifications: seedNotifications.length,
      mailJobs: seedEmailJobs.length,
    };

    const countEntries = Object.entries(counts).filter(([, count]) => count > 0);
    const totalRecords = countEntries.reduce((sum, [, count]) => sum + count, 0);
    const cleanupEnabled = this.allowSeedCleanup();
    const production = this.isProductionRuntime();
    const productionOverride = this.allowProductionAdminToolRuns();

    const envWarnings: string[] = [];
    if (!cleanupEnabled) {
      envWarnings.push('Set ALLOW_SEED_DATA_CLEANUP=true before running the cleanup tool.');
    }
    if (production && !productionOverride) {
      envWarnings.push('Set ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true during a controlled maintenance window before running cleanup in production.');
    }

    const safeToExecute =
      totalRecords > 0 &&
      uniqueBlockers.length === 0 &&
      envWarnings.length === 0;

    const summary =
      totalRecords === 0
        ? 'Seed cleanup cannot run because seed records are not safely identifiable.'
        : uniqueBlockers.length > 0
          ? 'Seed cleanup is blocked because one or more candidate records are still linked to non-seed data.'
          : envWarnings.length > 0
            ? 'Seed cleanup preview is ready, but execution is blocked until the required environment flags are enabled.'
            : 'Seed cleanup preview is ready for execution.';

    return {
      summary,
      safeToExecute,
      totalRecords,
      nonZeroEntityCount: countEntries.length,
      confirmationWord: 'CLEAN SEED DATA',
      backupRequired: true,
      envGuards: {
        allowSeedDataCleanup: cleanupEnabled,
        production,
        allowProductionAdminToolRuns: production ? productionOverride : null,
      },
      counts,
      details: [
        'Create and verify a fresh database backup before any destructive cleanup.',
        'This tool removes only clearly identifiable demo, seed, or test records.',
        ...countEntries.map(
          ([label, count]) => `${this.toTitleWords(label)}: ${count}`,
        ),
        ...envWarnings,
        ...uniqueBlockers,
      ],
      executionDetails: countEntries.map(
        ([label, count]) => `${this.toTitleWords(label)} deleted: ${count}`,
      ),
      users: seedUsers.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        name: this.userName(user) || user.email,
        studentNumber: user.studentProfile?.studentNumber ?? null,
        employeeId: user.teacherProfile?.employeeId ?? null,
      })),
      subjects: seedSubjects.map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
      })),
      tasks: seedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        subjectId: task.subjectId,
      })),
      groups: seedGroups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        subjectId: group.subjectId,
      })),
      submissions: seedSubmissions.map((submission) => ({
        id: submission.id,
        title: submission.title,
        studentId: submission.studentId ?? null,
        groupId: submission.groupId ?? null,
        subjectId: submission.subjectId,
      })),
      notifications: seedNotifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
      })),
      mailJobs: seedEmailJobs.map((job) => ({
        id: job.id,
        email: job.userEmail,
        idempotencyKey: job.idempotencyKey ?? null,
      })),
      submissionFiles: seedSubmissions.flatMap((submission) =>
        submission.files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
        })),
      ),
      userIds: seedUsers.map((user) => user.id),
      studentProfileIds: Array.from(seedStudentProfileIds),
      teacherProfileIds: Array.from(seedTeacherProfileIds),
      subjectIds: Array.from(seedSubjectIds),
      taskIds: Array.from(seedTaskIds),
      groupIds: Array.from(seedGroupIds),
      submissionIds: Array.from(seedSubmissionIds),
      notificationIds: Array.from(seedNotificationIds),
      mailJobIds: Array.from(seedMailJobIds),
    };
  }

  private async requireAnyUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        teacherProfile: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  private userProfileLabel(user: {
    role: string;
    studentProfile?: { studentNumber?: string | null } | null;
    teacherProfile?: { employeeId?: string | null } | null;
  }) {
    if (user.role === 'STUDENT') {
      return user.studentProfile?.studentNumber ?? 'Student';
    }
    if (user.role === 'TEACHER') {
      return user.teacherProfile?.employeeId ?? 'Teacher';
    }
    return 'Admin';
  }

  private isSeedUserCandidate(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    const email = String(user.email ?? '').trim().toLowerCase();
    const localPart = email.split('@')[0] ?? '';
    const domain = email.split('@')[1] ?? '';
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();

    if (
      domain === 'projtrack.local' ||
      domain.endsWith('.test') ||
      domain.endsWith('.example')
    ) {
      return true;
    }

    if (/^(demo|seed|test|sample)[._-]?/.test(localPart)) {
      return true;
    }

    return /^(demo|seed|test|sample)\b/.test(fullName);
  }

  private isSeedLabel(value?: string | null) {
    return /(?:^|[\s._-])(demo|seed|test|sample)(?:[\s._-]|$)/i.test(
      String(value ?? '').trim(),
    );
  }

  private allowSeedCleanup() {
    return String(process.env.ALLOW_SEED_DATA_CLEANUP ?? 'false').toLowerCase() === 'true';
  }

  private allowProductionAdminToolRuns() {
    return String(process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS ?? 'false').toLowerCase() === 'true';
  }

  private canExposeAccountActionLinks() {
    return (
      !this.isProductionRuntime() &&
      String(process.env.EXPOSE_ACCOUNT_ACTION_LINKS ?? 'false').toLowerCase() === 'true'
    );
  }

  private isProductionRuntime() {
    return [process.env.NODE_ENV, process.env.APP_ENV]
      .some((value) => String(value ?? '').toLowerCase() === 'production');
  }

  private async assertAdminRateLimit(
    action: string,
    actor?: AdminActorContext,
    targetKey?: string,
    options?: { limit?: number; windowMs?: number; blockMs?: number },
  ) {
    const limit = Math.max(1, Number(options?.limit ?? process.env.ADMIN_ACTION_MAX_PER_HOUR ?? 30));
    const windowMs = Math.max(60_000, Number(options?.windowMs ?? 60 * 60 * 1000));
    const blockMs = Math.max(60_000, Number(options?.blockMs ?? 60 * 60 * 1000));
    const key = [
      actor?.actorUserId || actor?.ipAddress || 'unknown-admin',
      String(targetKey ?? 'global').trim().toLowerCase() || 'global',
    ].join('|');
    const rateAction = `admin:${String(action || 'action').trim().toLowerCase() || 'action'}`;
    const now = new Date();

    const existing = await this.prisma.authRateLimit.findUnique({
      where: { action_key: { action: rateAction, key } },
    });

    if (existing?.blockedUntil && existing.blockedUntil.getTime() > now.getTime()) {
      throw new HttpException('Too many admin actions. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!existing || existing.firstAttemptAt.getTime() + windowMs <= now.getTime()) {
      await this.prisma.authRateLimit.upsert({
        where: { action_key: { action: rateAction, key } },
        update: {
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          blockedUntil: null,
        },
        create: {
          action: rateAction,
          key,
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        },
      });
      return;
    }

    if (existing.attempts >= limit) {
      await this.prisma.authRateLimit.update({
        where: { action_key: { action: rateAction, key } },
        data: {
          lastAttemptAt: now,
          blockedUntil: new Date(now.getTime() + blockMs),
        },
      });
      throw new HttpException('Too many admin actions. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.authRateLimit.update({
      where: { action_key: { action: rateAction, key } },
      data: {
        attempts: existing.attempts + 1,
        lastAttemptAt: now,
      },
    });
  }

  private async activeAdminCount() {
    return this.prisma.user.count({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
  }

  private async assertAdminActionAllowed(userId: string, status?: string | null) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role !== 'ADMIN') {
      return;
    }

    const isActiveAdmin = String(status ?? '').toUpperCase() === 'ACTIVE';
    if (!isActiveAdmin) {
      return;
    }

    const activeAdmins = await this.activeAdminCount();
    if (activeAdmins <= 1) {
      throw new ForbiddenException('You cannot deactivate or delete the last active admin.');
    }
  }

  private async queueAdminActivation(
    userId: string,
    actor?: AdminActorContext,
    auditAction: 'ACTIVATE' | 'RESEND_ACTIVATION' = 'ACTIVATE',
  ) {
    const user = await this.requireAnyUser(userId);
    if (user.role !== 'ADMIN') {
      throw new BadRequestException('Only admin accounts can use this activation flow.');
    }

    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({
      token: session.token,
      ref: session.publicRef,
      role: 'admin',
    });

    await this.mail.queueAccountActivation({
      to: user.email,
      recipientName: this.userName(user),
      activationLink,
      firstName: user.firstName,
      publicRef: session.publicRef,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'PENDING_PASSWORD_SETUP',
      },
    });

    await this.notifications.createInAppNotification(
      user.id,
      'Account activation ready',
      'An activation link has been queued for email delivery.',
    );

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: auditAction,
      module: 'Users',
      target: `${this.userName(user)} (${user.email})`,
      entityId: user.id,
      result: 'Queued',
      details:
        auditAction === 'RESEND_ACTIVATION'
          ? `Activation email resent by ${actor?.actorEmail ?? 'an administrator'}.`
          : `Activation email queued by ${actor?.actorEmail ?? 'an administrator'}.`,
      afterValue: 'PENDING_PASSWORD_SETUP',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP' };
  }

  private async queueAdminReset(userId: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(userId);
    if (user.role !== 'ADMIN') {
      throw new BadRequestException('Only admin accounts can use this password reset flow.');
    }
    if (!canSendPasswordRecoveryInstructions(user.status)) {
      throw new BadRequestException(
        'Reset links can only be sent to active or pending-setup admin accounts.',
      );
    }

    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: 'admin',
    });

    await this.mail.queuePasswordReset({
      to: user.email,
      recipientName: this.userName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'PENDING_PASSWORD_SETUP',
      },
    });

    await this.notifications.createInAppNotification(
      user.id,
      'Password reset ready',
      'A password reset link has been queued for email delivery.',
    );

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'RESET',
      module: 'Users',
      target: `${this.userName(user)} (${user.email})`,
      entityId: user.id,
      result: 'Queued',
      details: `Password reset email queued by ${actor?.actorEmail ?? 'an administrator'}.`,
      afterValue: 'PENDING_PASSWORD_SETUP',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP' };
  }

  private async getUserDeletionDependencySummary(userId: string) {
    const [ownedSubmissions, actedSubmissions, groupMemberships, subjectAssignments] =
      await Promise.all([
        this.prisma.submission.count({
          where: {
            OR: [{ studentId: userId }, { group: { members: { some: { studentId: userId } } } }],
          },
        }),
        this.prisma.submission.count({
          where: {
            OR: [{ submittedById: userId }, { reviewerId: userId }],
          },
        }),
        this.prisma.groupMember.count({
          where: { studentId: userId },
        }),
        this.prisma.subject.count({
          where: {
            teacher: {
              userId,
            },
          },
        }),
      ]);

    const blockers: string[] = [];
    if (ownedSubmissions > 0) {
      blockers.push(
        'The user owns submissions or belongs to submission groups. Use the guarded seed cleanup tool instead of deleting the user directly.',
      );
    }
    if (actedSubmissions > 0) {
      blockers.push('The user is referenced as a submission actor or reviewer.');
    }
    if (groupMemberships > 0) {
      blockers.push('The user still belongs to one or more groups.');
    }
    if (subjectAssignments > 0) {
      blockers.push('The user is still assigned to one or more subjects.');
    }

    return { blockers };
  }

  private normalizeSearch(search?: string) {
    return String(search ?? '').trim().toLowerCase();
  }

  private userName(user: { firstName?: string | null; lastName?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private userNameById(userId: string | null | undefined, members: Array<{ studentId: string; student: { firstName: string; lastName: string } }>) {
    if (!userId) return '';
    const match = members.find((item) => item.studentId === userId);
    return match ? this.userName(match.student) : userId;
  }

  private initials(firstName?: string | null, lastName?: string | null) {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'NA';
  }

  private formatUserStatus(status?: string | null) {
    const normalized = String(status ?? '').toUpperCase();
    if (normalized === 'ACTIVE') return 'Active';
    if (normalized === 'INACTIVE') return 'Inactive';
    if (normalized === 'RESTRICTED') return 'Restricted';
    if (normalized === 'PENDING_SETUP') return 'Pending Setup';
    if (normalized === 'PENDING_ACTIVATION') return 'Pending Activation';
    if (normalized === 'PENDING_PASSWORD_SETUP') return 'Pending Password Setup';
    return this.toTitleWords(normalized);
  }

  private formatStudentStatus(status?: string | null) {
    return isPendingSetupStatus(status) ? 'Pending Setup' : this.formatUserStatus(status);
  }

  private async queueStudentSetupLink(user: any, action: 'ACTIVATE' | 'RESET', actor?: AdminActorContext) {
    if (!canSendPasswordRecoveryInstructions(user.status)) {
      throw new BadRequestException(
        'Setup or reset links can only be sent to active or pending-setup students.',
      );
    }

    const firstTimeSetup = isPendingSetupStatus(user.status);
    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: 'student',
      mode: firstTimeSetup ? 'setup' : undefined,
    });

    await this.mail.queuePasswordReset({
      to: user.email,
      recipientName: this.userName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
      firstTimeSetup,
    });

    if (firstTimeSetup) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'PENDING_SETUP',
        },
      });
    }

    await this.notifications.createInAppNotification(
      user.id,
      firstTimeSetup ? 'Account setup ready' : 'Password reset ready',
      firstTimeSetup
        ? 'A first-time password setup link has been queued for email delivery.'
        : 'A password reset link has been queued for email delivery.',
    );

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action,
      module: 'Students',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: firstTimeSetup
        ? `Admin queued a student first-time password setup link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`
        : `Admin queued a student password reset link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`,
      afterValue: firstTimeSetup ? 'PENDING_SETUP' : undefined,
      ipAddress: actor?.ipAddress,
    });

    return {
      success: true,
      status: firstTimeSetup ? 'PENDING_SETUP' : user.status,
      queued: true,
      firstTimeSetup,
      ...(this.canExposeAccountActionLinks() ? { resetLink } : {}),
    };
  }

  private formatSubmissionStatus(status?: string | null) {
    return this.toTitleWords(String(status ?? ''));
  }

  private formatSubjectStatus(status?: string | null, isOpen?: boolean | null) {
    if (status) return this.toTitleWords(status);
    return isOpen ? 'Active' : 'Closed';
  }

  private normalizeSubmissionStatusInput(value: unknown) {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (!normalized) {
      throw new BadRequestException('Submission status is required.');
    }
    return normalized;
  }

  private parseOptionalDate(value: unknown) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date value.');
    }
    return parsed;
  }

  private parseOptionalGrade(value: unknown) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('Grade must be a valid non-negative number.');
    }
    return Math.round(parsed);
  }

  private nullableText(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeExternalLinks(value: unknown) {
    const items = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value
            .split('\n')
            .flatMap((chunk) => chunk.split(','))
        : [];

    return items
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      String((error as { code?: string }).code) === 'P2002'
    );
  }

  private toTitleWords(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private formatDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private formatDateTime(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('en-US');
  }

  private extractYearLevel(sectionName: string) {
    const match = String(sectionName || '').match(/\b(\d)\b/);
    return match?.[1] ?? '1';
  }

  private groupSectionNames(group: {
    section?: { name?: string | null } | null;
    subject?: { enrollments?: Array<{ section?: { name?: string | null } | null }> } | null;
  }) {
    const direct = group.section?.name ? [group.section.name] : [];
    const fromSubject = group.subject?.enrollments?.map((item) => item.section?.name).filter(Boolean) as string[] | undefined;
    return Array.from(new Set([...(direct || []), ...((fromSubject || []))]));
  }

  private async requireUser(id: string, role: 'STUDENT' | 'TEACHER') {
    const user = await this.prisma.user.findFirst({ where: { id, role } });
    if (!user) throw new NotFoundException(`${this.toTitleWords(role.toLowerCase())} not found.`);
    return user;
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

  private async resolveAudience(audience: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS') {
    if (audience === 'ALL') {
      return this.prisma.user.findMany();
    }
    if (audience === 'STUDENTS') {
      return this.prisma.user.findMany({ where: { role: 'STUDENT' } });
    }
    if (audience === 'TEACHERS') {
      return this.prisma.user.findMany({ where: { role: 'TEACHER' } });
    }
    return this.prisma.user.findMany({ where: { role: 'ADMIN' } });
  }
}
