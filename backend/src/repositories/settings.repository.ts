import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SYSTEM_SETTINGS = {
  schoolName: 'PROJTRACK Academy Portal',
  email: 'admin@projtrack.codes',
  notifEmail: 'noreply@projtrack.codes',
  minPassLen: '8',
  maxFailedLogins: '5',
  sessionTimeout: '60',
  allowRegistration: false,
  requireEmailVerification: true,
  twoFactorAdmin: false,
  backupFrequency: 'Daily',
  accountAccessEmailsEnabled: true,
  classroomActivityEmailsEnabled: false,
  classroomActivitySystemNotificationsEnabled: true,
} as const;

function buildDefaultAcademicSettings() {
  const currentYear = new Date().getFullYear();
  return {
    schoolYear: `${currentYear}-${currentYear + 1}`,
    semester: '2nd Semester',
    submissionStart: `${currentYear}-01-15`,
    submissionEnd: `${currentYear}-05-30`,
    latePolicy: '24h',
    lateDeduction: '10',
  } as const;
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSystemSettings(raw: any) {
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(raw ?? {}),
      schoolName: String(raw?.schoolName ?? DEFAULT_SYSTEM_SETTINGS.schoolName),
      email: String(raw?.email ?? DEFAULT_SYSTEM_SETTINGS.email),
      notifEmail: String(raw?.notifEmail ?? DEFAULT_SYSTEM_SETTINGS.notifEmail),
      minPassLen: String(raw?.minPassLen ?? DEFAULT_SYSTEM_SETTINGS.minPassLen),
      maxFailedLogins: String(raw?.maxFailedLogins ?? DEFAULT_SYSTEM_SETTINGS.maxFailedLogins),
      sessionTimeout: String(raw?.sessionTimeout ?? DEFAULT_SYSTEM_SETTINGS.sessionTimeout),
      allowRegistration: Boolean(raw?.allowRegistration ?? DEFAULT_SYSTEM_SETTINGS.allowRegistration),
      requireEmailVerification: Boolean(
        raw?.requireEmailVerification ?? DEFAULT_SYSTEM_SETTINGS.requireEmailVerification,
      ),
      twoFactorAdmin: Boolean(raw?.twoFactorAdmin ?? DEFAULT_SYSTEM_SETTINGS.twoFactorAdmin),
      backupFrequency: String(raw?.backupFrequency ?? DEFAULT_SYSTEM_SETTINGS.backupFrequency),
      accountAccessEmailsEnabled: Boolean(
        raw?.accountAccessEmailsEnabled ?? DEFAULT_SYSTEM_SETTINGS.accountAccessEmailsEnabled,
      ),
      classroomActivityEmailsEnabled: Boolean(
        raw?.classroomActivityEmailsEnabled ??
          DEFAULT_SYSTEM_SETTINGS.classroomActivityEmailsEnabled,
      ),
      classroomActivitySystemNotificationsEnabled: Boolean(
        raw?.classroomActivitySystemNotificationsEnabled ??
          DEFAULT_SYSTEM_SETTINGS.classroomActivitySystemNotificationsEnabled,
      ),
    };
  }

  async getAcademicSettings() {
    const latest = await this.prisma.academicSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
    return {
      ...buildDefaultAcademicSettings(),
      ...(latest ?? {}),
    };
  }

  async saveAcademicSettings(payload: any) {
    const existing = await this.prisma.academicSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
    const normalized = {
      ...buildDefaultAcademicSettings(),
      ...(existing ?? {}),
      ...(payload ?? {}),
    };
    if (existing) {
      return this.prisma.academicSetting.update({
        where: { id: existing.id },
        data: normalized,
      });
    }
    return this.prisma.academicSetting.create({ data: normalized });
  }

  async getSystemSettings() {
    const raw = await this.prisma.systemSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
    return this.normalizeSystemSettings(raw);
  }

  async saveSystemSettings(payload: any) {
    const normalized = this.normalizeSystemSettings(payload);
    const existing = await this.prisma.systemSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (existing) {
      return this.prisma.systemSetting.update({
        where: { id: existing.id },
        data: { ...normalized },
      });
    }
    return this.prisma.systemSetting.create({ data: { ...normalized } });
  }
}
