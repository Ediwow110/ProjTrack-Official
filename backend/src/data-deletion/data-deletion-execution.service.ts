import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { normalizeDataDeletionRequestStatus } from './data-deletion.lifecycle';
import { DATA_DELETION_EXECUTION_CONFIRMATION_TEXT, ExecuteDeletionDto } from './data-deletion-execution.dto';

type ActorContext = {
  actorUserId?: string;
  actorRole?: string;
  ipAddress?: string;
};

function isStageValidationEnv(env: NodeJS.ProcessEnv) {
  const scope = String(env.DATA_DELETION_STAGE_ONLY || '').trim().toLowerCase();
  const appEnv = String(env.APP_ENV || env.NODE_ENV || '').trim().toLowerCase();
  return (scope === 'staging' || scope === 'test') && (appEnv === 'staging' || appEnv === 'test');
}

// Models we must delete BEFORE user anonymization (because they key on email or userId)
// Order: EmailJob → Notification → PendingUpload → Enrollment → GroupMember
// → StudentProfile (needs Enrollment gone) → TeacherProfile (needs Subject.teacherId nulled)
// → AuthSession → AccountActionToken → User (anonymize last)

@Injectable()
export class DataDeletionExecutionService {
  private readonly logger = new Logger(DataDeletionExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getExecutionByRequestId(requestId: string) {
    return this.prisma.dataDeletionExecution.findUnique({ where: { requestId } });
  }

  /**
   * Find executions ready for destructive execution.
   * Used by the worker and admin-triggered batch operations.
   */
  async findBackupVerifiedExecutions(limit = 10) {
    return this.prisma.dataDeletionExecution.findMany({
      where: {
        status: 'BACKUP_VERIFIED',
        backupRunId: { not: null },
      },
      include: { request: { include: { requester: true } } },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async executeManuallyByRequestId(requestId: string, dto: ExecuteDeletionDto, actor?: ActorContext) {
    const execution = await this.prisma.dataDeletionExecution.findUnique({ where: { requestId } });
    if (!execution) {
      throw new NotFoundException('No execution for request.');
    }
    if (dto.confirmationPhrase !== DATA_DELETION_EXECUTION_CONFIRMATION_TEXT) {
      throw new BadRequestException(`confirmationPhrase must exactly equal "${DATA_DELETION_EXECUTION_CONFIRMATION_TEXT}".`);
    }
    if (!execution.backupRunId || execution.backupRunId !== dto.backupRunId) {
      throw new BadRequestException('backupRunId must match the verified backup linked to this execution.');
    }

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_EXECUTION_MANUAL_CONFIRMED',
      module: 'DataDeletion',
      target: requestId,
      entityId: execution.id,
      result: 'Success',
      details: `Manual destructive execution confirmed using backup ${dto.backupRunId}.`,
    });

    return this.attemptExecution(execution.id, actor);
  }

  async getRolloutStatus() {
    const [backupVerified, executionStarted, executionCompleted, executionFailed, readyExecutions, recentFailures] = await Promise.all([
      this.prisma.dataDeletionExecution.count({ where: { status: 'BACKUP_VERIFIED', backupRunId: { not: null } } }),
      this.prisma.dataDeletionExecution.count({ where: { status: 'EXECUTION_STARTED' } }),
      this.prisma.dataDeletionExecution.count({ where: { status: 'EXECUTION_COMPLETED' } }),
      this.prisma.dataDeletionExecution.count({ where: { status: 'EXECUTION_FAILED' } }),
      this.prisma.dataDeletionExecution.findMany({
        where: { status: 'BACKUP_VERIFIED', backupRunId: { not: null } },
        select: { id: true, requestId: true, backupRunId: true, backupVerifiedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      this.prisma.dataDeletionExecution.findMany({
        where: { status: 'EXECUTION_FAILED' },
        select: { id: true, requestId: true, backupRunId: true, executionCompletedAt: true, executionError: true },
        orderBy: { executionCompletedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      featureEnabled: process.env.DATA_DELETION_EXECUTION_ENABLED === 'true',
      executionMode: String(process.env.DATA_DELETION_EXECUTION_MODE || ''),
      manualOnlyRollout: true,
      counts: {
        backupVerified,
        executionStarted,
        executionCompleted,
        executionFailed,
      },
      readyExecutions,
      recentFailures,
    };
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
      include: { request: { include: { requester: true } } },
    });
    if (!execution) throw new NotFoundException('Execution not found.');

    // Safety: feature flag check (env based)
    const enabled = process.env.DATA_DELETION_EXECUTION_ENABLED === 'true';
    if (!enabled) {
      await this.recordExecutionBlocked(
        execution,
        actor,
        'Destructive execution is disabled by feature flag (DATA_DELETION_EXECUTION_ENABLED). Only dry-run allowed.',
      );
      throw new ForbiddenException('Destructive data deletion execution is currently disabled. Use dry-run only.');
    }

    const manualMode = String(process.env.DATA_DELETION_EXECUTION_MODE || '').trim().toLowerCase() === 'manual';
    if (!manualMode && !isStageValidationEnv(process.env)) {
      await this.recordExecutionBlocked(
        execution,
        actor,
        'Destructive execution requires DATA_DELETION_EXECUTION_MODE=manual outside staging/test validation.',
      );
      throw new ForbiddenException('Destructive data deletion execution requires manual rollout mode.');
    }

    // Prevent re-execution before narrowing status checks
    if (execution.status === 'EXECUTION_COMPLETED') {
      throw new BadRequestException('Execution has already been completed. Create a new request for re-execution.');
    }
    if (execution.status === 'EXECUTION_STARTED') {
      throw new BadRequestException('Execution is already in progress.');
    }

    const requestStatus = normalizeDataDeletionRequestStatus(execution.request.status);
    if (requestStatus !== 'APPROVED') {
      await this.recordExecutionBlocked(
        execution,
        actor,
        `Execution requires APPROVED request status. Current status: ${execution.request.status}.`,
      );
      throw new BadRequestException('Execution can only run for APPROVED requests.');
    }

    if (!execution.backupRunId || execution.status !== 'BACKUP_VERIFIED') {
      await this.recordExecutionBlocked(
        execution,
        actor,
        'Verified backup is required before non-dry-run execution.',
      );
      throw new BadRequestException('Verified backup is required before non-dry-run execution.');
    }

    const backup = await this.prisma.backupRun.findUnique({ where: { id: execution.backupRunId } });
    if (!backup || backup.status !== 'COMPLETED' || backup.deletedAt) {
      await this.recordExecutionBlocked(
        execution,
        actor,
        'Referenced backup is not currently COMPLETED and available for destructive execution.',
      );
      throw new BadRequestException('Referenced backup must remain COMPLETED and not deleted before destructive execution.');
    }

    // Mark as started
    await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: 'EXECUTION_STARTED',
        dryRun: false,
        executionStartedAt: new Date(),
        executedByUserId: actor?.actorUserId,
      },
    });

    // Execute destructive operations per Phase 7A classification
    let success = false;
    let errorMessage: string | null = null;
    const results: Record<string, { action: string; count: number }> = {};

    try {
      const userId = execution.request.requesterUserId;
      const user = execution.request.requester;
      const originalEmail = user.email;

      // 1. Delete EmailJobs (before user anonymization changes the email)
      const emailJobCount = await this.executeEmailJobDeletion(originalEmail);
      results['EmailJob'] = { action: 'delete', count: emailJobCount };

      // 2. Delete Notifications
      const notifCount = await this.executeNotificationDeletion(userId);
      results['Notification'] = { action: 'delete', count: notifCount };

      // 3. Delete PendingUploads
      const uploadCount = await this.executePendingUploadDeletion(userId);
      results['PendingUpload'] = { action: 'delete', count: uploadCount };

      // 4. Find profiles for deletion ordering
      const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId } });
      const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId } });

