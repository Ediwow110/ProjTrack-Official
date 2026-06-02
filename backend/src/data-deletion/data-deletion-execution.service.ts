import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { normalizeDataDeletionRequestStatus } from './data-deletion.lifecycle';

type ActorContext = {
  actorUserId?: string;
  actorRole?: string;
  ipAddress?: string;
};

@Injectable()
export class DataDeletionExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getExecutionByRequestId(requestId: string) {
    return this.prisma.dataDeletionExecution.findUnique({ where: { requestId } });
  }

  async getOrCreateExecutionForRequest(requestId: string, actor?: ActorContext) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    });
    if (!request) {
      throw new NotFoundException('Data deletion request not found.');
    }
    const status = normalizeDataDeletionRequestStatus(request.status);
    if (status !== 'APPROVED') {
      throw new BadRequestException('Execution can only be planned for APPROVED requests.');
    }

    const existing = await this.prisma.dataDeletionExecution.findUnique({
      where: { requestId },
    });
    if (existing) {
      return existing;
    }

    const plan = await this.buildExecutionPlan(requestId);

    const created = await this.prisma.dataDeletionExecution.create({
      data: {
        requestId,
        status: 'DRY_RUN_PENDING',
        dryRun: true,
        executionPlanJson: plan as any,
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_DRY_RUN_PLANNED',
      module: 'DataDeletion',
      target: requestId,
      entityId: created.id,
      result: 'Success',
      details: 'Dry-run execution plan created for approved request.',
    });

    return created;
  }

  async startDryRun(executionId: string, actor?: ActorContext) {
    const execution = await this.prisma.dataDeletionExecution.findUnique({
      where: { id: executionId },
      include: { request: true },
    });
    if (!execution) throw new NotFoundException('Execution not found.');
    if (execution.status !== 'DRY_RUN_PENDING') {
      throw new BadRequestException('Execution must be in DRY_RUN_PENDING to start dry-run.');
    }

    const updated = await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: 'DRY_RUN_STARTED',
        dryRun: true,
        executionStartedAt: new Date(),
      },
    });

    // Simulate dry-run: compute what would be affected (no mutations)
    const result = await this.performDryRunSimulation(execution.requestId);

    const completed = await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: 'DRY_RUN_COMPLETED',
        executionCompletedAt: new Date(),
        executionResultJson: result as any,
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_DRY_RUN_COMPLETED',
      module: 'DataDeletion',
      target: execution.requestId,
      entityId: executionId,
      result: 'Success',
      details: `Dry-run completed. Affected categories simulated. No data mutated.`,
    });

    return completed;
  }

  async verifyBackup(executionId: string, dto: { backupRunId: string; verificationRef?: string }, actor?: ActorContext) {
    const execution = await this.prisma.dataDeletionExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new NotFoundException('Execution not found.');

    const backup = await this.prisma.backupRun.findUnique({ where: { id: dto.backupRunId } });
    if (!backup) {
      throw new BadRequestException('Backup run not found.');
    }
    if (backup.status !== 'COMPLETED' || backup.deletedAt) {
      throw new BadRequestException('Backup must be COMPLETED and not deleted for verification.');
    }
    // If sha256 or size present, could verify further, but for now status is sufficient per existing model.

    const updated = await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: 'BACKUP_VERIFIED',
        backupRunId: dto.backupRunId,
        backupVerifiedAt: new Date(),
        backupVerificationRef: dto.verificationRef || null,
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_BACKUP_VERIFIED',
      module: 'DataDeletion',
      target: execution.requestId,
      entityId: executionId,
      result: 'Success',
      details: `Backup ${dto.backupRunId} verified for execution.`,
    });

    return updated;
  }

  async attemptExecution(executionId: string, actor?: ActorContext) {
    const execution = await this.prisma.dataDeletionExecution.findUnique({
      where: { id: executionId },
      include: { request: true },
    });
    if (!execution) throw new NotFoundException('Execution not found.');

    // Safety: feature flag check (env based)
    const enabled = process.env.DATA_DELETION_EXECUTION_ENABLED === 'true';
    if (!enabled) {
      await this.auditLogs.record({
        actorUserId: actor?.actorUserId,
        actorRole: actor?.actorRole ?? 'ADMIN',
        action: 'DATA_DELETION_EXECUTION_BLOCKED',
        module: 'DataDeletion',
        target: execution.requestId,
        entityId: executionId,
        result: 'Blocked',
        details: 'Destructive execution is disabled by feature flag (DATA_DELETION_EXECUTION_ENABLED). Only dry-run allowed.',
      });
      throw new ForbiddenException('Destructive data deletion execution is currently disabled. Use dry-run only.');
    }

    if (!execution.backupRunId || execution.status !== 'BACKUP_VERIFIED') {
      throw new BadRequestException('Verified backup is required before non-dry-run execution.');
    }

    // For this PR, even if flag on, we still block actual destructive and require explicit future approval.
    // Record the intent but do not mutate.
    const updated = await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: 'EXECUTION_FAILED', // fail closed in this PR
        executionError: 'Destructive execution intentionally disabled in this release. See runbook and future PR.',
        executionStartedAt: new Date(),
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_EXECUTION_BLOCKED',
      module: 'DataDeletion',
      target: execution.requestId,
      entityId: executionId,
      result: 'Blocked',
      details: 'Real destructive execution path is not enabled in this PR. Dry-run and backup verification only.',
    });

    return updated;
  }

  private async buildExecutionPlan(requestId: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: { requester: { include: { studentProfile: true, teacherProfile: true } } },
    });
    if (!request) return { categories: [] };

    const categories: any[] = [
      { name: 'User', action: 'anonymize-or-delete', count: 1, notes: 'core identity' },
      { name: 'Profiles', action: 'delete', count: (request.requester?.studentProfile ? 1 : 0) + (request.requester?.teacherProfile ? 1 : 0) },
      { name: 'Submissions', action: 'delete', count: 'TBD - query at runtime' },
      { name: 'Files/Uploads', action: 'delete', count: 'TBD' },
      { name: 'Notifications', action: 'delete', count: 'TBD' },
      { name: 'MailJobs', action: 'delete', count: 'TBD' },
      { name: 'AuthSessions/Tokens', action: 'delete', count: 'TBD' },
      { name: 'AuditLogs', action: 'retain (PII minimized)', count: 'all for user', notes: 'MUST NOT DELETE per policy' },
      { name: 'BackupRuns', action: 'retain', count: 'linked' },
      { name: 'DataDeletionRequest', action: 'retain or mark', count: 1 },
    ];

    return { requestId, categories, generatedAt: new Date().toISOString() };
  }

  private async performDryRunSimulation(requestId: string) {
    // In real, would count affected rows without deleting.
    // Here we just return plan + simulated counts.
    const plan = await this.buildExecutionPlan(requestId);
    return {
      ...plan,
      simulatedDeletions: {
        user: 1,
        profiles: 0,
        submissions: 0,
        files: 0,
        notifications: 0,
        mail: 0,
        sessions: 0,
        audit: 0, // retained
      },
      note: 'DRY-RUN: no actual deletions performed. All counts are simulated.',
    };
  }
}
