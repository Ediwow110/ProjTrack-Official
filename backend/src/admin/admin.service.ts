import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { AdminReportsRepository } from '../repositories/admin-reports.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { MAIL_CATEGORY_KEYS } from '../common/constants/mail.constants';
import { buildActivationLink, buildResetPasswordLink } from '../common/utils/frontend-links';
import {
  buildMasterListFileName,
  buildMasterListWorkbookBuffer,
} from '../common/utils/master-list-export';
import {
  canSendPasswordRecoveryInstructions,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mail: MailService,
    private readonly accountActionTokens: AccountActionTokenService,
    private readonly notifications: NotificationsService,
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
          teacher: { include: { user: true } },
          enrollments: { include: { student: { include: { user: true, section: true } } } },
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
            student: true,
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
      include: { user: true },
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

  async markAllNotificationsRead() {
    const result = await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'READ_ALL',
      module: 'Notifications',
      target: 'Admin notification feed',
      result: 'Success',
      details: 'Admin marked all notifications as read.',
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
    const created: any[] = [];

    for (const user of audienceUsers) {
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
      }
    }

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'BROADCAST_CREATED',
      module: 'Notifications',
      target: body.title,
      result: 'Queued',
      details: `Broadcast sent to ${body.audience}.`,
    });

    return { success: true, audienceCount: audienceUsers.length, notificationsCreated: created.length };
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
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async auditDetail(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: true },
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
        teacher: { include: { user: true } },
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
    sectionCodes?: string[];
  }) {
    const code = String(payload.code ?? '').trim();
    const name = String(payload.name ?? '').trim();
    const teacherId = String(payload.teacherId ?? '').trim() || null;
    const sectionCodes = Array.isArray(payload.sectionCodes) ? payload.sectionCodes.map((item) => String(item).trim()).filter(Boolean) : [];

    if (!code || !name) {
      throw new BadRequestException('Subject code and subject name are required.');
    }

    const existing = await this.prisma.subject.findUnique({ where: { code } });
    if (existing) throw new ConflictException('That subject code already exists.');

    const teacherProfile = teacherId
      ? await this.prisma.teacherProfile.findFirst({ where: { userId: teacherId } })
      : null;

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

    if (sectionCodes.length) {
      const sections = await this.prisma.section.findMany({
        where: { name: { in: sectionCodes } },
        include: { students: true },
      });

      const enrollmentData = sections.flatMap((section) =>
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

    await this.prisma.subject.update({
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

  async activateStudent(id: string) {
    const user = await this.requireUser(id, 'STUDENT');
    return this.queueStudentSetupLink(user, 'ACTIVATE');
  }

  async sendStudentResetLink(id: string) {
    const user = await this.requireUser(id, 'STUDENT');
    return this.queueStudentSetupLink(user, 'RESET');
  }

  async deactivateStudent(id: string) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'INACTIVE' },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'DEACTIVATE',
      module: 'Students',
      target: this.userName(user),
      entityId: user.id,
      result: 'Success',
      details: 'Admin deactivated the student account.',
      afterValue: 'INACTIVE',
    });

    return { success: true, status: 'INACTIVE' };
  }

  async deactivateTeacher(id: string) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'INACTIVE' },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'DEACTIVATE',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Success',
      details: 'Admin deactivated the teacher account.',
      afterValue: 'INACTIVE',
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

  async activateTeacher(id: string) {
    const user = await this.requireUser(id, 'TEACHER');
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
      actorRole: 'ADMIN',
      action: 'ACTIVATE',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: 'Admin queued a teacher activation / password setup link.',
      afterValue: 'PENDING_PASSWORD_SETUP',
    });

    return { success: true, status: 'PENDING_PASSWORD_SETUP', activationLink };
  }

  async sendTeacherResetLink(id: string) {
    const user = await this.requireUser(id, 'TEACHER');
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
      actorRole: 'ADMIN',
      action: 'RESET',
      module: 'Teachers',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: 'Admin queued a teacher password reset link.',
      afterValue: 'PENDING_PASSWORD_SETUP',
    });

    return { success: true, status: 'PENDING_PASSWORD_SETUP', resetLink };
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
        status: 'PENDING_REVIEW',
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
          teacher: { include: { user: true } },
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

  async submissionDetail(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        subject: true,
        student: true,
        group: {
          include: {
            members: {
              include: { student: true },
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

  async saveAcademicSettings(payload: any) {
    const saved = await this.adminOpsRepository.saveAcademicSettings(payload);
    if (saved?.schoolYear) {
      await this.adminOpsRepository.ensureAcademicYear(saved.schoolYear, 'ACTIVE');
    }
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Academic Settings',
      target: 'Academic term configuration',
      result: 'Success',
      details: 'Academic settings updated.',
    });
    return saved;
  }

  async getSystemSettings() {
    return this.adminOpsRepository.getSystemSettings();
  }

  async saveSystemSettings(payload: any) {
    const saved = await this.adminOpsRepository.saveSystemSettings(payload);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'UPDATE',
      module: 'Settings',
      target: 'System settings',
      result: 'Success',
      details: 'System settings updated.',
    });
    return saved;
  }

  async getSystemTools() {
    return this.adminOpsRepository.getSystemTools();
  }

  async runSystemTool(id: string) {
    const response = await this.adminOpsRepository.runSystemTool(id);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'RUN',
      module: 'System Tools',
      target: response.result.title ?? id,
      result: response.result.status.includes('Failed') || response.result.status.includes('Restricted') ? 'Failed' : 'Success',
      details: response.result.summary,
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

  private async queueStudentSetupLink(user: any, action: 'ACTIVATE' | 'RESET') {
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
      actorRole: 'ADMIN',
      action,
      module: 'Students',
      target: this.userName(user),
      entityId: user.id,
      result: 'Queued',
      details: firstTimeSetup
        ? 'Admin queued a student first-time password setup link.'
        : 'Admin queued a student password reset link.',
      afterValue: firstTimeSetup ? 'PENDING_SETUP' : undefined,
    });

    return {
      success: true,
      status: firstTimeSetup ? 'PENDING_SETUP' : user.status,
      resetLink,
      firstTimeSetup,
    };
  }

  private formatSubmissionStatus(status?: string | null) {
    return this.toTitleWords(String(status ?? ''));
  }

  private formatSubjectStatus(status?: string | null, isOpen?: boolean | null) {
    if (status) return this.toTitleWords(status);
    return isOpen ? 'Active' : 'Closed';
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
          include: { student: true },
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
