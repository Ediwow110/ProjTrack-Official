import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getStorageSummary } from '../files/storage.config';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

const TOOL_META: Record<string, { btn: string; tone: string; danger: boolean }> = {
  backup: { btn: 'Run Backup', tone: 'blue', danger: false },
  restore: { btn: 'Restore Backup', tone: 'amber', danger: true },
  cache: { btn: 'Clear Cache', tone: 'teal', danger: false },
  purge: { btn: 'Purge Records', tone: 'rose', danger: true },
  diag: { btn: 'Run Diagnostics', tone: 'indigo', danger: false },
  export: { btn: 'Export Data', tone: 'slate', danger: false },
};

const DEFAULT_SYSTEM_TOOLS = [
  {
    key: 'backup',
    title: 'Backup Data',
    desc: 'Generate a snapshot package of operational data for safekeeping.',
    status: 'Ready',
  },
  {
    key: 'restore',
    title: 'Restore from Backup',
    desc: 'Validate the newest backup package and prepare it for controlled restore work.',
    status: 'Ready',
  },
  {
    key: 'cache',
    title: 'Clear Cache',
    desc: 'Remove generated cache artifacts and write a cache-clear marker.',
    status: 'Ready',
  },
  {
    key: 'purge',
    title: 'Purge Records',
    desc: 'Review retention-oriented cleanup actions for old operational artifacts.',
    status: 'Ready',
  },
  {
    key: 'diag',
    title: 'Run Diagnostics',
    desc: 'Collect a diagnostic snapshot of database, storage, and mail health.',
    status: 'Ready',
  },
  {
    key: 'export',
    title: 'Export Data',
    desc: 'Create an export package of the current operational state.',
    status: 'Ready',
  },
] as const;

type ToolResult = {
  toolId: string;
  title: string;
  status: string;
  summary: string;
  details: string[];
  artifactPath?: string;
  ranAt: string;
};

