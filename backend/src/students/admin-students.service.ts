import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImportStudentsDto } from './dto/import-students.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { UserRepository } from '../repositories/user.repository';
import { ImportFileService } from './import-file.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { buildActivationLink, buildResetPasswordLink } from '../common/utils/frontend-links';
import {
  canSendPasswordRecoveryInstructions,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';
import { userDisplayName } from '../common/utils/user-display-name';
import { PrismaService } from '../prisma/prisma.service';

function normalizeAcademicYearValue(value?: string | null) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeYearLevelValue(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const numericMatch = raw.match(/^(\d+)(?:st|nd|rd|th)?(?:\s+year)?$/i);
  if (!numericMatch?.[1]) {
    return raw.replace(/\s+/g, ' ');
  }

  const parsed = Number(numericMatch[1]);
  if (!Number.isInteger(parsed) || parsed < 1) return raw.replace(/\s+/g, ' ');

  const suffix =
    parsed % 10 === 1 && parsed % 100 !== 11
      ? 'st'
      : parsed % 10 === 2 && parsed % 100 !== 12
        ? 'nd'
        : parsed % 10 === 3 && parsed % 100 !== 13
          ? 'rd'
          : 'th';
  return `${parsed}${suffix} Year`;
}

@Injectable()
export class AdminStudentsService {
  private readonly logger = new Logger(AdminStudentsService.name);

  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly adminOpsRepository: AdminOpsRepository,
    private readonly userRepository: UserRepository,
    private readonly importFileService: ImportFileService,
    private readonly accountActionTokens: AccountActionTokenService,
    private readonly prisma: PrismaService,
  ) {}

  template() {
    return {
      columns: [
        'student_id',
        'last_name',
        'first_name',
        'middle_initial',
        'year_level',
        'section',
        'course',
        'academic_year',
        'email',
      ],
      sample: {
        student_id: 'STU-2026-00001',
        last_name: 'Dela Cruz',
        first_name: 'Juan',
        middle_initial: 'M',
        year_level: '3rd Year',
        section: 'BSIT 3A',
        course: 'BSIT',
        academic_year: '2025-2026',
        email: 'juan.delacruz@example.edu',
      },
    };
  }

async importPreview(body: ImportStudentsDto) {
  const [existingStudents, academicYears, sections] = await Promise.all([
    this.userRepository.listStudents() as Promise<any[]>,
    this.adminOpsRepository.listAcademicYears(),
    this.adminOpsRepository.listSections(),
  ]);
  const sourceRows =
    body.rows && body.rows.length
      ? body.rows
      : body.fileType === 'csv' && body.csvText
        ? this.importFileService.parseCsvText(body.csvText)
        : body.fileBase64
          ? this.importFileService.parseBase64Spreadsheet(body.fileBase64, body.fileName)
          : [];

  if (!sourceRows.length) {
    throw new BadRequestException('No import rows found.');
  }

  const seenStudentIds = new Set<string>();
  const seenEmails = new Set<string>();
  const academicYearNames = new Set(
    academicYears.map((year) => normalizeAcademicYearValue(year.name).toLowerCase()).filter(Boolean),
  );
  const sectionLookup = new Set(
    sections.flatMap((section) => {
      const academicYear = String(section.academicYear || '').trim().toLowerCase();
      const course = String(section.program || '').trim().toLowerCase();
      const sectionCode = String(section.code || '').trim().toLowerCase();
      const yearLevelCandidates = Array.from(
        new Set(
          [
            normalizeYearLevelValue(String(section.yearLevelName || section.yearLevelLabel || '')),
            normalizeYearLevelValue(String(section.yearLevel || '')),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      );
      return yearLevelCandidates.map((yearLevel) =>
        [academicYear, course, yearLevel.toLowerCase(), sectionCode].join('||'),
      );
    }),
  );

  const preview = sourceRows.map((row, index) => {
      const issues: string[] = [];
      const studentId = (row.student_id || '').trim();
      const email = (row.email || '').trim().toLowerCase();
      const course = (row.course || '').trim();
      const rawYearLevel = (row.year_level || '').trim();
      const normalizedYearLevel = normalizeYearLevelValue(rawYearLevel);
      const section = (row.section || '').trim();
      const academicYear = normalizeAcademicYearValue(row.academic_year);

      if (!studentId) issues.push('Missing student_id');
      if (!row.first_name?.trim()) issues.push('Missing first_name');
      if (!row.last_name?.trim()) issues.push('Missing last_name');
      if (!email) issues.push('Missing email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Invalid email format');
      if (!course) issues.push('Missing course');
      if (!rawYearLevel) issues.push('Missing year_level');
      if (!section) issues.push('Missing section');
      if (!academicYear) issues.push('Missing academic_year');
      if (academicYear && !academicYearNames.has(academicYear.toLowerCase())) {
        issues.push('Unknown academic_year');
      }
      if (
        academicYear &&
        course &&
        rawYearLevel &&
        section &&
        !sectionLookup.has(
          [
            academicYear.toLowerCase(),
            course.toLowerCase(),
            normalizedYearLevel.toLowerCase(),
            section.toLowerCase(),
          ].join('||'),
        )
      ) {
        issues.push(
          `Section ${section} does not exist under Academic Year ${academicYear} and Year Level ${normalizedYearLevel || rawYearLevel}.`,
        );
      }
      if (
        studentId &&
        (
          seenStudentIds.has(studentId) ||
          existingStudents.some((u) => String(u.studentProfile?.studentNumber ?? '').toLowerCase() === studentId.toLowerCase())
        )
      ) {
        issues.push('Duplicate student_id');
      }
      if (
        email &&
        (
          seenEmails.has(email) ||
          existingStudents.some((u) => String(u.email || '').toLowerCase() === email)
        )
      ) {
        issues.push('Duplicate email');
      }

      if (studentId) seenStudentIds.add(studentId);
      if (email) seenEmails.add(email);

      return {
        index,
        row: {
          ...row,
          course,
          year_level: normalizedYearLevel || rawYearLevel,
          section,
          academic_year: academicYear,
          email,
          student_id: studentId,
          middle_initial: String(row.middle_initial ?? '').trim(),
        },
        valid: issues.length === 0,
        issues,
      };
    });

    await this.prisma.importBatch.deleteMany({
      where: { type: 'student', expiresAt: { lt: new Date() } },
    });

    const batch = await this.prisma.importBatch.create({
      data: {
        type: 'student',
        status: 'preview',
        fileName: body.fileName,
        payload: { preview },
        expiresAt: new Date(Date.now() + Number(process.env.STUDENT_IMPORT_BATCH_TTL_MS || 24 * 60 * 60 * 1000)),
      },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'IMPORT_PREVIEW',
      module: 'Students',
      target: body.fileName,
      entityId: batch.id,
      result: 'Success',
      details: `Previewed ${sourceRows.length} row(s); ${preview.filter((r) => r.valid).length} valid.`,
    });

    return {
      batchId: batch.id,
      fileName: body.fileName,
      totalRows: sourceRows.length,
      validRows: preview.filter((r) => r.valid).length,
      invalidRows: preview.filter((r) => !r.valid).length,
      preview,
    };
  }

  async confirmImport(body: ConfirmImportDto) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: body.batchId } });
    if (!batch || batch.type !== 'student' || batch.status !== 'preview' || batch.expiresAt < new Date()) {
      throw new NotFoundException('Import batch not found.');
    }

    const payload = (batch.payload || {}) as any;
    const preview = Array.isArray(payload.preview) ? payload.preview : [];
    const acceptedSet = new Set(body.acceptedRowIndexes);
    const rowsToImport = preview.filter((row: any) => row.valid && acceptedSet.has(row.index));
    if (!rowsToImport.length) {
      throw new BadRequestException('No valid rows selected for import.');
    }

    const importedUsers = await Promise.all(
      rowsToImport.map(async (entry) => {
        const placement = await this.adminOpsRepository.resolveSectionPlacement({
          academicYear: entry.row.academic_year?.trim(),
          course: entry.row.course?.trim(),
          yearLevel: entry.row.year_level?.trim(),
          section: entry.row.section?.trim(),
          requireSection: true,
        });

        return this.userRepository.createStudent({
          email: entry.row.email.trim().toLowerCase(),
          firstName: entry.row.first_name.trim(),
          lastName: entry.row.last_name.trim(),
          middleInitial: String(entry.row.middle_initial ?? '').trim() || undefined,
          studentNumber: entry.row.student_id.trim(),
          sectionId: placement.section?.id ?? null,
          section: placement.section?.name ?? entry.row.section.trim(),
          academicYearLevelId:
            placement.academicYearLevel?.id ?? placement.section?.academicYearLevelId ?? null,
          yearLevelName:
            placement.yearLevelName ?? placement.section?.yearLevelName ?? undefined,
          course: placement.course ?? undefined,
          yearLevel: placement.yearLevel ?? undefined,
          academicYearId:
            placement.academicYear?.id ?? placement.section?.academicYearId ?? null,
          academicYear:
            placement.academicYear?.name ?? placement.section?.academicYear?.name ?? undefined,
          status: 'PENDING_SETUP',
        });
      }),
    );
    const invalidRows = preview.filter((row: any) => !row.valid).length;
    const updatedOrSkipped = preview.filter(
      (row: any) => row.valid && !acceptedSet.has(row.index),
    ).length;
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'consumed', consumedAt: new Date() },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'IMPORT_CONFIRM',
      module: 'Students',
      target: body.batchId,
      entityId: body.batchId,
      result: 'Success',
      details: `Imported ${importedUsers.length} student account(s) as pending setup.`,
    });

    return {
      success: true,
      imported: importedUsers.length,
      summary: {
        created: importedUsers.length,
        updatedOrSkipped,
        invalidRows,
        pendingSetup: importedUsers.length,
      },
      students: importedUsers.map((user) => ({
        id: user.id,
        email: user.email,
        studentNumber: user.studentProfile?.studentNumber,
        name: `${user.firstName} ${user.lastName}`,
        status: user.status,
      })),
    };
  }

  async activateStudent(id: string, actorUserId?: string) {
    const user = await this.findStudent(id);
    return this.queueStudentSetupInvite(user, 'ACTIVATE_STUDENT', actorUserId);
  }

  async sendSetupInvite(id: string, actorUserId?: string) {
    const user = await this.findStudent(id);
    return this.queueStudentSetupInvite(user, 'SEND_SETUP_INVITE', actorUserId);
  }

  async sendResetLink(id: string, actorUserId?: string) {
    const user = await this.findStudent(id);
    if (isPendingSetupStatus(user.status)) {
      return this.queueStudentSetupInvite(user, 'SEND_SETUP_INVITE', actorUserId);
    }
    return this.queueStudentResetLink(user, actorUserId);
  }

  private async queueStudentSetupInvite(
    user: any,
    action: 'ACTIVATE_STUDENT' | 'SEND_SETUP_INVITE',
    actorUserId?: string,
  ) {
    const email = this.normalizeEmail(user.email);
    const diagnostics: Record<string, unknown> = {
      event: 'admin.student_setup_invite',
      adminUserId: actorUserId ?? null,
      studentId: user.id,
      studentEmail: maskEmail(email),
      actionRequested: action,
      userStatus: user.status,
      tokenCreated: false,
      tokenReused: false,
      mailJobCreated: false,
      mailJobId: null,
      skippedReason: null,
    };

    if (!isPendingSetupStatus(user.status)) {
      diagnostics.skippedReason = 'not_pending_setup';
      this.logStudentMailDiagnostics(diagnostics);
      throw new BadRequestException('Setup invitations can only be sent to pending-setup students.');
    }

    if (!email) {
      diagnostics.skippedReason = 'missing_email';
      this.logStudentMailDiagnostics(diagnostics);
      throw new BadRequestException('Student does not have an email address.');
    }

    const session = await this.accountActionTokens.issueActivation(user.id);
    diagnostics.tokenCreated = !session.reused;
    diagnostics.tokenReused = session.reused;
    const activationLink = buildActivationLink({
      token: session.token,
      ref: session.publicRef,
      role: 'student',
    });

    const mailJob = await this.mailService.queueStudentSetupInvitation({
      to: email,
      recipientName: userDisplayName(user),
      firstName: user.firstName,
      activationLink,
      publicRef: session.publicRef,
    });
    diagnostics.mailJobCreated = true;
    diagnostics.mailJobId = mailJob.id;

    await this.userRepository.updateAuthFields(user.id, {
      status: 'PENDING_SETUP',
      updatedAt: new Date().toISOString(),
    });

    await this.notificationsService.createInAppNotification(
      user.id,
      'Account setup email queued',
      'A first-time account setup email has been queued for delivery.',
    );

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'ADMIN',
      action,
      module: 'Students',
      target: maskEmail(email),
      entityId: user.id,
      result: 'Queued',
      details: JSON.stringify(diagnostics),
      afterValue: 'PENDING_SETUP',
    });
    this.logStudentMailDiagnostics(diagnostics);

    return {
      success: true,
      queued: true,
      status: 'PENDING_SETUP',
      firstTimeSetup: true,
      mailJobId: mailJob.id,
      template: mailJob.emailType ?? mailJob.templateKey,
      provider: mailJob.provider,
      fromEmail: mailJob.fromEmail,
    };
  }

  private async queueStudentResetLink(user: any, actorUserId?: string) {
    const email = this.normalizeEmail(user.email);
    const diagnostics: Record<string, unknown> = {
      event: 'admin.student_password_reset',
      adminUserId: actorUserId ?? null,
      studentId: user.id,
      studentEmail: maskEmail(email),
      actionRequested: 'SEND_RESET_LINK',
      userStatus: user.status,
      tokenCreated: false,
      tokenReused: false,
      mailJobCreated: false,
      mailJobId: null,
      skippedReason: null,
    };

    if (!canSendPasswordRecoveryInstructions(user.status) || isPendingSetupStatus(user.status)) {
      diagnostics.skippedReason = 'not_reset_eligible';
      this.logStudentMailDiagnostics(diagnostics);
      throw new BadRequestException('Password reset emails can only be sent to active students.');
    }

    if (!email) {
      diagnostics.skippedReason = 'missing_email';
      this.logStudentMailDiagnostics(diagnostics);
      throw new BadRequestException('Student does not have an email address.');
    }

    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    diagnostics.tokenCreated = !session.reused;
    diagnostics.tokenReused = session.reused;
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: 'student',
    });

    const mailJob = await this.mailService.queuePasswordReset({
      to: email,
      recipientName: userDisplayName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
      firstTimeSetup: false,
    });
    diagnostics.mailJobCreated = true;
    diagnostics.mailJobId = mailJob.id;

    await this.notificationsService.createInAppNotification(
      user.id,
      'Password reset email queued',
      'A password reset email has been queued for delivery.',
    );

    await this.auditLogs.record({
      actorUserId,
      actorRole: 'ADMIN',
      action: 'SEND_RESET_LINK',
      module: 'Students',
      target: maskEmail(email),
      entityId: user.id,
      result: 'Queued',
      details: JSON.stringify(diagnostics),
    });
    this.logStudentMailDiagnostics(diagnostics);

    return {
      success: true,
      queued: true,
      status: user.status,
      firstTimeSetup: false,
      mailJobId: mailJob.id,
      template: mailJob.emailType ?? mailJob.templateKey,
      provider: mailJob.provider,
      fromEmail: mailJob.fromEmail,
    };
  }

  private async findStudent(id: string) {
    const user = await this.userRepository.findById(id) as any;
    if (!user) {
      throw new NotFoundException('Student not found.');
    }
    if (user.role !== 'STUDENT') {
      throw new NotFoundException('Student not found.');
    }
    return user;
  }

  private normalizeEmail(value?: string | null) {
    return String(value ?? '').trim().toLowerCase();
  }

  private logStudentMailDiagnostics(diagnostics: Record<string, unknown>) {
    this.logger.log(JSON.stringify(diagnostics));
  }
}

function maskEmail(value?: string | null) {
  const email = String(value ?? '').trim().toLowerCase();
  const [local = '', domain = ''] = email.split('@');
  if (!local || !domain) return email ? '[invalid-email]' : '';
  const visible = local.length <= 2 ? `${local[0] ?? ''}*` : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}
