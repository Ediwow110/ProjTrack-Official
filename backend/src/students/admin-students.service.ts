import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStudentsDto } from './dto/import-students.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { UserRepository } from '../repositories/user.repository';
import { ImportFileService } from './import-file.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { buildResetPasswordLink } from '../common/utils/frontend-links';
import {
  canSendPasswordRecoveryInstructions,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';
import { userDisplayName } from '../common/utils/user-display-name';

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
  private readonly importBatches = new Map<string, { id: string; fileName?: string; preview: Array<{ index: number; row: any; valid: boolean; issues: string[] }>; createdAt: string }>();

  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly adminOpsRepository: AdminOpsRepository,
    private readonly userRepository: UserRepository,
    private readonly importFileService: ImportFileService,
    private readonly accountActionTokens: AccountActionTokenService,
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

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.importBatches.set(batchId, {
      id: batchId,
      fileName: body.fileName,
      preview,
      createdAt: new Date().toISOString(),
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'IMPORT_PREVIEW',
      module: 'Students',
      target: body.fileName,
      entityId: batchId,
      result: 'Success',
      details: `Previewed ${sourceRows.length} row(s); ${preview.filter((r) => r.valid).length} valid.`,
    });

    return {
      batchId,
      fileName: body.fileName,
      totalRows: sourceRows.length,
      validRows: preview.filter((r) => r.valid).length,
      invalidRows: preview.filter((r) => !r.valid).length,
      preview,
    };
  }

  async confirmImport(body: ConfirmImportDto) {
    const batch = this.importBatches.get(body.batchId);
    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    const acceptedSet = new Set(body.acceptedRowIndexes);
    const rowsToImport = batch.preview.filter((row) => row.valid && acceptedSet.has(row.index));
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
    const invalidRows = batch.preview.filter((row) => !row.valid).length;
    const updatedOrSkipped = batch.preview.filter(
      (row) => row.valid && !acceptedSet.has(row.index),
    ).length;

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

  async activateStudent(id: string) {
    const user = await this.findStudent(id);
    return this.queueStudentSetupLink(user, 'ACTIVATE_STUDENT');
  }

  async sendResetLink(id: string) {
    const user = await this.findStudent(id);
    return this.queueStudentSetupLink(user, 'SEND_RESET_LINK');
  }

  private async queueStudentSetupLink(user: any, action: 'ACTIVATE_STUDENT' | 'SEND_RESET_LINK') {
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

    await this.mailService.queuePasswordReset({
      to: user.email,
      recipientName: userDisplayName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
      firstTimeSetup,
    });

    if (firstTimeSetup) {
      await this.userRepository.updateAuthFields(user.id, {
        status: 'PENDING_SETUP',
        updatedAt: new Date().toISOString(),
      });
    }

    await this.notificationsService.createInAppNotification(
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
      target: user.email,
      entityId: user.id,
      result: 'Queued',
      details: firstTimeSetup
        ? 'Queued first-time password setup email for student account.'
        : 'Queued password reset email for student account.',
      afterValue: firstTimeSetup ? 'PENDING_SETUP' : undefined,
    });

    return {
      success: true,
      resetLink,
      status: firstTimeSetup ? 'PENDING_SETUP' : user.status,
      firstTimeSetup,
    };
  }

  private async findStudent(id: string) {
    const user = await this.userRepository.findById(id) as any;
    if (!user) {
      throw new NotFoundException('Student not found.');
    }
    return user;
  }
}