@Injectable()
export class SystemToolsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toolsRoot() {
    return join(process.cwd(), 'data', 'system-tools');
  }

  private projectRoot() {
    return process.cwd();
  }

  private ensureDir(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private formatRunLabel(value?: string | Date | null) {
    if (!value) return 'Never';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private normalizeToolStatus(status?: string | null) {
    if (!status) return 'Ready';
    const normalized = String(status).toLowerCase();
    if (normalized === 'idle' || normalized === 'ready') return 'Ready';
    if (normalized.includes('review') || normalized.includes('restricted') || normalized.includes('protected')) return 'Completed with review';
    if (normalized.includes('complete') || normalized.includes('success')) return 'Completed';
    if (normalized.includes('fail') || normalized.includes('error')) return 'Failed';
    return status;
  }

  private isProductionRestrictedTool(id: string) {
    const allowUnsafe = String(process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS ?? 'false').toLowerCase() === 'true';
    const isProduction = String(process.env.NODE_ENV ?? 'development').toLowerCase() === 'production';
    return isProduction && !allowUnsafe && ['backup', 'restore', 'purge', 'diag', 'export'].includes(id);
  }

  private mapSystemToolRecord(raw: any) {
    const id = String(raw?.key ?? raw?.id ?? 'tool');
    const meta = TOOL_META[id] ?? { btn: 'Run', tone: 'slate', danger: false };
    return {
      id,
      key: id,
      title: raw?.title ?? id,
      desc: raw?.desc ?? 'Administrative system action.',
      btn: meta.btn,
      danger: meta.danger,
      tone: meta.tone,
      status: this.normalizeToolStatus(raw?.status),
      lastRun: this.formatRunLabel(raw?.lastRunAt),
      lastRunAt: raw?.lastRunAt ? new Date(raw.lastRunAt).toISOString() : undefined,
    };
  }

  private async getStateSnapshot() {
    const [
      users,
      subjects,
      activities,
      submissions,
      groups,
      notifications,
      emailJobs,
      auditLogs,
      announcements,
      requests,
      academicSettings,
      systemSettings,
      systemTools,
      sections,
    ] = await Promise.all([
      this.prisma.user.findMany({ include: { studentProfile: true, teacherProfile: true } }),
      this.prisma.subject.findMany(),
      this.prisma.submissionTask.findMany(),
      this.prisma.submission.findMany({ include: { files: true } }),
      this.prisma.group.findMany({ include: { members: true } }),
      this.prisma.notification.findMany(),
      this.prisma.emailJob.findMany(),
      this.prisma.auditLog.findMany(),
      this.prisma.announcement.findMany(),
      this.prisma.request.findMany(),
      this.prisma.academicSetting.findMany(),
      this.prisma.systemSetting.findMany(),
      this.prisma.systemTool.findMany(),
      this.prisma.section.findMany({ include: { students: true } }),
    ]);

    return {
      mode: 'prisma',
      exportedAt: new Date().toISOString(),
      users,
      subjects,
      activities,
      submissions,
      groups,
      notifications,
      emailJobs,
      auditLogs,
      announcements,
      requests,
      academicSettings,
      systemSettings,
      systemTools,
      sections,
    };
  }

  private async executeSystemTool(id: string): Promise<ToolResult> {
    const ranAt = new Date().toISOString();
    const root = this.toolsRoot();
    const backupsDir = join(root, 'backups');
    const exportsDir = join(root, 'exports');
    const diagnosticsDir = join(root, 'diagnostics');
    const cacheDir = join(root, 'cache');
    this.ensureDir(root);
    this.ensureDir(backupsDir);
    this.ensureDir(exportsDir);
    this.ensureDir(diagnosticsDir);
    this.ensureDir(cacheDir);

    if (id === 'backup') {
      const snapshot = await this.getStateSnapshot();
      const fileName = `backup-${ranAt.replace(/[:.]/g, '-')}.json`;
      writeFileSync(join(backupsDir, fileName), JSON.stringify(snapshot, null, 2), 'utf8');
      return {
        toolId: id,
        title: 'Backup Database',
        status: 'Completed',
        summary: 'Backup completed successfully.',
        details: [
          `Users: ${snapshot.users.length}`,
          `Subjects: ${snapshot.subjects.length}`,
          `Activities: ${snapshot.activities.length}`,
          `Submissions: ${snapshot.submissions.length}`,
          `Groups: ${snapshot.groups.length}`,
        ],
        artifactPath: `data/system-tools/backups/${fileName}`,
        ranAt,
      };
    }

    if (id === 'restore') {
      const backupFiles = readdirSync(backupsDir).filter((name) => name.endsWith('.json')).sort().reverse();
      if (backupFiles.length === 0) {
        throw new NotFoundException('No backup file is available to restore.');
      }
      return {
        toolId: id,
        title: 'Restore from Backup',
        status: 'Completed with review',
        summary: 'Latest backup package located. Manual PostgreSQL restore is still required.',
        details: [
          `Latest backup: ${backupFiles[0]}`,
          'Automated restore is intentionally disabled to avoid unsafe partial writes.',
          'Use the generated backup package with the production database restore runbook.',
        ],
        artifactPath: `data/system-tools/backups/${backupFiles[0]}`,
        ranAt,
      };
    }

    if (id === 'cache') {
      let removed = 0;
      if (existsSync(cacheDir)) {
        for (const entry of readdirSync(cacheDir)) {
          rmSync(join(cacheDir, entry), { recursive: true, force: true });
          removed += 1;
        }
      }
      const marker = join(cacheDir, 'last-clear.json');
      writeFileSync(marker, JSON.stringify({ clearedAt: ranAt }, null, 2), 'utf8');
      return {
        toolId: id,
        title: 'Clear Cache',
        status: 'Completed',
        summary: 'Cached backend artifacts were cleared.',
        details: ['Removed entries: ' + removed, 'A cache-clear marker was written for auditability.'],
        artifactPath: 'data/system-tools/cache/last-clear.json',
        ranAt,
      };
    }

    if (id === 'purge') {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      const [auditResult, mailResult] = await Promise.all([
        this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        this.prisma.emailJob.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      ]);
      return {
        toolId: id,
        title: 'Purge Records',
        status: 'Completed with review',
        summary: 'Old operational records were purged.',
        details: [
          `Audit logs removed: ${auditResult.count}`,
          `Mail jobs removed: ${mailResult.count}`,
          `Cutoff: ${cutoff.toISOString()}`,
        ],
        ranAt,
      };
    }

    if (id === 'diag') {
      const storage = getStorageSummary();
      const diagnostics = {
        ranAt,
        persistenceMode: 'prisma',
        storage,
        nodeVersion: process.version,
        platform: process.platform,
      };
      const fileName = `diagnostics-${ranAt.replace(/[:.]/g, '-')}.json`;
      writeFileSync(join(diagnosticsDir, fileName), JSON.stringify(diagnostics, null, 2), 'utf8');
      return {
        toolId: id,
        title: 'Run Diagnostics',
        status: 'Completed',
        summary: 'System diagnostics completed.',
        details: [
          `Storage mode: ${storage.mode}`,
          `Storage bucket: ${storage.bucket || 'n/a'}`,
          `Storage region: ${storage.region || 'n/a'}`,
          `Node version: ${process.version}`,
        ],
        artifactPath: `data/system-tools/diagnostics/${fileName}`,
        ranAt,
      };
    }

    if (id === 'export') {
      const snapshot = await this.getStateSnapshot();
      const fileName = `export-${ranAt.replace(/[:.]/g, '-')}.json`;
      writeFileSync(join(exportsDir, fileName), JSON.stringify(snapshot, null, 2), 'utf8');
      return {
        toolId: id,
        title: 'Export Data',
        status: 'Completed',
        summary: 'Export package generated successfully.',
        details: [
          `Users: ${snapshot.users.length}`,
          `Submissions: ${snapshot.submissions.length}`,
          `Notifications: ${snapshot.notifications.length}`,
        ],
        artifactPath: `data/system-tools/exports/${fileName}`,
        ranAt,
      };
    }

    throw new NotFoundException('System tool not found.');
  }

  private async ensureDefaultSystemTools() {
    for (const tool of DEFAULT_SYSTEM_TOOLS) {
      const existing = await this.prisma.systemTool.findFirst({
        where: {
          key: {
            equals: tool.key,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.systemTool.create({
        data: {
          key: tool.key,
          title: tool.title,
          desc: tool.desc,
          status: tool.status,
        },
      });
    }
  }

  async getSystemTools() {
    await this.ensureDefaultSystemTools();
    const raw = await this.prisma.systemTool.findMany({ orderBy: { key: 'asc' } });
    return raw.map((item) => this.mapSystemToolRecord(item));
  }

  async runSystemTool(id: string) {
    await this.ensureDefaultSystemTools();
    const raw = await this.prisma.systemTool.findMany({ orderBy: { key: 'asc' } });
    const current = raw.find((item) => item.id === id || item.key === id);
    if (!current) throw new NotFoundException('System tool not found.');

    const toolId = String(current.key ?? current.id);
    const result = this.isProductionRestrictedTool(toolId)
      ? {
          toolId,
          title: current.title ?? toolId,
          status: 'Restricted in production',
          summary: 'This tool is disabled in production because it relies on local artifacts or destructive maintenance operations.',
          details: [
            'Use audited infrastructure-native backup/export/restore workflows instead.',
            'Set ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true only for a controlled maintenance window.',
          ],
          ranAt: new Date().toISOString(),
        }
      : await this.executeSystemTool(toolId);
    const nextStatus = result.status;
    const lastRunAt = new Date(result.ranAt);

    await this.prisma.systemTool.update({
      where: { id: current.id },
      data: { lastRunAt, status: nextStatus },
    });

    return {
      tools: await this.getSystemTools(),
      result,
    };
  }

  resolveSystemToolArtifact(artifactPath: string) {
    const cleaned = String(artifactPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!cleaned || cleaned.includes('..') || !cleaned.startsWith('data/system-tools/')) {
      throw new NotFoundException('Artifact not found.');
    }

    const absolutePath = resolve(this.projectRoot(), cleaned);
    const allowedRoot = resolve(this.toolsRoot());
    if (!absolutePath.startsWith(allowedRoot)) {
      throw new NotFoundException('Artifact not found.');
    }
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Artifact not found.');
    }

    const stat = statSync(absolutePath);
    if (!stat.isFile()) {
      throw new NotFoundException('Artifact not found.');
    }

    return {
      absolutePath,
      fileName: basename(absolutePath),
    };
  }

  importBackupArtifact(input: { fileName: string; contentBase64: string }) {
    const backupsDir = join(this.toolsRoot(), 'backups');
    this.ensureDir(this.toolsRoot());
    this.ensureDir(backupsDir);

    const rawName = basename(String(input.fileName || 'backup-import.json')).replace(/[^a-zA-Z0-9._-]/g, '_');
    const normalizedName = rawName.toLowerCase().endsWith('.json') ? rawName : `${rawName}.json`;
    const fileName = normalizedName.startsWith('backup-')
      ? normalizedName
      : `backup-import-${Date.now()}-${normalizedName}`;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(String(input.contentBase64 || ''), 'base64');
    } catch {
      throw new BadRequestException('Backup package could not be decoded.');
    }

    if (!buffer.byteLength) {
      throw new BadRequestException('Backup package is empty.');
    }

    let snapshot: any;
    try {
      snapshot = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Backup package must be a valid JSON file.');
    }

    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      !Array.isArray(snapshot.users) ||
      !Array.isArray(snapshot.subjects) ||
      !Array.isArray(snapshot.submissions)
    ) {
      throw new BadRequestException('Backup package does not match the expected PROJTRACK snapshot format.');
    }

    writeFileSync(join(backupsDir, fileName), JSON.stringify(snapshot, null, 2), 'utf8');

    return {
      toolId: 'restore',
      title: 'Backup Package Imported',
      status: 'Completed',
      summary: 'Backup package imported successfully.',
      details: [
        `Users: ${snapshot.users.length}`,
        `Subjects: ${snapshot.subjects.length}`,
        `Submissions: ${snapshot.submissions.length}`,
        'Restore Backup will use the newest package saved on this server.',
      ],
      artifactPath: `data/system-tools/backups/${fileName}`,
      ranAt: new Date().toISOString(),
    };
  }
}