      // 5. Delete Enrollments (depends on StudentProfile)
      if (studentProfile) {
        const enrollCount = await this.executeEnrollmentDeletion(studentProfile.id);
        results['Enrollment'] = { action: 'delete', count: enrollCount };
      } else {
        results['Enrollment'] = { action: 'delete', count: 0 };
      }

      // 6. Delete GroupMembers
      const gmCount = await this.executeGroupMemberDeletion(userId);
      results['GroupMember'] = { action: 'delete', count: gmCount };

      // 7. Nullify Subject.teacherId (if teacher profile exists)
      if (teacherProfile) {
        const subjCount = await this.executeSubjectTeacherNullification(teacherProfile.id);
        results['Subject(teacherId cleared)'] = { action: 'update', count: subjCount };
      }

      // 8. Delete StudentProfile
      if (studentProfile) {
        await this.executeStudentProfileDeletion(userId);
        results['StudentProfile'] = { action: 'delete', count: 1 };
      } else {
        results['StudentProfile'] = { action: 'delete', count: 0 };
      }

      // 9. Delete TeacherProfile
      if (teacherProfile) {
        await this.executeTeacherProfileDeletion(userId);
        results['TeacherProfile'] = { action: 'delete', count: 1 };
      } else {
        results['TeacherProfile'] = { action: 'delete', count: 0 };
      }

