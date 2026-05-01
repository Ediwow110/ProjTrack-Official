import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { AccountActionTokenService } from '../auth/account-action-token.service';
import { buildActivationLink } from '../common/utils/frontend-links';
import { MailService } from '../mail/mail.service';
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
  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly accountActionTokenService: AccountActionTokenService,
  ) {}

  template() {
    return {
      columns: [
        'student_id',
        'first_name',
        'middle_initial',
        'last_name',
        'email',
        'academic_year',
        'course_code',
        'course_name',
        'year_level',
        'section',
      ],
      sample: {
        student_id: 'STU-2026-00001',
        first_name: 'Juan',
        middle_initial: 'M',
        last_name: 'Dela Cruz',
        email: 'juan.delacruz@example.edu',
        academic_year: '2025-2026',
        course_code: 'BSIT',
        course_name: 'Bachelor of Science in Information Technology',
        year_level: '3rd Year',
        section: 'BSIT 3991',
      },
    };
  }

  async importPreview(body: any) {
    throw new BadRequestException('Import functionality is temporarily unavailable.');
  }

  async confirmImport(body: any) {
    throw new BadRequestException('Import confirmation functionality is temporarily unavailable.');
  }

  async sendSetupInvite(userId: string, adminId?: string) {
    return this.queueStudentSetupInvite(userId, adminId);
  }

  async sendResetLink(userId: string, adminId?: string) {
    return this.adminService.sendStudentResetLink(userId, {
      actorUserId: adminId,
      actorRole: 'ADMIN',
    });
  }

  async activateStudent(userId: string, adminId?: string) {
    return this.adminService.activateStudent(userId, {
      actorUserId: adminId,
      actorRole: 'ADMIN',
    });
  }

  async list(input: { search?: string; status?: string } = {}) {
    return this.adminService.students(input.search, input.status);
  }

  private async queueStudentSetupInvite(userId: string, _adminId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!user || user.role !== 'STUDENT') {
      throw new NotFoundException('Student not found.');
    }

    const normalizedStatus = String(user.status ?? '').trim().toUpperCase();
    if (normalizedStatus !== 'PENDING_SETUP' && normalizedStatus !== 'PENDING_ACTIVATION') {
      throw new BadRequestException('not_pending_setup: Student is not waiting for account setup.');
    }

    const email = String(user.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('missing_email: Student email is required before sending setup invite.');
    }

    const session = await this.accountActionTokenService.issueActivation(user.id);
    const activationUrl = buildActivationLink({
      token: session.token,
      ref: session.publicRef,
      role: 'student',
    });

    const mailJob = await this.mailService.queueStudentSetupInvitation({
      to: email,
      recipientName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email,
      firstName: user.firstName,
      activationUrl,
      publicRef: session.publicRef,
    });
    if (!mailJob?.id) {
      throw new BadRequestException('Activation email could not be confirmed as a queued MailJob.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'PENDING_SETUP' },
    });

    return {
      success: true,
      queued: true,
      status: 'PENDING_SETUP',
      mailJobId: mailJob.id,
    };
  }
}
