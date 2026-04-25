import { Injectable } from '@nestjs/common';
import { EmailJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { MailLimitService } from '../mail/mail-limit.service';
import { MailTransportService } from '../mail/mail.transport.service';
import { inspectRuntimeConfiguration } from '../config/runtime-safety';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly mailTransport: MailTransportService,
    private readonly mailLimits: MailLimitService,
  ) {}

  live() {
    return {
      ok: true,
      service: 'projtrack-backend',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const [database, storage, mail, configuration] = await Promise.all([
      this.database(),
      Promise.resolve(this.files.healthCheck()),
      this.mailStatus(),
      Promise.resolve(this.configuration()),
    ]);

    return {
      ok: database.ok && storage.ok && mail.ok && configuration.ok,
      service: 'projtrack-backend',
      checks: {
        database: database.ok,
        storage: storage.ok,
        mail: mail.ok,
        configuration: configuration.ok,
      },
      timestamp: new Date().toISOString(),
    };
  }

  storage() {
    return this.files.healthCheck();
  }

  async mailStatus() {
    const recentFailureThreshold = new Date(Date.now() - 60 * 60 * 1000);
    const activeProvider = this.mailTransport.getProviderName();
    const [
      transport,
      queued,
      dead,
      pausedLimitReached,
      sent24h,
      limits,
      latestFailure,
      latestSuccess,
    ] =
      await Promise.all([
      this.mailTransport.verifyTransport(),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.QUEUED, provider: activeProvider },
      }),
      this.prisma.emailJob.count({
        where: { status: EmailJobStatus.DEAD, provider: activeProvider },
      }),
      this.prisma.emailJob.count({
        where: {
          status: EmailJobStatus.PAUSED_LIMIT_REACHED,
          provider: activeProvider,
        },
      }),
      this.prisma.emailJob.count({
        where: {
          provider: activeProvider,
          status: EmailJobStatus.SENT,
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.mailLimits.getUsage(this.mailTransport.getProviderName()),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          status: { in: [EmailJobStatus.FAILED, EmailJobStatus.DEAD] },
          updatedAt: { gte: recentFailureThreshold },
          lastError: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          userEmail: true,
          subject: true,
          failureReason: true,
          lastError: true,
          updatedAt: true,
        },
      }),
      this.prisma.emailJob.findFirst({
        where: {
          provider: activeProvider,
          status: EmailJobStatus.SENT,
          sentAt: { not: null },
        },
        orderBy: { sentAt: 'desc' },
        select: {
          id: true,
          sentAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const recentFailure =
      latestFailure && latestFailure.lastError
        ? {
            id: latestFailure.id,
            status: latestFailure.status,
            recipientEmail: latestFailure.userEmail,
            subject: latestFailure.subject,
            failureReason: latestFailure.failureReason,
            message: latestFailure.lastError,
            updatedAt: latestFailure.updatedAt.toISOString(),
          }
        : null;

    const latestSuccessAt =
      latestSuccess?.sentAt instanceof Date
        ? latestSuccess.sentAt
        : latestSuccess?.updatedAt instanceof Date
          ? latestSuccess.updatedAt
          : null;
    const activeRecentFailure =
      recentFailure &&
      (!latestSuccessAt || latestFailure.updatedAt.getTime() >= latestSuccessAt.getTime())
        ? recentFailure
        : null;

    const ok = transport.ok && !activeRecentFailure;
    const detail = !transport.ok
      ? transport.detail
      : activeRecentFailure
        ? `Recent mail delivery failure: ${activeRecentFailure.message}`
        : transport.detail;

    return {
      ...transport,
      ok,
      detail,
      queued,
      dead,
      pausedLimitReached,
      sent24h,
      limits,
      recentFailure: activeRecentFailure,
    };
  }

  configuration() {
    return {
      service: 'projtrack-backend',
      ...inspectRuntimeConfiguration(process.env),
    };
  }

  async database() {
    const timestamp = new Date().toISOString();
    const persistenceMode = String(process.env.PERSISTENCE_MODE ?? 'prisma');

    if (!process.env.DATABASE_URL) {
      return {
        ok: false,
        configured: false,
        reachable: false,
        persistenceMode,
        detail: 'DATABASE_URL is not set.',
        migrationTablePresent: false,
        pendingMigrations: null as number | null,
        appliedMigrations: null as number | null,
        timestamp,
      };
    }

    try {
      const databaseInfo = await this.prisma.$queryRawUnsafe<Array<{
        currentDatabase: string;
        currentSchema: string;
        migrationsTable: string | null;
      }>>(
        'SELECT current_database() AS "currentDatabase", current_schema() AS "currentSchema", to_regclass(\'_prisma_migrations\')::text AS "migrationsTable"',
      );

      const info = databaseInfo[0];
      let pendingMigrations: number | null = null;
      let appliedMigrations: number | null = null;

      if (info?.migrationsTable) {
        const migrationInfo = await this.prisma.$queryRawUnsafe<Array<{
          appliedCount: number;
          unresolvedCount: number;
        }>>(
          'SELECT COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS "appliedCount", COUNT(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::int AS "unresolvedCount" FROM "_prisma_migrations"',
        );
        appliedMigrations = Number(migrationInfo[0]?.appliedCount ?? 0);
        pendingMigrations = Number(migrationInfo[0]?.unresolvedCount ?? 0);
      }

      const migrationTablePresent = Boolean(info?.migrationsTable);
      const ok = migrationTablePresent && pendingMigrations === 0;

      return {
        ok,
        configured: true,
        reachable: true,
        persistenceMode,
        currentDatabase: info?.currentDatabase ?? '',
        currentSchema: info?.currentSchema ?? '',
        migrationTablePresent,
        pendingMigrations,
        appliedMigrations,
        detail: !migrationTablePresent
          ? 'Database is reachable, but the Prisma migrations table is missing.'
          : pendingMigrations === 0
            ? `Connected to ${info.currentDatabase}.${info.currentSchema}; ${appliedMigrations} migration(s) applied.`
            : `Connected to ${info.currentDatabase}.${info.currentSchema}; ${pendingMigrations} migration record(s) still need attention.`,
        timestamp,
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        reachable: false,
        persistenceMode,
        detail: `Database probe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        migrationTablePresent: false,
        pendingMigrations: null as number | null,
        appliedMigrations: null as number | null,
        timestamp,
      };
    }
  }
}