      // 10. Delete AuthSessions
      const sessionCount = await this.executeAuthSessionDeletion(userId);
      results['AuthSession'] = { action: 'delete', count: sessionCount };

      // 11. Delete AccountActionTokens
      const tokenCount = await this.executeAccountActionTokenDeletion(userId);
      results['AccountActionToken'] = { action: 'delete', count: tokenCount };

      // 12. Anonymize User (last — everything else references user by id)
      await this.executeUserAnonymization(userId);
      results['User'] = { action: 'anonymize', count: 1 };

      success = true;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error during destructive execution';
      this.logger.error(`Destructive execution failed for ${executionId}: ${errorMessage}`, (err as Error).stack);
    }

    // Update execution record with result
    const finalStatus = success ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED';
    const resultJson = { results, error: errorMessage, completedAt: new Date().toISOString() };

    await this.prisma.dataDeletionExecution.update({
      where: { id: executionId },
      data: {
        status: finalStatus,
        executionCompletedAt: new Date(),
        executionResultJson: resultJson as any,
        executionError: errorMessage,
      },
    });

    // Audit the final outcome
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: success ? 'DATA_DELETION_EXECUTION_COMPLETED' : 'DATA_DELETION_EXECUTION_FAILED',
      module: 'DataDeletion',
      target: execution.requestId,
      entityId: executionId,
      result: success ? 'Success' : 'Failed',
      details: success
        ? `Destructive execution completed. Models affected: ${Object.entries(results).map(([k, v]) => `${k}=${v.count}`).join(', ')}`
        : `Destructive execution failed: ${errorMessage}`,
    });

    if (!success) {
      throw new Error(`Destructive execution failed: ${errorMessage}`);
    }

    return this.prisma.dataDeletionExecution.findUnique({ where: { id: executionId } });
  }

  // ---------------------------------------------------------------------------
  // Private destructive execution methods
  // ---------------------------------------------------------------------------

  private async executeEmailJobDeletion(userEmail: string): Promise<number> {
    const result = await this.prisma.emailJob.deleteMany({
      where: { userEmail },
    });
    this.logger.log(`Deleted ${result.count} EmailJob rows for email ${userEmail}`);
    return result.count;
  }

  private async executeNotificationDeletion(userId: string): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });
    this.logger.log(`Deleted ${result.count} Notification rows for userId ${userId}`);
    return result.count;
  }

  private async executePendingUploadDeletion(userId: string): Promise<number> {
    const result = await this.prisma.pendingUpload.deleteMany({
      where: { userId },
    });
    this.logger.log(`Deleted ${result.count} PendingUpload rows for userId ${userId}`);
    return result.count;
  }

  private async executeEnrollmentDeletion(studentProfileId: string): Promise<number> {
    const result = await this.prisma.enrollment.deleteMany({
      where: { studentId: studentProfileId },
    });
    this.logger.log(`Deleted ${result.count} Enrollment rows for studentProfileId ${studentProfileId}`);
    return result.count;
  }

  private async executeGroupMemberDeletion(userId: string): Promise<number> {
    const result = await this.prisma.groupMember.deleteMany({
      where: { studentId: userId },
    });
    this.logger.log(`Deleted ${result.count} GroupMember rows for userId ${userId}`);
    return result.count;
  }

  private async executeSubjectTeacherNullification(teacherProfileId: string): Promise<number> {
    const result = await this.prisma.subject.updateMany({
      where: { teacherId: teacherProfileId },
      data: { teacherId: null },
    });
    if (result.count > 0) {
      this.logger.log(`Nullified Subject.teacherId for ${result.count} subjects linked to teacherProfileId ${teacherProfileId}`);
    }
    return result.count;
  }

  private async executeStudentProfileDeletion(userId: string): Promise<void> {
    await this.prisma.studentProfile.delete({ where: { userId } });
    this.logger.log(`Deleted StudentProfile for userId ${userId}`);
  }

  private async executeTeacherProfileDeletion(userId: string): Promise<void> {
    await this.prisma.teacherProfile.delete({ where: { userId } });
    this.logger.log(`Deleted TeacherProfile for userId ${userId}`);
  }

  private async executeAuthSessionDeletion(userId: string): Promise<number> {
    const result = await this.prisma.authSession.deleteMany({
      where: { userId },
    });
    this.logger.log(`Deleted ${result.count} AuthSession rows for userId ${userId}`);
    return result.count;
  }

  private async executeAccountActionTokenDeletion(userId: string): Promise<number> {
    const result = await this.prisma.accountActionToken.deleteMany({
      where: { userId },
    });
    this.logger.log(`Deleted ${result.count} AccountActionToken rows for userId ${userId}`);
    return result.count;
  }

  private async executeUserAnonymization(userId: string): Promise<void> {
    const anonymizedEmail = `deleted-${userId}@anonymized.invalid`;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        passwordHash: null,
        firstName: '[Deleted]',
        lastName: '[Deleted]',
        phone: null,
        office: null,
        avatarRelativePath: null,
        status: 'ARCHIVED',
      },
    });
    this.logger.log(`Anonymized User ${userId} (email -> ${anonymizedEmail}, status -> ARCHIVED)`);
  }

  private async recordExecutionBlocked(
    execution: { requestId: string; id: string },
    actor: ActorContext | undefined,
    details: string,
  ) {
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'DATA_DELETION_EXECUTION_BLOCKED',
      module: 'DataDeletion',
      target: execution.requestId,
      entityId: execution.id,
      result: 'Blocked',
      details,
    });
  }

  // ---------------------------------------------------------------------------
  // Execution planning (real counts from database)
  // ---------------------------------------------------------------------------

  private async buildExecutionPlan(requestId: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: { requester: { include: { studentProfile: true, teacherProfile: true } } },
    });
    if (!request) return { categories: [] };

    const userId = request.requesterUserId;
    const user = request.requester;
    const originalEmail = user.email;

    // Query real counts (no mutations)
    const emailJobCount = await this.prisma.emailJob.count({ where: { userEmail: originalEmail } });
    const notifCount = await this.prisma.notification.count({ where: { userId } });
    const uploadCount = await this.prisma.pendingUpload.count({ where: { userId } });
    const sessionCount = await this.prisma.authSession.count({ where: { userId } });
    const tokenCount = await this.prisma.accountActionToken.count({ where: { userId } });
    const gmCount = await this.prisma.groupMember.count({ where: { studentId: userId } });

    const studentProfile = request.requester?.studentProfile;
    const teacherProfile = request.requester?.teacherProfile;

    let enrollCount = 0;
    if (studentProfile) {
      enrollCount = await this.prisma.enrollment.count({ where: { studentId: studentProfile.id } });
    }

    let subjectCount = 0;
    if (teacherProfile) {
      subjectCount = await this.prisma.subject.count({ where: { teacherId: teacherProfile.id } });
    }

    const categories = [
      { name: 'User', action: 'anonymize', count: 1, notes: 'core identity — PII cleared, tombstone preserved' },
      { name: 'StudentProfile', action: 'delete', count: studentProfile ? 1 : 0 },
      { name: 'TeacherProfile', action: 'delete', count: teacherProfile ? 1 : 0 },
      { name: 'Enrollment', action: 'delete', count: enrollCount, notes: studentProfile ? `linked to student profile ${studentProfile.id}` : 'no student profile' },
      { name: 'Subject.teacherId', action: 'nullify', count: subjectCount, notes: teacherProfile ? `subjects referencing teacher profile` : 'no teacher profile' },
      { name: 'GroupMember', action: 'delete', count: gmCount },
      { name: 'PendingUpload', action: 'delete', count: uploadCount },
      { name: 'Notification', action: 'delete', count: notifCount },
      { name: 'EmailJob', action: 'delete', count: emailJobCount, notes: `matching email: ${originalEmail}` },
      { name: 'AuthSession', action: 'delete', count: sessionCount },
      { name: 'AccountActionToken', action: 'delete', count: tokenCount },
      { name: 'AuditLogs', action: 'retain', count: 'retained', notes: 'MUST NOT DELETE per policy' },
      { name: 'BackupRuns', action: 'retain', count: 'linked backup metadata retained' },
      { name: 'DataDeletionRequest', action: 'retain', count: 1, notes: 'RETAIN_WITH_PII_MINIMIZATION' },
      { name: 'DataDeletionExecution', action: 'retain', count: 'execution evidence retained' },
    ];

    return { requestId, categories, generatedAt: new Date().toISOString() };
  }

  private async performDryRunSimulation(requestId: string) {
    const plan = await this.buildExecutionPlan(requestId);
    // Extract simulated counts from plan categories
    const simulatedDeletions: Record<string, number> = {};
    for (const cat of plan.categories) {
      if (typeof cat.count === 'number') {
        simulatedDeletions[cat.name] = cat.count;
      }
    }

    return {
      ...plan,
      simulatedDeletions,
      note: 'DRY-RUN: no actual deletions performed. All counts are real database queries without mutation.',
    };
  }
}
