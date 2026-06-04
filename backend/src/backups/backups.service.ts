import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BackupStorageService } from './backup-storage.service';

type BackupActor = { actorUserId?: string; actorRole?: string; ipAddress?: string };
type BackupFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
type BackupSettings = {
  enabled: boolean;
  frequency: BackupFrequency;
  timeOfDay: string;
  timezone: string;
  weeklyDay: number;
  monthlyDay: number;
  customIntervalHours: number;
  retentionDays: number;
  retentionCount: number;
};

const BACKUP_WORKER_LOCK_ID = 73042901;
const DEFAULT_SYSTEM_SETTING_ROW = {
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

type BackupSettingsLoadResult =
  | { status: 'loaded'; settings: BackupSettings }
  | { status: 'missing' }
  | { status: 'invalid' };

function serializeRun(run: any, extra: Record<string, unknown> = {}) {
  const merged = { ...run, ...extra };
  return {
    ...merged,
    sizeBytes:
      merged.sizeBytes === null || merged.sizeBytes === undefined
        ? null
        : Number(merged.sizeBytes),
  };
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BackupStorageService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listHistory() {
    const normalization = await this.normalizeLocalArtifacts();
    const rows = await this.prisma.backupRun.findMany({
      where: { deletedAt: null },
      orderBy: [{ startedAt: 'desc' }],
      take: 100,
    });
    const normalizedRows = await Promise.all(rows.map((row) => this.serializeHistoryRun(row)));
    const successful = normalizedRows.filter((row) => row.status === 'COMPLETED');
    const latestSuccessful = successful[0] || null;
    const oldestAvailable = normalizedRows.length ? normalizedRows[normalizedRows.length - 1] : null;
    const settings = await this.getBackupSettings();
    return {
      latestSuccessful,
      oldestAvailable,
      totalBackups: normalizedRows.length,
      failedBackups: rows.filter((row) => row.status === 'FAILED').length,
      storageUsedBytes: normalizedRows.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0),
      nextAutomaticBackup: settings.nextScheduledBackup,
      automaticSettings: settings,
      storageProvider: this.storage.getProvider(),
      storageRoot: this.storage.getRoot(),
      restoreSupported: false,
      restoreUnsupportedReason: this.restoreUnsupportedReason(),
      warnings: normalization.warnings,
      rows: normalizedRows,
    };
  }

  async getBackupSettings() {
    const settings = await this.readBackupSettings();
    const [lastAutomatic, lastAutomaticFailure] = await Promise.all([
      this.prisma.backupRun.findFirst({
        where: { trigger: 'automatic', status: 'COMPLETED', deletedAt: null },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.backupRun.findFirst({
        where: { trigger: 'automatic', status: 'FAILED', deletedAt: null },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    const nextScheduledBackup = this.computeNextScheduledBackup(settings, new Date());
    const workerEnabledByEnv = this.backupWorkerEnabledByEnv();
    return {
      ...settings,
      nextScheduledBackup: settings.enabled ? nextScheduledBackup?.toISOString() ?? null : null,
      lastAutomaticBackupAt:
        lastAutomatic?.completedAt?.toISOString() ?? lastAutomatic?.startedAt?.toISOString() ?? null,
      lastAutomaticFailureReason: lastAutomaticFailure?.error ?? null,
      workerEnabledByEnv,
      workerStatus: workerEnabledByEnv
        ? settings.enabled
          ? 'ready'
          : 'disabled_by_settings'
        : 'disabled_by_environment',
      storageProvider: this.storage.getProvider(),
      storageRoot: this.storage.getRoot(),
    };
  }

  async updateBackupSettings(payload: Partial<BackupSettings>) {
    const current = await this.readBackupSettings();
    const next = this.normalizeBackupSettings({
      ...current,
      ...payload,
    });
    await this.writeBackupSettings(next);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'BACKUP_SETTINGS_UPDATED',
      module: 'Backups',
      target: 'Automatic Backup Settings',
      result: 'Success',
      details: `Automatic backups ${next.enabled ? 'enabled' : 'disabled'}; ${next.frequency} at ${next.timeOfDay} ${next.timezone}.`,
    });
    return this.getBackupSettings();
  }

  async runManual(actor?: BackupActor, backupType = 'full') {
    const run = await this.createBackup({
      trigger: 'manual',
      backupType,
      createdById: actor?.actorUserId,
      actor,
    });
    if (run.status !== 'COMPLETED') {
      throw new InternalServerErrorException(run.error || 'Backup creation failed.');
    }
    return run;
  }

  async createBackup(input: {
    trigger: string;
    backupType: string;
    createdById?: string;
    actor?: BackupActor;
    settings?: BackupSettings;
  }) {
    const run = await this.prisma.backupRun.create({
      data: {
        status: 'RUNNING',
        trigger: input.trigger,
        backupType: input.backupType,
        storage: this.storage.getProvider(),
        createdById: input.createdById,
      },
    });

    let artifact: { absolutePath: string; sizeBytes: number; sha256: string } | null = null;
    let artifactFileName: string | null = null;
    try {
      const data = await this.collectData();
      const recordCounts = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]),
      );
      const dataChecksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const manifest = {
        app: 'ProjTrack',
        backupId: run.id,
        createdAt: new Date().toISOString(),
        backupType: input.backupType,
        appVersion: process.env.npm_package_version || process.env.APP_VERSION || 'unknown',
        schemaVersion: 'prisma',
        recordCounts,
        checksum: dataChecksum,
        storage: this.storage.getProvider(),
      };
      const fileName = `projtrack-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${run.id}.json`;
      artifactFileName = fileName;
      artifact = await this.storage.writeJson(fileName, { manifest, data });
      const completed = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          fileName,
          artifactPath: artifact.absolutePath,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          recordCounts,
          completedAt: new Date(),
          expiresAt: this.expiryForTrigger(input.trigger, new Date(), input.settings),
        },
      });
      await this.auditLogs.record({
        actorUserId: input.actor?.actorUserId,
        actorRole: input.actor?.actorRole || 'ADMIN',
        action: 'BACKUP_RUN',
        module: 'Backups',
        target: fileName,
        entityId: run.id,
        result: 'Success',
        details: `Created ${input.backupType} backup (${artifact.sizeBytes} bytes).`,
        ipAddress: input.actor?.ipAddress,
      });
      return await this.serializeHistoryRun(completed);
    } catch (error) {
      if (artifact?.absolutePath && artifactFileName) {
        try {
          await this.storage.delete(artifactFileName);
        } catch {
          // Keep the original backup failure and avoid masking it with cleanup noise.
        }
      }
      const failureMessage = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown backup failure.';
      const failed = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: failureMessage,
          completedAt: new Date(),
        },
      });
      await this.auditLogs.record({
        actorUserId: input.actor?.actorUserId,
        actorRole: input.actor?.actorRole || 'ADMIN',
        action: 'BACKUP_RUN',
        module: 'Backups',
        target: run.id,
        entityId: run.id,
        result: 'Failed',
        details: failed.error,
        ipAddress: input.actor?.ipAddress,
      });
      return await this.serializeHistoryRun(failed);
    }
  }

  async createAutomaticBackupIfDue() {
    if (!this.backupWorkerEnabledByEnv()) {
      return { ran: false, reason: 'BACKUP_WORKER_ENABLED is false.' };
    }
    const settings = await this.readBackupSettings();
    if (!settings.enabled) {
      return { ran: false, reason: 'Automatic backups are disabled in admin settings.' };
    }

    const due = await this.automaticDueState(settings);
    if (!due.due) {
      return {
        ran: false,
        reason: 'No scheduled backup is due.',
        nextScheduledBackup: due.nextScheduledBackup?.toISOString() ?? null,
      };
    }

    const locked = await this.tryAcquireBackupLock();
    if (!locked) {
      this.logger.warn('Automatic backup skipped because another worker owns the backup lock.');
      return { ran: false, reason: 'Another backup worker is already running.' };
    }

    try {
      const recentRunning = await this.prisma.backupRun.findFirst({
        where: {
          trigger: 'automatic',
          status: 'RUNNING',
          startedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          deletedAt: null,
        },
      });
      if (recentRunning) {
        return { ran: false, reason: 'A recent automatic backup is still running.' };
      }

      this.logger.log(
        `Automatic backup started for scheduled time ${due.scheduledAt?.toISOString() ?? 'custom interval'}.`,
      );
      const backup = await this.createBackup({ trigger: 'automatic', backupType: 'full', settings });
      this.logger.log(
        backup.status === 'COMPLETED'
          ? `Automatic backup completed: ${backup.fileName ?? backup.id}.`
          : `Automatic backup failed: ${backup.error ?? backup.id}.`,
      );
      return {
        ran: true,
        reason: backup.status === 'COMPLETED' ? 'completed' : 'failed',
        backup,
      };
    } finally {
      await this.releaseBackupLock();
    }
  }

  async protect(id: string, protectedValue: boolean, actor?: BackupActor, confirmation?: string) {
    const run = await this.requireRun(id);
    if (!protectedValue && confirmation !== 'UNPROTECT BACKUP') {
      throw new BadRequestException('Type UNPROTECT BACKUP to confirm unprotecting this backup.');
    }
    const updated = await this.prisma.backupRun.update({
      where: { id: run.id },
      data: { isProtected: protectedValue },
    });
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole || 'ADMIN',
      action: protectedValue ? 'BACKUP_PROTECTED' : 'BACKUP_UNPROTECTED',
      module: 'Backups',
      target: run.fileName || run.id,
      entityId: run.id,
      result: 'Success',
      ipAddress: actor?.ipAddress,
    });
    return await this.serializeHistoryRun(updated);
  }

  async delete(id: string, confirmation?: string, actor?: BackupActor) {
    const run = await this.requireRun(id);
    if (confirmation !== 'DELETE BACKUP') {
      throw new BadRequestException('Type DELETE BACKUP to confirm deleting this backup.');
    }
    if (run.status === 'RUNNING') {
      throw new BadRequestException('Running backups cannot be deleted.');
    }
    if (run.isProtected) {
      throw new ForbiddenException('Protected backups cannot be deleted.');
    }
    const latest = await this.latestSuccessful();
    if (latest?.id === run.id) {
      throw new ForbiddenException('The latest successful backup cannot be deleted.');
    }
    const warnings: string[] = [];
    if (run.fileName) {
      const deleted = await this.storage.delete(run.fileName);
      if (deleted.missing) {
        warnings.push('Backup metadata was retired, but the artifact file was already missing from storage.');
      }
    }
    const updated = await this.prisma.backupRun.update({
      where: { id: run.id },
      data: { deletedAt: new Date() },
    });
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole || 'ADMIN',
      action: 'BACKUP_DELETED',
      module: 'Backups',
      target: run.fileName || run.id,
      entityId: run.id,
      result: 'Success',
      ipAddress: actor?.ipAddress,
    });
    return await this.serializeHistoryRun(updated, { warnings });
  }

  async validate(id: string) {
    const run = await this.requireRun(id);
    if (!run.fileName || !run.sha256) {
      throw new BadRequestException('Backup does not have an artifact to validate.');
    }
    const actual = await this.storage.checksum(run.fileName);
    return {
      success: actual === run.sha256,
      backupId: run.id,
      expectedSha256: run.sha256,
      actualSha256: actual,
    };
  }

  async details(id: string) {
    const run = await this.requireRun(id);
    const row = await this.serializeHistoryRun(run);
    let manifest: unknown = null;
    if (row.artifactAvailable && run.fileName) {
      try {
        const data = await this.storage.readJson(run.fileName);
        manifest = (data as any)?.manifest ?? null;
      } catch {
        // File may have been deleted between the describe check and this read.
      }
    }
    return {
      ...row,
      manifest,
      restoreSupported: false,
      restoreUnsupportedReason: this.restoreUnsupportedReason(),
    };
  }

  async manifest(id: string) {
    const run = await this.requireRun(id);
    if (!run.fileName) throw new NotFoundException('Backup artifact not found.');
    const payload = await this.storage.readJson(run.fileName);
    return (payload as any)?.manifest || null;
  }

  async restore(id: string, confirmation?: string, actor?: BackupActor) {
    const run = await this.requireRun(id);
    if (confirmation !== 'RESTORE BACKUP') {
      throw new BadRequestException('Type RESTORE BACKUP to confirm restore.');
    }
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole || 'ADMIN',
      action: 'BACKUP_RESTORE_ATTEMPT',
      module: 'Backups',
      target: run.fileName || run.id,
      entityId: run.id,
      result: 'Failed',
      details: this.restoreUnsupportedReason(),
      ipAddress: actor?.ipAddress,
    });
    throw new ConflictException(this.restoreUnsupportedReason());
  }

  async download(id: string) {
    const run = await this.requireRun(id);
    if (!run.fileName) throw new NotFoundException('Backup artifact not found.');
    const description = await this.storage.describe(run.fileName);
    if (!description.available || !description.absolutePath) {
      throw new NotFoundException(description.warning || 'Backup artifact not found.');
    }
    return {
      absolutePath: description.absolutePath,
      fileName: run.fileName,
    };
  }

  private async collectData() {
    const [
      users,
      studentProfiles,
      teacherProfiles,
      academicYears,
      academicYearLevels,
      sections,
      subjects,
      subjectSections,
      enrollments,
      tasks,
      groups,
      groupMembers,
      submissions,
      submissionFiles,
      submissionEvents,
      notifications,
      emailJobs,
      settings,
    ] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.studentProfile.findMany(),
      this.prisma.teacherProfile.findMany(),
      this.prisma.academicYear.findMany(),
      this.prisma.academicYearLevel.findMany(),
      this.prisma.section.findMany(),
      this.prisma.subject.findMany(),
      this.prisma.subjectSection.findMany(),
      this.prisma.enrollment.findMany(),
      this.prisma.submissionTask.findMany(),
      this.prisma.group.findMany(),
      this.prisma.groupMember.findMany(),
      this.prisma.submission.findMany(),
      this.prisma.submissionFile.findMany(),
      this.prisma.submissionEvent.findMany(),
      this.prisma.notification.findMany(),
      this.prisma.emailJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
      this.prisma.systemSetting.findMany(),
    ]);

    return {
      users,
      studentProfiles,
      teacherProfiles,
      academicYears,
      academicYearLevels,
      sections,
      subjects,
      subjectSections,
      enrollments,
      tasks,
      groups,
      groupMembers,
      submissions,
      submissionFiles,
      submissionEvents,
      notifications,
      emailJobs,
      settings,
    };
  }

  private async requireRun(id: string) {
    const run = await this.prisma.backupRun.findUnique({ where: { id } });
    if (!run || run.deletedAt) {
      throw new NotFoundException('Backup run not found.');
    }
    return run;
  }

  private async serializeHistoryRun(run: any, extra: Record<string, unknown> = {}) {
    const artifact = await this.storage.describe(run.fileName);
    const sizeBytes =
      artifact.available && artifact.sizeBytes !== null
        ? artifact.sizeBytes
        : run.sizeBytes === null || run.sizeBytes === undefined
          ? null
          : Number(run.sizeBytes);
    const warnings = [
      ...(run.error ? [String(run.error)] : []),
      ...(artifact.warning ? [artifact.warning] : []),
      ...((extra.warnings as string[] | undefined) || []),
    ];
    return serializeRun(run, {
      artifactAvailable: artifact.available,
      artifactPath: artifact.absolutePath || run.artifactPath || null,
      storageRoot: artifact.storageRoot,
      storageProvider: artifact.provider,
      sizeBytes,
      warnings: warnings.length ? warnings : [],
      ...extra,
    });
  }

  private latestSuccessful() {
    return this.prisma.backupRun.findFirst({
      where: { status: 'COMPLETED', deletedAt: null },
      orderBy: { completedAt: 'desc' },
    });
  }

  private expiryForTrigger(trigger: string, baseDate = new Date(), settings?: BackupSettings) {
    const days = trigger === 'manual'
      ? Number(process.env.BACKUP_MANUAL_RETENTION_DAYS || 90)
      : Number((settings || this.safeDefaultBackupSettings()).retentionDays || process.env.BACKUP_AUTO_RETENTION_DAYS || 30);
    return new Date(baseDate.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000);
  }

  private async normalizeLocalArtifacts() {
    const warnings: string[] = [];
    let artifacts: Array<{ fileName: string; absolutePath: string; sizeBytes: number; modifiedAt: Date }> = [];
    try {
      artifacts = await this.storage.listJsonArtifacts();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unable to inspect backup storage.';
      this.logger.warn(`Backup artifact normalization skipped: ${reason}`);
      return { warnings: [reason] };
    }

    if (!artifacts.length) {
      return { warnings };
    }

    const knownFileNames = new Set(
      (
        await this.prisma.backupRun.findMany({
          where: { fileName: { in: artifacts.map((artifact) => artifact.fileName) } },
          select: { fileName: true },
        })
      )
        .map((row) => row.fileName)
        .filter(Boolean) as string[],
    );

    for (const artifact of artifacts) {
      if (knownFileNames.has(artifact.fileName)) continue;
      let parsed: any;
      let sha256 = '';
      try {
        const content = this.storage.readText(artifact.fileName);
        parsed = JSON.parse(content);
        sha256 = createHash('sha256').update(content).digest('hex');
      } catch (error) {
        const warning = `Skipped malformed backup artifact ${artifact.fileName}.`;
        warnings.push(warning);
        this.logger.warn(`${warning} ${error instanceof Error ? error.message : ''}`.trim());
        continue;
      }

      const metadata = this.metadataFromArtifact(artifact, parsed, sha256);
      try {
        const existingId = await this.prisma.backupRun.findUnique({ where: { id: metadata.id } });
        await this.prisma.backupRun.create({
          data: {
            ...metadata,
            id: existingId ? `legacy-${sha256.slice(0, 24)}` : metadata.id,
          },
        });
        knownFileNames.add(artifact.fileName);
        this.logger.log(`Backfilled backup metadata from local artifact ${artifact.fileName}.`);
      } catch (error) {
        const warning = `Backup artifact ${artifact.fileName} could not be backfilled.`;
        warnings.push(warning);
        this.logger.warn(`${warning} ${error instanceof Error ? error.message : ''}`.trim());
      }
    }

    return { warnings };
  }

  private metadataFromArtifact(
    artifact: { fileName: string; absolutePath: string; sizeBytes: number; modifiedAt: Date },
    parsed: any,
    sha256: string,
  ) {
    const manifest = parsed && typeof parsed === 'object' && parsed.manifest && typeof parsed.manifest === 'object'
      ? parsed.manifest
      : {};
    const dataRoot = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    const recordCounts =
      manifest.recordCounts && typeof manifest.recordCounts === 'object'
        ? manifest.recordCounts
        : Object.fromEntries(
            Object.entries(dataRoot && typeof dataRoot === 'object' ? dataRoot : {})
              .filter(([, value]) => Array.isArray(value))
              .map(([key, value]) => [key, (value as unknown[]).length]),
          );
    const createdAt = this.parseDate(manifest.createdAt) ?? this.parseDateFromFileName(artifact.fileName) ?? artifact.modifiedAt;
    const manifestId = this.safeBackupId(manifest.backupId);
    const trigger = ['manual', 'automatic'].includes(String(manifest.trigger ?? '').toLowerCase())
      ? String(manifest.trigger).toLowerCase()
      : /automatic|auto/i.test(artifact.fileName)
        ? 'automatic'
        : 'manual';
    return {
      id: manifestId ?? `legacy-${sha256.slice(0, 24)}`,
      status: 'COMPLETED',
      trigger,
      backupType: String(manifest.backupType || manifest.type || 'full').toLowerCase(),
      fileName: artifact.fileName,
      artifactPath: artifact.absolutePath,
      storage: String(manifest.storage || this.storage.getProvider()),
      sizeBytes: artifact.sizeBytes,
      sha256,
      recordCounts,
      completedAt: createdAt,
      startedAt: createdAt,
      expiresAt: this.expiryForTrigger(trigger, createdAt),
      notes: 'Backfilled from existing local backup artifact.',
    };
  }

  private async readBackupSettings(): Promise<BackupSettings> {
    const dbResult = await this.readBackupSettingsFromDb();
    if (dbResult.status === 'loaded') {
      return dbResult.settings;
    }
    if (dbResult.status === 'invalid') {
      return this.safeDefaultBackupSettings();
    }

    const legacyResult = this.readLegacyBackupSettingsFile();
    if (legacyResult.status === 'loaded') {
      await this.persistBackupSettingsToDb(legacyResult.settings);
      return legacyResult.settings;
    }

    return this.safeDefaultBackupSettings();
  }

  private async writeBackupSettings(settings: BackupSettings) {
    await this.persistBackupSettingsToDb(settings);
  }

  private backupSettingsPath() {
    return resolve(this.storage.getRoot(), '..', 'backup-settings.json');
  }

  private async readBackupSettingsFromDb(): Promise<BackupSettingsLoadResult> {
    const row = await this.prisma.systemSetting.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { backupSettingsJson: true },
    });
    if (!row || row.backupSettingsJson === null || row.backupSettingsJson === undefined) {
      return { status: 'missing' };
    }
    if (!this.isPlainObject(row.backupSettingsJson)) {
      this.logger.error('Backup settings JSON in the database is malformed; safe defaults will be used.');
      return { status: 'invalid' };
    }
    return {
      status: 'loaded',
      settings: this.normalizeBackupSettings(row.backupSettingsJson),
    };
  }

  private readLegacyBackupSettingsFile(): BackupSettingsLoadResult {
    try {
      const file = this.backupSettingsPath();
      if (!existsSync(file)) {
        return { status: 'missing' };
      }
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      if (!this.isPlainObject(parsed)) {
        this.logger.warn('Legacy backup-settings.json is malformed; safe defaults will be used.');
        return { status: 'invalid' };
      }
      return {
        status: 'loaded',
        settings: this.normalizeBackupSettings(parsed),
      };
    } catch (error) {
      this.logger.warn(
        `Legacy backup-settings.json could not be read; safe defaults will be used. ${error instanceof Error ? error.message : ''}`.trim(),
      );
      return { status: 'invalid' };
    }
  }

  private async persistBackupSettingsToDb(settings: BackupSettings) {
    const row = await this.prisma.systemSetting.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (row) {
      await this.prisma.systemSetting.update({
        where: { id: row.id },
        data: { backupSettingsJson: settings },
      });
      return;
    }

    await this.prisma.systemSetting.create({
      data: {
        ...DEFAULT_SYSTEM_SETTING_ROW,
        backupSettingsJson: settings,
      },
    });
  }

  private normalizeBackupSettings(value: any): BackupSettings {
    const frequency = String(value.frequency || process.env.BACKUP_DEFAULT_FREQUENCY || 'daily').toLowerCase();
    const normalizedFrequency: BackupFrequency =
      frequency === 'weekly' || frequency === 'monthly' || frequency === 'custom' ? frequency : 'daily';
    const rawTime = String(value.timeOfDay || value.time || process.env.BACKUP_DEFAULT_TIME || '02:00').trim();
    const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : '02:00';
    return {
      enabled: this.booleanValue(value.enabled ?? false),
      frequency: normalizedFrequency,
      timeOfDay,
      timezone: String(value.timezone || process.env.BACKUP_TIMEZONE || 'Asia/Manila').trim() || 'Asia/Manila',
      weeklyDay: this.clampInteger(value.weeklyDay ?? value.dayOfWeek ?? 1, 0, 6),
      monthlyDay: this.clampInteger(value.monthlyDay ?? value.dayOfMonth ?? 1, 1, 31),
      customIntervalHours: this.clampInteger(value.customIntervalHours ?? process.env.BACKUP_INTERVAL_HOURS ?? 24, 1, 24 * 31),
      retentionDays: this.clampInteger(value.retentionDays ?? process.env.BACKUP_RETENTION_DAYS ?? 30, 1, 3650),
      retentionCount: this.clampInteger(value.retentionCount ?? process.env.BACKUP_RETENTION_COUNT ?? 10, 1, 1000),
    };
  }

  private async automaticDueState(settings: BackupSettings) {
    const lastRun = await this.prisma.backupRun.findFirst({
      where: { trigger: 'automatic', deletedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    const now = new Date();
    if (settings.frequency === 'custom') {
      const intervalMs = settings.customIntervalHours * 60 * 60 * 1000;
      if (!lastRun) return { due: true, scheduledAt: now, nextScheduledBackup: now };
      const next = new Date(lastRun.startedAt.getTime() + intervalMs);
      return { due: next.getTime() <= now.getTime(), scheduledAt: next, nextScheduledBackup: next };
    }

    const scheduledAt = this.latestScheduledOccurrence(settings, now);
    const nextScheduledBackup = this.computeNextScheduledBackup(settings, now);
    return {
      due: Boolean(scheduledAt && (!lastRun || lastRun.startedAt.getTime() < scheduledAt.getTime())),
      scheduledAt,
      nextScheduledBackup,
    };
  }

  private latestScheduledOccurrence(settings: BackupSettings, now: Date) {
    const next = this.computeNextScheduledBackup(settings, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    if (next && next.getTime() <= now.getTime()) return next;
    if (settings.frequency === 'daily') {
      return this.shiftZonedDays(next ?? now, settings.timezone, -1, settings);
    }
    if (settings.frequency === 'weekly') {
      return this.shiftZonedDays(next ?? now, settings.timezone, -7, settings);
    }
    if (settings.frequency === 'monthly') {
      return this.shiftZonedMonths(next ?? now, settings.timezone, -1, settings);
    }
    return null;
  }

  private computeNextScheduledBackup(settings: BackupSettings, from: Date) {
    const [hour, minute] = settings.timeOfDay.split(':').map((part) => Number(part));
    const parts = this.zonedParts(from, settings.timezone);
    if (settings.frequency === 'custom') {
      return new Date(from.getTime() + settings.customIntervalHours * 60 * 60 * 1000);
    }
    if (settings.frequency === 'daily') {
      let candidate = this.zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, settings.timezone);
      if (candidate.getTime() <= from.getTime()) {
        candidate = this.zonedTimeToUtc(parts.year, parts.month, parts.day + 1, hour, minute, settings.timezone);
      }
      return candidate;
    }
    if (settings.frequency === 'weekly') {
      const currentDow = parts.weekday;
      let delta = (settings.weeklyDay - currentDow + 7) % 7;
      let candidate = this.zonedTimeToUtc(parts.year, parts.month, parts.day + delta, hour, minute, settings.timezone);
      if (candidate.getTime() <= from.getTime()) {
        delta += 7;
        candidate = this.zonedTimeToUtc(parts.year, parts.month, parts.day + delta, hour, minute, settings.timezone);
      }
      return candidate;
    }
    const monthlyDay = Math.min(settings.monthlyDay, this.daysInMonth(parts.year, parts.month));
    let candidate = this.zonedTimeToUtc(parts.year, parts.month, monthlyDay, hour, minute, settings.timezone);
    if (candidate.getTime() <= from.getTime()) {
      const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
      const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
      candidate = this.zonedTimeToUtc(
        nextYear,
        nextMonth,
        Math.min(settings.monthlyDay, this.daysInMonth(nextYear, nextMonth)),
        hour,
        minute,
        settings.timezone,
      );
    }
    return candidate;
  }

  private shiftZonedDays(base: Date, timezone: string, days: number, settings: BackupSettings) {
    const parts = this.zonedParts(base, timezone);
    const [hour, minute] = settings.timeOfDay.split(':').map((part) => Number(part));
    return this.zonedTimeToUtc(parts.year, parts.month, parts.day + days, hour, minute, timezone);
  }

  private shiftZonedMonths(base: Date, timezone: string, months: number, settings: BackupSettings) {
    const parts = this.zonedParts(base, timezone);
    const [hour, minute] = settings.timeOfDay.split(':').map((part) => Number(part));
    const targetMonthIndex = parts.month - 1 + months;
    const targetYear = parts.year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
    return this.zonedTimeToUtc(
      targetYear,
      targetMonth,
      Math.min(settings.monthlyDay, this.daysInMonth(targetYear, targetMonth)),
      hour,
      minute,
      timezone,
    );
  }

  private zonedParts(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
      weekday: 'short',
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
      weekday: weekdays[parts.weekday] ?? date.getUTCDay(),
    };
  }

  private zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
    let utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    for (let index = 0; index < 2; index += 1) {
      const offset = this.timeZoneOffsetMs(timezone, new Date(utc));
      utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offset;
    }
    return new Date(utc);
  }

  private timeZoneOffsetMs(timezone: string, date: Date) {
    const parts = this.zonedParts(date, timezone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
    return asUtc - date.getTime();
  }

  private daysInMonth(year: number, month: number) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  private parseDate(value: unknown) {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseDateFromFileName(fileName: string) {
    const match = fileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?Z)/);
    if (!match) return null;
    return this.parseDate(match[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z/,
      (_all, hh, mm, ss, ms) => `T${hh}:${mm}:${ss}.${ms || '000'}Z`,
    ));
  }

  private safeBackupId(value: unknown) {
    const normalized = String(value ?? '').trim();
    return /^[a-zA-Z0-9_-]{8,80}$/.test(normalized) ? normalized : null;
  }

  private booleanValue(value: unknown) {
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
  }

  private clampInteger(value: unknown, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private safeDefaultBackupSettings(): BackupSettings {
    return {
      ...this.normalizeBackupSettings({}),
      enabled: false,
    };
  }

  private backupWorkerEnabledByEnv() {
    return String(process.env.BACKUP_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  private async tryAcquireBackupLock() {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(${BACKUP_WORKER_LOCK_ID}) AS locked
      `;
      return Boolean(rows[0]?.locked);
    } catch (error) {
      this.logger.warn(`Could not acquire PostgreSQL backup advisory lock; using in-process guard only. ${error instanceof Error ? error.message : ''}`.trim());
      return true;
    }
  }

  private async releaseBackupLock() {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${BACKUP_WORKER_LOCK_ID})
      `;
    } catch {
      // Advisory lock release is best-effort; the database releases it when the connection closes.
    }
  }

  private restoreUnsupportedReason() {
    return 'Automated restore is intentionally disabled on this deployment. Use a verified database snapshot or pg_dump together with the downloaded backup artifact before destructive recovery work.';
  }
}
