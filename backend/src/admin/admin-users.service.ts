import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicStructureRepository } from '../repositories/academic-structure.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { buildActivationLink, buildResetPasswordLink } from '../common/utils/frontend-links';
import { FilesService } from '../files/files.service';
import { getRequestId } from '../common/request-context';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';
import { isPendingSetupStatus } from '../common/utils/account-setup-status';

export type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mail: MailService,
    private readonly accountActionTokens: AccountActionTokenService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
    private readonly academicStructureRepository: AcademicStructureRepository,
  ) {}

  async users(search?: string, role?: string, status?: string) {
    const q = this.normalizeSearch(search);
    const normalizedRole = String(role ?? '').trim().toUpperCase();
    const normalizedStatus = String(status ?? '').trim();
    const rows = await this.prisma.user.findMany({
      include: { studentProfile: { include: { section: true } }, teacherProfile: true },
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });
    return rows
      .filter((user) => {
        const displayStatus = this.formatUserStatus(user.status);
        const identifier = this.userIdentifier(user);
        const matchesSearch = !q || [user.email, user.firstName, user.lastName, identifier.displayIdentifier, identifier.identifierLabel, user.studentProfile?.studentNumber, user.teacherProfile?.employeeId].some((v) => String(v ?? '').toLowerCase().includes(q));
        const matchesRole = !normalizedRole || normalizedRole === 'ALL' || user.role === normalizedRole;
        const matchesStatus = !normalizedStatus || normalizedStatus === 'All' || displayStatus === normalizedStatus || String(user.status) === normalizedStatus.toUpperCase().replace(/\s+/g, '_');
        return matchesSearch && matchesRole && matchesStatus;
      })
      .map((user) => {
        const identifier = this.userIdentifier(user);
        return { id: user.id, displayIdentifier: identifier.displayIdentifier, identifierLabel: identifier.identifierLabel, profileId: user.studentProfile?.id ?? user.teacherProfile?.id ?? null, email: user.email, role: user.role, status: this.formatUserStatus(user.status), statusKey: user.status, firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', office: user.office ?? '', createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), profileLabel: this.userProfileLabel(user), studentNumber: user.studentProfile?.studentNumber ?? null, employeeId: user.teacherProfile?.employeeId ?? null, isSeedCandidate: user.email.startsWith('seed-') || user.email.startsWith('demo-') || user.email.startsWith('test-') };
      });
  }

  async createAdmin(payload: { firstName?: string; lastName?: string; email?: string; phone?: string; office?: string; sendActivationEmail?: boolean }, actor?: AdminActorContext) {
    const firstName = String(payload.firstName ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const phone = String(payload.phone ?? '').trim() || null;
    const office = String(payload.office ?? '').trim() || null;
    const sendActivationEmail = payload.sendActivationEmail !== false;
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name, and email are required.');
    await this.assertAdminRateLimit('create-admin', actor, email, { limit: Number(process.env.ADMIN_CREATE_MAX_PER_HOUR || 10), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('A user with that email already exists.');
    const user = await this.prisma.user.create({ data: { email, role: 'ADMIN', status: 'PENDING_ACTIVATION', firstName, lastName, phone, office } });
    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({ token: session.token, ref: session.publicRef, role: 'admin' });
    let activationJob: { id?: string } | null = null;
    if (sendActivationEmail) {
      activationJob = await this.mail.queueAccountActivation({ to: user.email, recipientName: this.userName(user), activationUrl: activationLink, firstName: user.firstName, publicRef: session.publicRef });
      if (!activationJob?.id) throw new BadRequestException('Activation email could not be confirmed as a queued MailJob.');
      await this.notifications.createInAppNotification(user.id, 'Account activation ready', 'An activation link has been queued for email delivery.');
    }
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'ADMIN_CREATED', module: 'Users', target: `${this.userName(user)} (${user.email})`, entityId: user.id, result: 'Success', details: sendActivationEmail ? `Admin account created and activation email queued by ${actor?.actorEmail ?? 'an administrator'}.` : `Admin account created without sending an activation email by ${actor?.actorEmail ?? 'an administrator'}.`, afterValue: 'PENDING_ACTIVATION', ipAddress: actor?.ipAddress });
    return { success: true, id: user.id, email: user.email, role: user.role, status: this.formatUserStatus(user.status), activationQueued: sendActivationEmail, ...(activationJob?.id ? { mailJobId: activationJob.id } : {}) };
  }

  async activateUser(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') return this.activateStudent(id, actor);
    if (user.role === 'TEACHER') return this.activateTeacher(id, actor);
    await this.assertAdminRateLimit('activate-user', actor, user.id);
    return this.queueAdminActivation(user.id, actor, 'ACTIVATE');
  }

  async deactivateUser(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') return this.deactivateStudent(id, actor);
    if (user.role === 'TEACHER') return this.deactivateTeacher(id, actor);
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, { limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    if (actor?.actorUserId && actor.actorUserId === user.id) throw new ForbiddenException('Admins cannot deactivate themselves from the admin users page.');
    await this.assertAdminActionAllowed(user.id, user.status);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'DEACTIVATE', module: 'Users', target: `${this.userName(user)} (${user.email})`, entityId: user.id, result: 'Success', details: `Admin account deactivated by ${actor?.actorEmail ?? 'an administrator'}.`, beforeValue: String(user.status), afterValue: 'INACTIVE', ipAddress: actor?.ipAddress, requestId: getRequestId() } });
    });
    return { success: true, status: 'INACTIVE' };
  }

  async sendUserResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') return this.sendStudentResetLink(id, actor);
    if (user.role === 'TEACHER') return this.sendTeacherResetLink(id, actor);
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    return this.queueAdminReset(user.id, actor);
  }

  async resendUserActivation(id: string, actor?: AdminActorContext) {
    const user = await this.requireAnyUser(id);
    if (user.role === 'STUDENT') return this.activateStudent(id, actor);
    if (user.role === 'TEACHER') return this.activateTeacher(id, actor);
    await this.assertAdminRateLimit('resend-activation', actor, user.email);
    return this.queueAdminActivation(user.id, actor, 'RESEND_ACTIVATION');
  }

  async deleteUser(id: string, confirmation?: string, actor?: AdminActorContext) {
    const normalizedConfirmation = String(confirmation ?? '').trim().toUpperCase();
    if (normalizedConfirmation !== 'DELETE USER') throw new BadRequestException('Type DELETE USER to confirm deleting a user.');
    const user = await this.prisma.user.findUnique({ where: { id }, include: { studentProfile: true, teacherProfile: true, groupMemberships: true } });
    if (!user) throw new NotFoundException('User not found.');
    await this.assertAdminRateLimit('delete-user', actor, user.id, { limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    if (actor?.actorUserId && actor.actorUserId === user.id) throw new ForbiddenException('Admins cannot delete themselves.');
    await this.assertAdminActionAllowed(user.id, user.status);
    if (!user.email.startsWith('seed-') && !user.email.startsWith('demo-') && !user.email.startsWith('test-')) {
      throw new BadRequestException('Hard delete is intended only for safely identifiable seed, demo, or test users. Deactivate real users instead.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({ where: { actorUserId: user.id }, data: { actorUserId: null } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.accountActionToken.deleteMany({ where: { userId: user.id } });
      if (user.studentProfile?.id) { await tx.enrollment.deleteMany({ where: { studentId: user.studentProfile.id } }); await tx.studentProfile.delete({ where: { id: user.studentProfile.id } }); }
      if (user.teacherProfile?.id) { await tx.teacherProfile.delete({ where: { id: user.teacherProfile.id } }); }
      await tx.user.delete({ where: { id: user.id } });
      await tx.auditLog.create({ data: { actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'DELETE', module: 'Users', target: `${this.userName(user)} (${user.email})`, entityId: user.id, result: 'Success', details: 'Seed/demo user hard-deleted.', ipAddress: actor?.ipAddress, requestId: getRequestId() } });
    });
    return { success: true, deleted: true };
  }

  async teachers(search?: string, status?: string, take?: number, skip?: number) {
    const q = this.normalizeSearch(search);
    const pageSize = take ?? 200;
    const offset = skip ?? 0;
    const [teachers, subjects] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'TEACHER' }, include: { teacherProfile: true }, orderBy: { createdAt: 'desc' }, take: pageSize + offset }),
      this.prisma.subject.findMany({ include: { teacher: { include: { user: { select: SAFE_USER_SELECT } } }, enrollments: { include: { student: { include: { user: { select: SAFE_USER_SELECT }, section: true } } } } } }),
    ]);
    const [total] = await Promise.all([
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
    ]);
    const mapped = teachers.map((user) => {
      const teacherSubjects = subjects.filter((s) => s.teacherId === user.teacherProfile?.id);
      const studentIds = new Set<string>();
      for (const subject of teacherSubjects) { for (const enrollment of subject.enrollments) { if (enrollment.student?.user?.id) studentIds.add(enrollment.student.user.id); } }
      return { id: user.id, name: this.userName(user), email: user.email, dept: user.teacherProfile?.department || 'Unassigned Department', employeeId: user.teacherProfile?.employeeId ?? null, subjects: teacherSubjects.length, students: studentIds.size, status: this.formatUserStatus(user.status), lastActive: user.updatedAt.toISOString() };
    }).filter((row) => {
      const matchesSearch = !q || [row.id, row.name, row.email, row.dept].some((v) => String(v || '').toLowerCase().includes(q));
      return matchesSearch && (!status || status === 'All' || row.status === status);
    });
    return { rows: mapped.slice(offset, offset + pageSize), total };
  }

  async students(search?: string, status?: string, take?: number, skip?: number) {
    const q = this.normalizeSearch(search);
    const pageSize = take ?? 100;
    const offset = skip ?? 0;
    const statusFilter = status && status !== 'All' ? status : undefined;

    const userWhere: any = { role: 'STUDENT' };
    if (statusFilter) {
      userWhere.status = statusFilter.toUpperCase().replace(/\s+/g, '_');
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        include: { studentProfile: { include: { section: { include: { academicYear: true, academicYearLevel: true } }, academicYear: true, academicYearLevel: true } }, authSessions: { where: { revokedAt: null }, orderBy: { lastUsedAt: 'desc' }, take: 1 }, accountActionTokens: { where: { type: 'ACCOUNT_ACTIVATION' }, orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
        take: pageSize + offset,
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);
    const emailJobs = rows.length ? await this.prisma.emailJob.findMany({ where: { userEmail: { in: rows.map((r) => r.email) }, templateKey: 'account-activation' }, orderBy: [{ createdAt: 'desc' }] }) : [];
    const latestMailJobByEmail = new Map<string, (typeof emailJobs)[number]>();
    for (const job of emailJobs) { const key = String(job.userEmail || '').trim().toLowerCase(); if (key && !latestMailJobByEmail.has(key)) latestMailJobByEmail.set(key, job); }
    const mapped = rows.map((user) => {
      const profile = user.studentProfile;
      return { id: user.id, studentId: profile?.studentNumber ?? user.id, lastName: user.lastName, firstName: user.firstName, middleInitial: String(profile?.middleInitial ?? '').trim(), academicYear: profile?.academicYear?.name ?? profile?.section?.academicYear?.name ?? '\u2014', yearLevel: profile?.academicYearLevel?.name ?? profile?.yearLevelName ?? profile?.section?.academicYearLevel?.name ?? profile?.section?.yearLevelName ?? (profile?.yearLevel ? `${profile.yearLevel}` : '\u2014'), name: this.userName(user), email: user.email, course: profile?.course ?? profile?.section?.course ?? '\u2014', section: profile?.section?.name ?? '\u2014', sectionId: profile?.section?.id ?? '', ...this.buildStudentActivationSummary(user, user.accountActionTokens[0] ?? null, latestMailJobByEmail.get(String(user.email || '').trim().toLowerCase()) ?? null, user.authSessions[0]?.lastUsedAt ?? null), createdBy: 'Admin', createdAt: user.createdAt.toISOString(), lastActive: user.authSessions[0]?.lastUsedAt?.toISOString() ?? '', lastLoginAt: user.authSessions[0]?.lastUsedAt?.toISOString() ?? '' };
    }).filter((row) => {
      return !q || [row.studentId, row.name, row.email, row.section].some((v) => String(v || '').toLowerCase().includes(q));
    });
    return { rows: mapped.slice(offset, offset + pageSize), total };
  }

  async createStudent(payload: { firstName?: string; middleInitial?: string; lastName?: string; email?: string; studentNumber?: string; section?: string; yearLevelId?: string; yearLevelName?: string; course?: string; yearLevel?: number | string; academicYearId?: string; academicYear?: string }) {
    const firstName = String(payload.firstName ?? '').trim();
    const middleInitial = String(payload.middleInitial ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const studentNumber = String(payload.studentNumber ?? '').trim();
    const sectionValue = String(payload.section ?? '').trim();
    if (!firstName || !lastName || !email || !studentNumber) throw new BadRequestException('First name, last name, email, and student number are required.');
    if (!sectionValue) throw new BadRequestException('Section is required when adding a student.');
    const [existingEmail, existingStudentNumber] = await Promise.all([this.prisma.user.findUnique({ where: { email } }), this.prisma.studentProfile.findUnique({ where: { studentNumber } })]);
    if (existingEmail) throw new ConflictException('A user with that email already exists.');
    if (existingStudentNumber) throw new ConflictException('That student number is already assigned.');
    const placement = await this.academicStructureRepository.resolveSectionPlacement({ academicYearId: payload.academicYearId, academicYear: payload.academicYear, academicYearLevelId: payload.yearLevelId, yearLevelName: payload.yearLevelName, course: payload.course, yearLevel: payload.yearLevel, sectionId: sectionValue, section: sectionValue, requireSection: Boolean(sectionValue) });
    const user = await this.prisma.user.create({ data: { email, role: 'STUDENT', status: 'PENDING_ACTIVATION', firstName, lastName, studentProfile: { create: { studentNumber, middleInitial: middleInitial || null, sectionId: placement.section?.id ?? null, academicYearId: placement.academicYear?.id ?? placement.section?.academicYearId ?? null, academicYearLevelId: placement.academicYearLevel?.id ?? placement.section?.academicYearLevelId ?? null, course: placement.course, yearLevel: placement.yearLevel, yearLevelName: placement.yearLevelName ?? placement.section?.yearLevelName ?? null } } } });
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'CREATE', module: 'Students', target: `${firstName} ${lastName}`.trim(), entityId: user.id, result: 'Success', details: 'Admin created a student account.', afterValue: 'PENDING_ACTIVATION' });
    return { success: true, id: user.id };
  }

  async updateStudent(id: string, payload: { firstName?: string; middleInitial?: string; lastName?: string; email?: string; studentNumber?: string; section?: string; yearLevelId?: string; yearLevelName?: string; course?: string; yearLevel?: number | string; academicYearId?: string; academicYear?: string }) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'STUDENT' }, include: { studentProfile: { include: { section: true, academicYear: true, academicYearLevel: true } } } });
    if (!user?.studentProfile) throw new NotFoundException('Student not found.');
    const firstName = String(payload.firstName ?? user.firstName).trim();
    const middleInitial = String(payload.middleInitial ?? user.studentProfile.middleInitial ?? '').trim();
    const lastName = String(payload.lastName ?? user.lastName).trim();
    const email = String(payload.email ?? user.email).trim().toLowerCase();
    const studentNumber = String(payload.studentNumber ?? user.studentProfile.studentNumber).trim();
    const sectionValue = String(payload.section ?? user.studentProfile.sectionId ?? '').trim();
    const [existingEmail, existingStudentNumber, placement] = await Promise.all([
      this.prisma.user.findFirst({ where: { email, id: { not: user.id } } }),
      this.prisma.studentProfile.findFirst({ where: { studentNumber, userId: { not: user.id } } }),
      this.academicStructureRepository.resolveSectionPlacement({ academicYearId: payload.academicYearId ?? user.studentProfile.academicYearId ?? user.studentProfile.section?.academicYearId ?? undefined, academicYear: payload.academicYear ?? user.studentProfile.academicYear?.name ?? undefined, academicYearLevelId: payload.yearLevelId ?? user.studentProfile.academicYearLevelId ?? undefined, yearLevelName: payload.yearLevelName ?? user.studentProfile.yearLevelName ?? user.studentProfile.academicYearLevel?.name ?? undefined, course: payload.course ?? user.studentProfile.course ?? undefined, yearLevel: payload.yearLevel ?? user.studentProfile.yearLevel ?? undefined, sectionId: sectionValue, section: sectionValue, requireSection: Boolean(sectionValue) }),
    ]);
    if (existingEmail) throw new ConflictException('A different user already uses that email.');
    if (existingStudentNumber) throw new ConflictException('A different student already uses that student number.');
    await this.prisma.user.update({ where: { id: user.id }, data: { email, firstName, lastName, studentProfile: { update: { studentNumber, middleInitial: middleInitial || null, sectionId: placement.section?.id ?? null, academicYearId: placement.academicYear?.id ?? placement.section?.academicYearId ?? null, academicYearLevelId: placement.academicYearLevel?.id ?? placement.section?.academicYearLevelId ?? null, course: placement.course, yearLevel: placement.yearLevel, yearLevelName: placement.yearLevelName ?? placement.section?.yearLevelName ?? null } } } });
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'UPDATE', module: 'Students', target: `${firstName} ${lastName}`.trim(), entityId: user.id, result: 'Success', details: 'Admin updated a student account profile.' });
    return { success: true, id: user.id };
  }

  async createTeacher(payload: { firstName?: string; lastName?: string; email?: string; employeeId?: string; department?: string }) {
    const firstName = String(payload.firstName ?? '').trim();
    const lastName = String(payload.lastName ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const employeeId = String(payload.employeeId ?? '').trim() || null;
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name, and email are required.');
    const department = await this.academicStructureRepository.ensureDepartmentName(payload.department);
    const [existingEmail, existingEmployeeId] = await Promise.all([this.prisma.user.findUnique({ where: { email } }), employeeId ? this.prisma.teacherProfile.findFirst({ where: { employeeId } }) : Promise.resolve(null)]);
    if (existingEmail) throw new ConflictException('A user with that email already exists.');
    if (existingEmployeeId) throw new ConflictException('That employee ID is already assigned.');
    const user = await this.prisma.user.create({ data: { email, role: 'TEACHER', status: 'PENDING_ACTIVATION', firstName, lastName, teacherProfile: { create: { employeeId, department } } } });
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'CREATE', module: 'Teachers', target: `${firstName} ${lastName}`.trim(), entityId: user.id, result: 'Success', details: 'Admin created a teacher account.', afterValue: 'PENDING_ACTIVATION' });
    return { success: true, id: user.id };
  }

  async updateTeacher(id: string, payload: { firstName?: string; lastName?: string; email?: string; employeeId?: string; department?: string }) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'TEACHER' }, include: { teacherProfile: true } });
    if (!user?.teacherProfile) throw new NotFoundException('Teacher not found.');
    const firstName = String(payload.firstName ?? user.firstName).trim();
    const lastName = String(payload.lastName ?? user.lastName).trim();
    const email = String(payload.email ?? user.email).trim().toLowerCase();
    const employeeId = String(payload.employeeId ?? user.teacherProfile.employeeId ?? '').trim() || null;
    const department = await this.academicStructureRepository.ensureDepartmentName(payload.department ?? user.teacherProfile.department);
    const [existingEmail, existingEmployeeId] = await Promise.all([this.prisma.user.findFirst({ where: { email, id: { not: user.id } } }), employeeId ? this.prisma.teacherProfile.findFirst({ where: { employeeId, userId: { not: user.id } } }) : Promise.resolve(null)]);
    if (existingEmail) throw new ConflictException('A different user already uses that email.');
    if (existingEmployeeId) throw new ConflictException('A different teacher already uses that employee ID.');
    await this.prisma.user.update({ where: { id: user.id }, data: { email, firstName, lastName, teacherProfile: { update: { employeeId, department } } } });
    await this.auditLogs.record({ actorRole: 'ADMIN', action: 'UPDATE', module: 'Teachers', target: `${firstName} ${lastName}`.trim(), entityId: user.id, result: 'Success', details: 'Admin updated a teacher account profile.' });
    return { success: true, id: user.id };
  }

  async activateStudent(id: string, actor?: AdminActorContext) { const user = await this.requireUser(id, 'STUDENT'); await this.assertAdminRateLimit('activate-user', actor, user.email); return this.queueStudentActivationLink(user, actor, 'ACTIVATE'); }
  async sendStudentResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    if (String(user.status ?? '').toUpperCase() === 'PENDING_ACTIVATION') return this.queueStudentActivationLink(user, actor, 'RESEND_ACTIVATION');
    return this.queueStudentSetupLink(user, 'RESET', actor);
  }
  async deactivateStudent(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'STUDENT');
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, { limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    await this.prisma.$transaction([this.prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } }), this.prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } })]);
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: 'DEACTIVATE', module: 'Students', target: this.userName(user), entityId: user.id, result: 'Success', details: `Admin deactivated the student account${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`, afterValue: 'INACTIVE', ipAddress: actor?.ipAddress });
    return { success: true, status: 'INACTIVE' };
  }
  async deactivateTeacher(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('deactivate-user', actor, user.id, { limit: Number(process.env.ADMIN_DESTRUCTIVE_MAX_PER_HOUR || 20), windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
    await this.prisma.$transaction([this.prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } }), this.prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } })]);
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: 'DEACTIVATE', module: 'Teachers', target: this.userName(user), entityId: user.id, result: 'Success', details: `Admin deactivated the teacher account${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`, afterValue: 'INACTIVE', ipAddress: actor?.ipAddress });
    return { success: true, status: 'INACTIVE' };
  }

  async activateTeacher(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('activate-user', actor, user.email);
    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({ token: session.token, ref: session.publicRef, role: 'teacher' });
    const mailJob = await this.mail.queueAccountActivation({ to: user.email, recipientName: this.userName(user), activationUrl: activationLink, firstName: user.firstName, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Activation email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Account activation ready', 'An activation link has been queued for email delivery.');
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: 'ACTIVATE', module: 'Teachers', target: this.userName(user), entityId: user.id, result: 'Queued', details: `Admin queued a teacher activation link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`, afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id, ...(this.canExposeAccountActionLinks() ? { activationLink } : {}) };
  }

  async sendTeacherResetLink(id: string, actor?: AdminActorContext) {
    const user = await this.requireUser(id, 'TEACHER');
    await this.assertAdminRateLimit('send-reset-link', actor, user.email);
    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const resetLink = buildResetPasswordLink({ token: session.token, ref: session.publicRef, role: 'teacher' });
    const mailJob = await this.mail.queuePasswordReset({ to: user.email, recipientName: this.userName(user), firstName: user.firstName, resetLink, expiresAt: session.expiresAt, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Password reset email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Password reset ready', 'A password reset link has been queued for email delivery.');
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: 'RESET', module: 'Teachers', target: this.userName(user), entityId: user.id, result: 'Queued', details: `Admin queued a teacher password reset link${actor?.actorEmail ? ` (${actor.actorEmail})` : ''}.`, afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id, ...(this.canExposeAccountActionLinks() ? { resetLink } : {}) };
  }

  async studentDetail(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'STUDENT' }, include: { studentProfile: { include: { section: { include: { academicYear: true, academicYearLevel: true } }, academicYear: true, academicYearLevel: true, enrollments: { include: { subject: true } } } }, groupMemberships: { include: { group: true } } } });
    if (!user) throw new NotFoundException('Student not found.');
    const recentSubmissions = await this.prisma.submission.findMany({ where: { OR: [{ studentId: user.id }, { group: { members: { some: { studentId: user.id } } } }] }, include: { subject: true }, orderBy: { submittedAt: 'desc' }, take: 5 });
    const profile = user.studentProfile!;
    const detailData: any = { initials: this.initials(user.firstName, user.lastName), name: this.userName(user), subtitle: `${profile.studentNumber ?? 'No ID'} \u00B7 ${profile.course ?? '\u2014'} \u00B7 ${profile.section?.name ?? '\u2014'}`, status: this.formatStudentStatus(user.status), form: { firstName: user.firstName, middleInitial: profile.middleInitial ?? '', lastName: user.lastName, email: user.email, studentNumber: profile.studentNumber ?? '', section: profile.section?.id ?? profile.section?.name ?? '', course: profile.course ?? '', yearLevel: profile.academicYearLevel?.name ?? profile.yearLevelName ?? String(profile.yearLevel ?? ''), yearLevelId: profile.academicYearLevelId ?? '', yearLevelName: profile.academicYearLevel?.name ?? profile.yearLevelName ?? '', academicYearId: profile.academicYearId ?? profile.section?.academicYearId ?? '', academicYear: profile.academicYear?.name ?? profile.section?.academicYear?.name ?? '' }, accountDetails: [{ label: 'Email', value: user.email }, { label: 'Student ID', value: profile.studentNumber ?? '\u2014' }, { label: 'Academic Year', value: profile.academicYear?.name ?? profile.section?.academicYear?.name ?? '\u2014' }, { label: 'Section', value: profile.section?.name ?? '\u2014' }, { label: 'Year Level', value: profile.academicYearLevel?.name ?? profile.yearLevelName ?? String(profile.yearLevel ?? '\u2014') }, { label: 'M.I.', value: String(profile.middleInitial ?? '').trim() || '\u2014' }], assignedSubjects: (profile.enrollments ?? []).map((e: any) => e.subject.name), stats: [{ l: 'Total Submissions', v: String(recentSubmissions.length) }, { l: 'Group Projects', v: String(user.groupMemberships.length) }, { l: 'Status', v: this.formatStudentStatus(user.status) }], recentSubmissions: recentSubmissions.map((s) => ({ title: s.title, subject: s.subject?.name ?? s.subjectId, date: s.submittedAt ? s.submittedAt.toISOString() : '\u2014', status: s.status })) };
    return detailData;
  }

  async teacherDetail(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'TEACHER' }, include: { teacherProfile: true } });
    if (!user) throw new NotFoundException('Teacher not found.');
    const handledSubjects = await this.prisma.subject.findMany({ where: { teacherId: user.teacherProfile?.id }, include: { enrollments: { include: { section: true } } }, orderBy: { code: 'asc' } });
    const pendingReviews = await this.prisma.submission.count({ where: { status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'LATE'] }, subject: { teacherId: user.teacherProfile?.id } } });
    const sectionsCount = new Set(handledSubjects.flatMap((s) => s.enrollments.map((e: any) => e.section?.name).filter(Boolean))).size;
    const detailData: any = { initials: this.initials(user.firstName, user.lastName), name: this.userName(user), subtitle: `${user.teacherProfile?.employeeId ?? '\u2014'} \u00B7 Faculty`, status: this.formatUserStatus(user.status), form: { firstName: user.firstName, lastName: user.lastName, email: user.email, employeeId: user.teacherProfile?.employeeId ?? '', department: user.teacherProfile?.department ?? '' }, accountDetails: [{ label: 'Email', value: user.email }, { label: 'Employee ID', value: user.teacherProfile?.employeeId ?? '\u2014' }, { label: 'Assigned Subjects', value: String(handledSubjects.length) }], stats: [{ l: 'Subjects', v: String(handledSubjects.length) }, { l: 'Pending Reviews', v: String(pendingReviews) }, { l: 'Sections', v: String(sectionsCount) }], handledSubjects: handledSubjects.map((s) => ({ code: s.code, name: s.name, section: Array.from(new Set(s.enrollments.map((e: any) => e.section?.name).filter(Boolean) as string[])).join(', '), students: s.enrollments.length })) };
    return detailData;
  }

  private normalizeSearch(search?: string) {
    const raw = String(search ?? '').trim();
    if (!raw) return '';
    const lowered = raw.toLowerCase();
    if (/^[a-zA-Z0-9 .@_'-]+$/.test(lowered) && lowered.length <= 100) return lowered;
    return '';
  }

  private formatUserStatus(status: string) {
    const map: Record<string, string> = {
      PENDING_SETUP: 'Pending Setup',
      PENDING_ACTIVATION: 'Pending Activation',
      PENDING_PASSWORD_SETUP: 'Pending Password Setup',
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      RESTRICTED: 'Restricted',
      DISABLED: 'Disabled',
      ARCHIVED: 'Archived',
      GRADUATED: 'Graduated',
    };
    return map[status] || status;
  }

  private userIdentifier(user: any): { displayIdentifier: string; identifierLabel: string } {
    if (user.role === 'STUDENT') return { displayIdentifier: user.studentProfile?.studentNumber ?? user.id, identifierLabel: 'Student #' };
    if (user.role === 'TEACHER') return { displayIdentifier: user.teacherProfile?.employeeId ?? user.id, identifierLabel: 'Employee #' };
    return { displayIdentifier: user.id, identifierLabel: 'ID' };
  }

  private userName(user: any): string {
    if (!user) return 'Unknown';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown User';
  }

  private userProfileLabel(user: any): string {
    if (user.role === 'STUDENT') { const sp = user.studentProfile; return sp ? `${sp.course ?? ''} / ${sp.section?.name ?? ''}`.replace(/^\/\s*/, '') || '\u2014' : '\u2014'; }
    if (user.role === 'TEACHER') { const tp = user.teacherProfile; return tp?.department || '\u2014'; }
    return 'Administrator';
  }

  private initials(firstName: string, lastName: string): string {
    return `${(firstName ?? '')[0] ?? ''}${(lastName ?? '')[0] ?? ''}`.toUpperCase() || '?';
  }

  private formatStudentStatus(status: string): string {
    const map: Record<string, string> = { PENDING_ACTIVATION: 'Pending Activation', PENDING_PASSWORD_SETUP: 'Pending Password Setup', ACTIVE: 'Active', INACTIVE: 'Inactive', RESTRICTED: 'Restricted', DISABLED: 'Disabled', ARCHIVED: 'Archived', GRADUATED: 'Graduated', PENDING_SETUP: 'Pending Setup' };
    return map[status] || status;
  }

  private async requireAnyUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async requireUser(id: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.role !== role) throw new NotFoundException(`${role} not found.`);
    return user;
  }

  private async assertAdminRateLimit(action: string, actor: AdminActorContext | undefined, key: string, opts?: { limit?: number; windowMs?: number; blockMs?: number }) {
    const limit = opts?.limit ?? 60;
    const windowMs = opts?.windowMs ?? 60_000;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    await this.prisma.authRateLimit.deleteMany({ where: { action, key, firstAttemptAt: { lte: windowStart } } });
    const row = await this.prisma.authRateLimit.upsert({ where: { action_key: { action, key } }, update: { attempts: { increment: 1 }, lastAttemptAt: now }, create: { action, key, attempts: 1, firstAttemptAt: now, lastAttemptAt: now } });
    if (row.attempts > limit) throw new BadRequestException('Too many requests. Please try again later.');
  }

  private async assertAdminActionAllowed(userId: string, currentStatus: string) {
    if (currentStatus === 'DISABLED') throw new BadRequestException('This account is disabled and cannot be modified.');
    if (currentStatus === 'ARCHIVED') throw new BadRequestException('This account is archived and cannot be modified.');
  }

  private async queueAdminActivation(userId: string, actor: AdminActorContext | undefined, type: 'ACTIVATE' | 'RESEND_ACTIVATION') {
    const user = await this.requireAnyUser(userId);
    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({ token: session.token, ref: session.publicRef, role: 'admin' });
    const mailJob = await this.mail.queueAccountActivation({ to: user.email, recipientName: this.userName(user), activationUrl: activationLink, firstName: user.firstName, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Activation email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Account activation ready', 'An activation link has been queued for email delivery.');
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: type, module: 'Users', target: this.userName(user), entityId: user.id, result: 'Queued', details: `Admin ${type === 'ACTIVATE' ? 'activated' : 're-sent activation for'} user.`, afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id };
  }

  private async queueAdminReset(userId: string, actor: AdminActorContext | undefined) {
    const user = await this.requireAnyUser(userId);
    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const resetLink = buildResetPasswordLink({ token: session.token, ref: session.publicRef, role: 'admin' });
    const mailJob = await this.mail.queuePasswordReset({ to: user.email, recipientName: this.userName(user), firstName: user.firstName, resetLink, expiresAt: session.expiresAt, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Password reset email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Password reset ready', 'A password reset link has been queued for email delivery.');
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: actor?.actorRole ?? 'ADMIN', action: 'RESET', module: 'Users', target: this.userName(user), entityId: user.id, result: 'Queued', details: 'Admin queued a password reset link for user.', afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id };
  }

  private async queueStudentActivationLink(user: any, actor: AdminActorContext | undefined, type: 'ACTIVATE' | 'RESEND_ACTIVATION') {
    const session = await this.accountActionTokens.issueActivation(user.id);
    const activationLink = buildActivationLink({ token: session.token, ref: session.publicRef, role: 'student' });
    const mailJob = await this.mail.queueAccountActivation({ to: user.email, recipientName: this.userName(user), activationUrl: activationLink, firstName: user.firstName, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Activation email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Account activation ready', 'An activation link has been queued for email delivery.');
    const actionLabel = type === 'ACTIVATE' ? 'ACTIVATE' : 'RESEND_ACTIVATION';
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: actionLabel, module: 'Students', target: this.userName(user), entityId: user.id, result: 'Queued', details: `Admin queued a student ${type === 'ACTIVATE' ? 'activation' : 're-activation'} link.`, afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id, ...(this.canExposeAccountActionLinks() ? { activationLink } : {}) };
  }

  private async queueStudentSetupLink(user: any, type: 'RESET', actor: AdminActorContext | undefined) {
    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const setupLink = buildResetPasswordLink({ token: session.token, ref: session.publicRef, role: 'student' });
    const mailJob = await this.mail.queuePasswordReset({ to: user.email, recipientName: this.userName(user), firstName: user.firstName, resetLink: setupLink, expiresAt: session.expiresAt, publicRef: session.publicRef });
    if (!mailJob?.id) throw new BadRequestException('Password setup email could not be confirmed as a queued MailJob.');
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING_PASSWORD_SETUP' } });
    await this.notifications.createInAppNotification(user.id, 'Password setup ready', 'A password setup link has been queued for email delivery.');
    await this.auditLogs.record({ actorUserId: actor?.actorUserId, actorRole: 'ADMIN', action: 'RESET', module: 'Students', target: this.userName(user), entityId: user.id, result: 'Queued', details: 'Admin queued a student password reset/setup link.', afterValue: 'PENDING_PASSWORD_SETUP', ipAddress: actor?.ipAddress });
    return { success: true, queued: true, status: 'PENDING_PASSWORD_SETUP', mailJobId: mailJob.id };
  }

  async removeStudentFromSection(sectionId: string, studentId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: studentId, role: 'STUDENT' },
        include: { studentProfile: { include: { section: true } } },
      });
      if (!user?.studentProfile) throw new NotFoundException('Student not found.');
      if (user.studentProfile.sectionId !== sectionId) {
        throw new BadRequestException('Student is not assigned to this section.');
      }
      await this.prisma.studentProfile.update({
        where: { userId: studentId },
        data: { sectionId: null, academicYearId: null, academicYearLevelId: null },
      });
      await this.auditLogs.record({
        actorRole: 'ADMIN',
        action: 'UPDATE',
        module: 'Sections',
        target: `${user.firstName} ${user.lastName}`.trim(),
        entityId: studentId,
        result: 'Success',
        details: `Admin removed student from section ${sectionId}.`,
      });
      return { success: true };
    } catch (error) {
      const msg = `removeStudentFromSection failed: sectionId=${sectionId}, studentId=${studentId}, error=${error instanceof Error ? error.stack : String(error)}`;
      this.logger.error(msg);
      console.error('DEBUG_REMOVE_ERROR:', msg);
      throw error;
    }
  }

  private buildStudentActivationSummary(user: any, token: any, mailJob: any, lastUsedAt: Date | null) {
    if (isPendingSetupStatus(user.status)) {
      const mailSentDaysAgo = mailJob?.createdAt ? Math.floor((Date.now() - new Date(mailJob.createdAt).getTime()) / 86400000) : null;
      return { status: 'Pending Setup', linkSent: mailSentDaysAgo != null ? `${mailSentDaysAgo}d ago` : '\u2014', lastLinkSentAt: mailJob?.createdAt ? new Date(mailJob.createdAt).toISOString() : '\u2014' };
    }
    const pendingStatusMap: Record<string, string> = { PENDING_ACTIVATION: 'Pending Activation', PENDING_PASSWORD_SETUP: 'Pending Setup', ACTIVE: 'Active', INACTIVE: 'Inactive' };
    const loginText = lastUsedAt ? `${Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86400000)}d ago` : 'Never';
    return { status: pendingStatusMap[user.status] || user.status, linkSent: '\u2014', lastLinkSentAt: '\u2014', lastActive: loginText };
  }

  private canExposeAccountActionLinks(): boolean {
    if (this.isProductionRuntime()) return String(process.env.EXPOSE_ACCOUNT_ACTION_LINKS ?? '').toLowerCase() === 'true';
    return true;
  }

  private isProductionRuntime(): boolean {
    return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production' || String(process.env.APP_ENV ?? '').toLowerCase() === 'production';
  }

  private allowSeedCleanup(): boolean {
    return String(process.env.ALLOW_SEED_DATA_CLEANUP ?? '').toLowerCase() === 'true';
  }

  private allowProductionAdminToolRuns(): boolean {
    return String(process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS ?? '').toLowerCase() === 'true';
  }
}
