import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly authSessions: AuthSessionService,
    private readonly files: FilesService,
  ) {}

  async studentProfile(userId?: string) {
    const user = await this.requireUser(userId, 'Student profile not found.');
    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);
    const submissions = await this.prisma.submission.count({
      where: {
        OR: [
          { studentId: user.id },
          { group: { members: { some: { studentId: user.id } } } },
        ],
      },
    });
    const studentProfile = user.studentProfile;
    const sectionName = studentProfile?.section?.name ?? '—';

    return {
      initials: `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase(),
      fullName: `${user.firstName} ${user.lastName}`,
      roleLabel: 'Student Portal',
      avatarRelativePath,
      summary: [
        { label: 'Student ID', value: studentProfile?.studentNumber ?? '—' },
        { label: 'Section', value: sectionName },
        { label: 'Course', value: studentProfile?.course ?? '—' },
        { label: 'Submissions', value: String(submissions), tone: 'blue' },
      ],
      form: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        avatarRelativePath,
      },
    };
  }

  async teacherProfile(userId?: string) {
    const user = await this.requireUser(userId, 'Teacher profile not found.');
    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);
    const teacherProfile = user.teacherProfile;
    const handled = await this.prisma.subject.findMany({
      where: { teacherId: teacherProfile?.id },
      include: {
        enrollments: { include: { section: true } },
      },
    });
    const sections = Array.from(
      new Set(
        handled.flatMap((subject) =>
          subject.enrollments.map((enrollment) => enrollment.section?.name).filter(Boolean) as string[],
        ),
      ),
    );

    return {
      initials: `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase(),
      fullName: `${user.firstName} ${user.lastName}`,
      roleLabel: 'Teacher Portal',
      avatarRelativePath,
      summary: [
        { label: 'Employee ID', value: teacherProfile?.employeeId ?? '—' },
        { label: 'Subjects', value: String(handled.length), tone: 'blue' },
        { label: 'Sections', value: sections.join(', ') || '—' },
        { label: 'Status', value: user.status, tone: 'teal' },
      ],
      form: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        office: user.office || teacherProfile?.department || 'Computing Department',
        avatarRelativePath,
      },
    };
  }

  async adminProfile(userId?: string) {
    const user = await this.requireUser(userId, 'Admin profile not found.');
    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);
    return {
      initials: `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase(),
      fullName: `${user.firstName} ${user.lastName}`,
      roleLabel: 'Admin Portal',
      avatarRelativePath,
      summary: [
        { label: 'Role', value: 'System Administrator' },
        { label: 'Email', value: user.email },
        { label: 'Status', value: user.status, tone: 'emerald' },
      ],
      form: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        office: user.office || 'Main Office',
        avatarRelativePath,
      },
    };
  }

  async updateStudentProfile(userId: string | undefined, body: any) {
    return this.updateProfile(userId, body, 'student');
  }

  async updateTeacherProfile(userId: string | undefined, body: any) {
    return this.updateProfile(userId, body, 'teacher');
  }

  async updateAdminProfile(userId: string | undefined, body: any) {
    return this.updateProfile(userId, body, 'admin');
  }

  async changePassword(userId: string, body: { currentPassword: string; newPassword: string }) {
    const user = await this.requireUser(userId, 'Profile not found.');
    if (!body?.currentPassword || !body?.newPassword) {
      throw new BadRequestException('Current password and new password are required.');
    }
    if (!this.passwords.compare(body.currentPassword, user.passwordHash)) {
      throw new BadRequestException('Current password is incorrect.');
    }
    if (body.currentPassword === body.newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }
    this.passwords.assertStrongPassword(body.newPassword, 'New password');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: this.passwords.hash(body.newPassword) },
    });
    await this.authSessions.revokeAllForUser(user.id);

    return { success: true };
  }

  private async updateProfile(userId: string | undefined, body: any, role: 'student' | 'teacher' | 'admin') {
    const user = await this.requireUser(userId, 'Profile not found.');
    const firstName = String(body?.firstName ?? user.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? user.lastName ?? '').trim();
    const email = String(body?.email ?? user.email ?? '').trim().toLowerCase();
    const phone = String(body?.phone ?? user.phone ?? '').trim();
    const office = String(body?.office ?? user.office ?? '').trim();
    const avatarRelativePath = String(body?.avatarRelativePath ?? user.avatarRelativePath ?? '').trim();

    if (!firstName || !lastName || !email) {
      throw new BadRequestException('First name, last name, and email are required.');
    }
    if (avatarRelativePath && !/^[a-zA-Z0-9/_\-.]+$/.test(avatarRelativePath)) {
      throw new BadRequestException('Avatar path is invalid.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        office: office || null,
        avatarRelativePath: avatarRelativePath || null,
      },
    });

    if (role === 'student') return this.studentProfile(userId);
    if (role === 'teacher') return this.teacherProfile(userId);
    return this.adminProfile(userId);
  }

  private async requireUser(userId: string | undefined, notFoundMessage: string) {
    if (!userId) throw new NotFoundException('Authenticated user not found.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: { include: { section: true } },
        teacherProfile: true,
      },
    });
    if (!user) throw new NotFoundException(notFoundMessage);
    return user;
  }

  private async resolveAvatarRelativePath(relativePath?: string | null) {
    const candidate = String(relativePath || '').trim();
    if (!candidate) return '';
    return (await this.files.hasObject(candidate)) ? candidate : '';
  }
}
