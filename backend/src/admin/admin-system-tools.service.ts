import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemToolsRepository } from '../repositories/system-tools.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { getRequestId } from '../common/request-context';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';
import {
  describeSeedRelationKind,
  evaluateSeedSectionCandidate,
  SeedSectionEvaluationResult,
  summarizeSeedRelationCounts,
} from './seed-cleanup.utils';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminSystemToolsService {
  private readonly logger = new Logger(AdminSystemToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemToolsRepository: SystemToolsRepository,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
  ) {}

  async getSystemTools() {
    const tools = await this.systemToolsRepository.getSystemTools();
    if (tools.some((tool: any) => String(tool?.id ?? tool?.key ?? '').trim() === 'seed-cleanup')) {
      return tools;
    }
    return [...tools, this.buildSeedCleanupToolRecord()];
  }

  async runSystemTool(id: string, payload: any = {}, actor?: AdminActorContext) {
    await this.assertAdminRateLimit('system-tool-run', actor, id, {
      limit: Number(process.env.ADMIN_SYSTEM_TOOL_MAX_PER_HOUR || 10),
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    if (id === 'seed-cleanup') {
      const response = await this.runSeedCleanupTool(payload, actor);
      await this.auditLogs.record({
        actorUserId: actor?.actorUserId,
        actorRole: actor?.actorRole ?? 'ADMIN',
        action:
          String(payload?.mode ?? 'preview').toLowerCase() === 'execute'
            ? 'RUN'
            : 'PREVIEW',
        module: 'System Tools',
        target: response.result.title ?? id,
        entityId: 'seed-cleanup',
        result:
          response.result.status.includes('Failed') ||
          response.result.status.includes('Blocked')
            ? 'Failed'
            : 'Success',
        details: response.result.summary,
        ipAddress: actor?.ipAddress,
      });
      return response;
    }

    const response = await this.systemToolsRepository.runSystemTool(id);
    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: actor?.actorRole ?? 'ADMIN',
      action: 'RUN',
      module: 'System Tools',
      target: response.result.title ?? id,
      result:
        response.result.status.includes('Failed') ||
        response.result.status.includes('Restricted')
          ? 'Failed'
          : 'Success',
      details: response.result.summary,
      ipAddress: actor?.ipAddress,
    });
    return response;
  }

  // ───── Seed Cleanup Tool ─────

  private buildSeedCleanupToolRecord() {
    const production = this.isProductionRuntime();
    const cleanupEnabled = this.allowSeedCleanup();
    const productionOverride = this.allowProductionAdminToolRuns();
    const status = !cleanupEnabled
      ? 'Disabled'
      : production && !productionOverride
        ? 'Production locked'
        : 'Guarded';

    return {
      id: 'seed-cleanup',
      key: 'seed-cleanup',
      title: 'Seed Data Cleanup',
      desc:
        'Preview and remove safely identifiable demo, seed, or test records only after backup confirmation and typed approval.',
      btn: 'Preview Cleanup',
      danger: true,
      tone: 'rose',
      status,
      lastRun: 'Confirmation required',
      lastRunAt: undefined,
    };
  }

  private async runSeedCleanupTool(payload: any, actor?: AdminActorContext) {
    const mode = String(payload?.mode ?? 'preview').trim().toLowerCase() === 'execute'
      ? 'execute'
      : 'preview';
    const preview = await this.buildSeedCleanupPreview(actor);
    const ranAt = new Date().toISOString();
    const toolRecord = this.buildSeedCleanupToolRecord();
    const tools = await this.getSystemTools();

    const previewBlockers = preview.blockedReasons?.length
      ? preview.blockedReasons
      : preview.envWarnings?.length
        ? preview.envWarnings
        : preview.totalRecords === 0
          ? ['No safely identifiable seed/demo records were found.']
          : [];
    const previewStatus = preview.safeToExecute
      ? 'Preview ready — no records deleted'
      : 'Blocked — no records deleted';
    const previewSummary = preview.safeToExecute
      ? `Cleanup has not been executed. The system only scanned candidate seed/demo data and found ${preview.totalRecords} record(s) across ${preview.nonZeroEntityCount} entity group(s). No records deleted.`
      : 'Cleanup has not been executed. The system only scanned candidate seed/demo data and found blockers.';
    const previewDetails = [
      `Last scan: ${ranAt}`,
      'Cleanup executed: No',
      'Records deleted: 0',
      previewBlockers.length > 0
        ? `Blocked reason: ${previewBlockers.join(' | ')}`
        : 'Blocked reason: None found during preview.',
      ...preview.details,
    ];

    if (mode !== 'execute') {
      return {
        tools,
        result: {
          toolId: toolRecord.id,
          title: 'Seed Data Cleanup Preview',
          status: previewStatus,
          summary: previewSummary,
          details: previewDetails,
          ranAt,
          executed: false,
          recordsDeleted: 0,
          blockedReasons: previewBlockers,
          preview,
        },
      };
    }

    if (!this.allowSeedCleanup()) {
      throw new ForbiddenException(
        'Seed cleanup is disabled. Set ALLOW_SEED_DATA_CLEANUP=true before running this tool.',
      );
    }

    if (this.isProductionRuntime() && !this.allowProductionAdminToolRuns()) {
      throw new ForbiddenException(
        'Seed cleanup is locked in production. Set ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true only during a controlled maintenance window.',
      );
    }

    if (!preview.safeToExecute) {
      throw new BadRequestException(preview.summary);
    }

    const confirmation = String(payload?.confirmation ?? '').trim().toUpperCase();
    if (confirmation !== 'CLEAN SEED DATA') {
      throw new BadRequestException('Type CLEAN SEED DATA to confirm seed cleanup.');
    }

    if (payload?.backupConfirmed !== true) {
      throw new BadRequestException(
        'Confirm that a fresh backup has been created before running seed cleanup.',
      );
    }

    const cleanupFileActor = {
      userId: actor?.actorUserId,
      role: 'ADMIN',
    };
    const removedStoragePaths: string[] = [];
    const storageRemovalWarnings: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      if (preview.auditLogIds.length > 0) {
        await tx.auditLog.deleteMany({
          where: { id: { in: preview.auditLogIds } },
        });
      }

      if (preview.userIds.length > 0) {
        await tx.auditLog.updateMany({
          where: { actorUserId: { in: preview.userIds } },
          data: { actorUserId: null },
        });
      }

      if (preview.notificationIds.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: preview.notificationIds } },
        });
      }

      if (preview.mailJobIds.length > 0) {
        await tx.emailJob.deleteMany({
          where: { id: { in: preview.mailJobIds } },
        });
      }

      if (preview.announcementIds.length > 0) {
        await tx.announcement.deleteMany({
          where: { id: { in: preview.announcementIds } },
        });
      }

      if (preview.requestIds.length > 0) {
        await tx.request.deleteMany({
          where: { id: { in: preview.requestIds } },
        });
      }

      if (preview.userIds.length > 0) {
        await tx.accountActionToken.deleteMany({
          where: { userId: { in: preview.userIds } },
        });
        await tx.authSession.deleteMany({
          where: { userId: { in: preview.userIds } },
        });
      }

      if (preview.submissionIds.length > 0) {
        await tx.submissionEvent.deleteMany({
          where: { submissionId: { in: preview.submissionIds } },
        });
        await tx.submissionFile.deleteMany({
          where: { submissionId: { in: preview.submissionIds } },
        });
        await tx.submission.deleteMany({
          where: { id: { in: preview.submissionIds } },
        });
      }

      if (preview.groupMemberIds.length > 0) {
        await tx.groupMember.deleteMany({
          where: { id: { in: preview.groupMemberIds } },
        });
      }

      if (preview.groupIds.length > 0) {
        await tx.group.deleteMany({
          where: { id: { in: preview.groupIds } },
        });
      }

      if (preview.enrollmentIds.length > 0) {
        await tx.enrollment.deleteMany({
          where: { id: { in: preview.enrollmentIds } },
        });
      }

      if (preview.subjectSectionIds.length > 0) {
        await tx.subjectSection.deleteMany({
          where: { id: { in: preview.subjectSectionIds } },
        });
      }

      if (preview.taskIds.length > 0) {
        await tx.submissionTask.deleteMany({
          where: { id: { in: preview.taskIds } },
        });
      }

      if (preview.subjectIds.length > 0) {
        await tx.subject.deleteMany({
          where: { id: { in: preview.subjectIds } },
        });
      }

      if (preview.studentProfileIds.length > 0) {
        await tx.studentProfile.deleteMany({
          where: { id: { in: preview.studentProfileIds } },
        });
      }

      if (preview.teacherProfileIds.length > 0) {
        await tx.teacherProfile.deleteMany({
          where: { id: { in: preview.teacherProfileIds } },
        });
      }

      if (preview.sectionIds.length > 0) {
        await tx.section.deleteMany({
          where: { id: { in: preview.sectionIds } },
        });
      }

      if (preview.academicYearLevelIds.length > 0) {
        await tx.academicYearLevel.deleteMany({
          where: { id: { in: preview.academicYearLevelIds } },
        });
      }

      if (preview.academicYearIds.length > 0) {
        await tx.academicYear.deleteMany({
          where: { id: { in: preview.academicYearIds } },
        });
      }

      if (preview.departmentIds.length > 0) {
        await tx.department.deleteMany({
          where: { id: { in: preview.departmentIds } },
        });
      }

      if (preview.userIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: preview.userIds } },
        });
      }
    });

    const afterPreview = await this.buildSeedCleanupPreview(actor);
    const beforeCountLines = this.seedCleanupCountEntries(preview.counts).map(
      ([label, count]) => `Before cleanup ${this.toTitleWords(label)}: ${count}`,
    );
    const afterCountLines = this.seedCleanupCountEntries(afterPreview.counts).map(
      ([label, count]) => `After cleanup ${this.toTitleWords(label)}: ${count}`,
    );

    for (const file of preview.submissionFiles) {
      const relativePath = String(file.relativePath ?? '').trim();
      if (!relativePath) {
        continue;
      }
      try {
        await this.files.removeStorageObjectOnly(relativePath, cleanupFileActor);
        removedStoragePaths.push(relativePath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown file removal failure';
        this.logger.warn(
          `Seed cleanup deleted database records but could not remove stored file ${relativePath}: ${reason}`,
        );
        storageRemovalWarnings.push(`Stored file cleanup warning for ${relativePath}: ${reason}`);
      }
    }

    return {
      tools,
      result: {
        toolId: toolRecord.id,
        title: 'Seed Data Cleanup Executed',
        status: 'Completed',
        summary: `Seed cleanup executed and removed ${preview.totalRecords} record(s) across ${preview.nonZeroEntityCount} entity group(s).`,
        details: [
          `Executed at: ${ranAt}`,
          `Executed by: ${actor?.actorEmail ?? actor?.actorUserId ?? 'Admin'}`,
          'Backup acknowledgement: Confirmed by administrator before execution.',
          `Protected admin preserved: ${preview.protectedAdminStillActive ? 'Yes' : 'Unknown'}.`,
          `Stored submission files removed: ${removedStoragePaths.length}.`,
          storageRemovalWarnings.length > 0
            ? `Storage cleanup warnings: ${storageRemovalWarnings.length}. Review server logs before purging orphaned files.`
            : 'Storage cleanup warnings: 0.',
          `Remaining candidate demo records after cleanup: ${afterPreview.totalRecords}.`,
          'Run completed after typed confirmation and backup acknowledgement.',
          ...beforeCountLines,
          ...afterCountLines,
          ...preview.executionDetails,
          ...storageRemovalWarnings,
        ],
        ranAt,
        executed: true,
        executedAt: ranAt,
        executedBy: actor?.actorEmail ?? actor?.actorUserId ?? 'Admin',
        recordsDeleted: preview.totalRecords,
        storageFilesRemoved: removedStoragePaths.length,
        storageRemovalWarnings,
        beforeCounts: preview.counts,
        afterCounts: afterPreview.counts,
        tablesCleaned: this.seedCleanupCountEntries(preview.counts)
          .filter(([, count]) => count > 0)
          .map(([label]) => label),
        remainingCandidateRecords: afterPreview.totalRecords,
        preview,
        postCleanupPreview: afterPreview,
      },
    };
  }

  private async buildSeedCleanupPreview(actor?: AdminActorContext) {
    const protectedAdminEmail = 'admin@projtrack.codes';
    const [
      users,
      subjects,
      sections,
      academicYears,
      academicYearLevels,
      groups,
      submissions,
      notifications,
      emailJobs,
      departments,
      announcements,
      requests,
    ] = await Promise.all([
      this.prisma.user.findMany({
        include: {
          studentProfile: true,
          teacherProfile: true,
        },
      }),
      this.prisma.subject.findMany({
        include: {
          teacher: {
            include: {
              user: { select: SAFE_USER_SELECT },
            },
          },
          tasks: true,
          groups: {
            include: {
              members: true,
            },
          },
          enrollments: {
            include: {
              student: {
                include: {
                  user: { select: SAFE_USER_SELECT },
                },
              },
            },
          },
          subjectSections: true,
        },
      }),
      this.prisma.section.findMany({
        include: {
          students: {
            select: {
              id: true,
              userId: true,
            },
          },
          enrollments: {
            select: {
              id: true,
              studentId: true,
              subjectId: true,
              sectionId: true,
            },
          },
          groups: {
            select: {
              id: true,
              subjectId: true,
              sectionId: true,
            },
          },
          subjectSections: {
            select: {
              id: true,
              subjectId: true,
              sectionId: true,
            },
          },
        },
      }),
      this.prisma.academicYear.findMany({
        include: {
          levels: { select: { id: true } },
          sections: { select: { id: true } },
          students: { select: { id: true } },
        },
      }),
      this.prisma.academicYearLevel.findMany({
        include: {
          sections: { select: { id: true } },
          students: { select: { id: true } },
        },
      }),
      this.prisma.group.findMany({
        include: {
          members: true,
        },
      }),
      this.prisma.submission.findMany({
        include: {
          files: true,
          events: true,
        },
      }),
      this.prisma.notification.findMany(),
      this.prisma.emailJob.findMany(),
      this.prisma.department.findMany(),
      this.prisma.announcement.findMany(),
      this.prisma.request.findMany(),
    ]);

    const seedUsers = users.filter(
      (user) =>
        String(user.email ?? '').trim().toLowerCase() !== protectedAdminEmail &&
        this.isSeedUserCandidate(user),
    );
    const seedUserIds = new Set(seedUsers.map((user) => user.id));
    const seedUserEmails = new Set(seedUsers.map((user) => String(user.email ?? '').toLowerCase()));
    const seedUserNames = new Set(
      seedUsers
        .map((user) => this.userName(user).trim().toLowerCase())
        .filter(Boolean),
    );
    const seedStudentProfileIds = new Set<string>(
      seedUsers.map((user) => user.studentProfile?.id).filter(Boolean) as string[],
    );
    const seedTeacherProfileIds = new Set<string>(
      seedUsers.map((user) => user.teacherProfile?.id).filter(Boolean) as string[],
    );

    const explicitSeedSubjectIds = new Set(
      subjects
        .filter((subject) => this.isSeedLabel(subject.code) || this.isSeedLabel(subject.name))
        .map((subject) => subject.id),
    );

    const seedSubjects = subjects.filter((subject) => {
      if (explicitSeedSubjectIds.has(subject.id)) {
        return true;
      }

      const teacherUserId = String(subject.teacher?.userId ?? '').trim();
      if (!teacherUserId || !seedUserIds.has(teacherUserId)) {
        return false;
      }

      return subject.enrollments.every((enrollment) =>
        seedStudentProfileIds.has(enrollment.studentId),
      );
    });

    const seedSubjectIds = new Set<string>(seedSubjects.map((subject) => subject.id));
    const seedSubjectLabels = new Set(
      seedSubjects.flatMap((subject) =>
        [subject.code, subject.name]
          .map((value) => String(value ?? '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    const seedGroups = groups.filter(
      (group) =>
        seedSubjectIds.has(group.subjectId) &&
        group.members.every((member) => seedUserIds.has(member.studentId)),
    );
    const seedGroupIds = new Set<string>(seedGroups.map((group) => group.id));
    const seedGroupMembers = seedGroups.flatMap((group) => group.members);
    const seedGroupMemberIds = new Set(seedGroupMembers.map((member) => member.id));

    const sectionSeedEvaluations = new Map<string, SeedSectionEvaluationResult>(
      sections.map((section) => {
        const evaluation = evaluateSeedSectionCandidate({
          explicitSeed:
            this.isSeedLabel(section.name) ||
            this.isSeedLabel(section.description) ||
            this.isSeedLabel(section.course) ||
            this.isSeedLabel(section.yearLevelName) ||
            this.isSeedLabel(section.adviserName),
          studentIds: section.students.map((student) => student.id),
          enrollmentStudentIds: section.enrollments.map((enrollment) => enrollment.studentId),
          enrollmentSubjectIds: section.enrollments.map((enrollment) => enrollment.subjectId),
          groupIds: section.groups.map((group) => group.id),
          subjectSectionSubjectIds: section.subjectSections.map((link) => link.subjectId),
          seedStudentProfileIds,
          seedSubjectIds,
          seedGroupIds,
        });
        return [section.id, evaluation] as const;
      }),
    );

    const seedSections = sections.filter((section) => {
      const evaluation = sectionSeedEvaluations.get(section.id);
      if (!evaluation) {
        return false;
      }

      const explicitSeed =
        this.isSeedLabel(section.name) ||
        this.isSeedLabel(section.description) ||
        this.isSeedLabel(section.course) ||
        this.isSeedLabel(section.yearLevelName) ||
        this.isSeedLabel(section.adviserName);
      return explicitSeed || evaluation.qualifiesAsSeed;
    });
    const seedSectionIds = new Set(seedSections.map((section) => section.id));

    const seedAcademicYearLevelIds = new Set(
      academicYearLevels
        .filter((level) => {
          const explicitSeed = this.isSeedLabel(level.name);
          const hasSeedLinks =
            level.sections.some((section) => seedSectionIds.has(section.id)) ||
            level.students.some((student) => seedStudentProfileIds.has(student.id));

          return (
            explicitSeed ||
            (hasSeedLinks &&
              level.sections.every((section) => seedSectionIds.has(section.id)) &&
              level.students.every((student) => seedStudentProfileIds.has(student.id)))
          );
        })
        .map((level) => level.id),
    );

    const seedAcademicYearIds = new Set(
      academicYears
        .filter((year) => {
          const explicitSeed = this.isSeedLabel(year.name);
          const hasSeedLinks =
            year.sections.some((section) => seedSectionIds.has(section.id)) ||
            year.students.some((student) => seedStudentProfileIds.has(student.id)) ||
            year.levels.some((level) => seedAcademicYearLevelIds.has(level.id));

          return (
            explicitSeed ||
            (hasSeedLinks &&
              year.sections.every((section) => seedSectionIds.has(section.id)) &&
              year.students.every((student) => seedStudentProfileIds.has(student.id)) &&
              year.levels.every((level) => seedAcademicYearLevelIds.has(level.id)))
          );
        })
        .map((year) => year.id),
    );

    const seedDepartments = departments.filter((department) => {
      const normalizedName = String(department.name ?? '').trim().toLowerCase();
      const matchingTeachers = users.filter(
        (user) =>
          String(user.teacherProfile?.department ?? '').trim().toLowerCase() === normalizedName,
      );
      const explicitSeed =
        this.isSeedLabel(department.name) || this.isSeedLabel(department.description);
      return (
        explicitSeed ||
        (matchingTeachers.length > 0 && matchingTeachers.every((user) => seedUserIds.has(user.id)))
      );
    });
    const seedDepartmentIds = new Set(seedDepartments.map((department) => department.id));

    const seedTasks = seedSubjects.flatMap((subject) => subject.tasks);
    const seedTaskIds = new Set(seedTasks.map((task) => task.id));
    const seedSubjectSections = seedSubjects.flatMap((subject) =>
      subject.subjectSections.filter((link) => seedSectionIds.has(link.sectionId)),
    );
    const seedSubjectSectionIds = new Set(seedSubjectSections.map((link) => link.id));
    const seedEnrollments = seedSubjects.flatMap((subject) =>
      subject.enrollments.filter(
        (enrollment) =>
          seedStudentProfileIds.has(enrollment.studentId) &&
          (!enrollment.sectionId || seedSectionIds.has(enrollment.sectionId)),
      ),
    );
    const seedEnrollmentIds = new Set(seedEnrollments.map((enrollment) => enrollment.id));
    const seedSubmissions = submissions.filter(
      (submission) =>
        seedSubjectIds.has(submission.subjectId) ||
        seedTaskIds.has(submission.taskId) ||
        (submission.groupId ? seedGroupIds.has(submission.groupId) : false) ||
        (submission.studentId ? seedUserIds.has(submission.studentId) : false),
    );
    const seedSubmissionIds = new Set(seedSubmissions.map((submission) => submission.id));
    const seedSubmissionFiles = seedSubmissions.flatMap((submission) => submission.files);
    const seedSubmissionFileIds = new Set(seedSubmissionFiles.map((file) => file.id));
    const seedSubmissionEvents = seedSubmissions.flatMap((submission) => submission.events);
    const seedSubmissionEventIds = new Set(seedSubmissionEvents.map((event) => event.id));

    const seedNotifications = notifications.filter((notification) =>
      seedUserIds.has(notification.userId),
    );
    const seedNotificationIds = new Set(seedNotifications.map((notification) => notification.id));

    const seedEmailJobs = emailJobs.filter((job) => {
      const email = String(job.userEmail ?? '').trim().toLowerCase();
      return seedUserEmails.has(email) || this.isSeedEmailAddress(email);
    });
    const seedMailJobIds = new Set(seedEmailJobs.map((job) => job.id));

    const seedAnnouncements = announcements.filter(
      (announcement) =>
        this.isExactSeedAnnouncementCandidate(announcement) ||
        this.isSeedLabel(announcement.title) ||
        this.isSeedLabel(announcement.body),
    );
    const seedAnnouncementIds = new Set(seedAnnouncements.map((announcement) => announcement.id));

    const seedRequests = requests.filter((request) => {
      const requester = String(request.requester ?? '').trim().toLowerCase();
      const subject = String(request.subject ?? '').trim().toLowerCase();
      return (
        this.isExactSeedRequestCandidate(request) ||
        seedUserNames.has(requester) ||
        seedSubjectLabels.has(subject) ||
        this.isSeedLabel(request.requester) ||
        this.isSeedLabel(request.type) ||
        this.isSeedLabel(request.subject) ||
        this.isSeedLabel(request.details)
      );
    });
    const seedRequestIds = new Set(seedRequests.map((request) => request.id));

    const seedEntityIds = new Set<string>([
      ...seedUsers.map((user) => user.id),
      ...Array.from(seedStudentProfileIds),
      ...Array.from(seedTeacherProfileIds),
      ...Array.from(seedDepartmentIds),
      ...Array.from(seedAcademicYearIds),
      ...Array.from(seedAcademicYearLevelIds),
      ...Array.from(seedSectionIds),
      ...Array.from(seedSubjectSectionIds),
      ...Array.from(seedSubjectIds),
      ...Array.from(seedEnrollmentIds),
      ...Array.from(seedGroupIds),
      ...Array.from(seedGroupMemberIds),
      ...Array.from(seedTaskIds),
      ...Array.from(seedSubmissionIds),
      ...Array.from(seedSubmissionFileIds),
      ...Array.from(seedAnnouncementIds),
      ...Array.from(seedRequestIds),
    ]);

    const [seedAuthSessions, seedAccountActionTokens, seedAuditLogs] =
      seedUsers.length > 0 || seedEntityIds.size > 0
        ? await Promise.all([
            this.prisma.authSession.findMany({
              where: {
                userId: {
                  in: seedUsers.map((user) => user.id),
                },
              },
            }),
            this.prisma.accountActionToken.findMany({
              where: {
                userId: {
                  in: seedUsers.map((user) => user.id),
                },
              },
            }),
            this.prisma.auditLog.findMany({
              where: {
                OR: [
                  seedUsers.length > 0
                    ? {
                        actorUserId: {
                          in: seedUsers.map((user) => user.id),
                        },
                      }
                    : undefined,
                  seedEntityIds.size > 0
                    ? {
                        entityId: {
                          in: Array.from(seedEntityIds),
                        },
                      }
                    : undefined,
                ].filter(Boolean) as any[],
              },
            }),
          ])
        : [[], [], []];
    const seedAuthSessionIds = new Set(seedAuthSessions.map((session) => session.id));
    const seedAccountActionTokenIds = new Set(seedAccountActionTokens.map((token) => token.id));
    const seedAuditLogIds = new Set(seedAuditLogs.map((log) => log.id));

    const blockers: string[] = [];
    const activeAdminCount = users.filter(
      (user) => user.role === 'ADMIN' && String(user.status).toUpperCase() === 'ACTIVE',
    ).length;
    const activeSeedAdminCount = seedUsers.filter(
      (user) => user.role === 'ADMIN' && String(user.status).toUpperCase() === 'ACTIVE',
    ).length;

    if (actor?.actorUserId && seedUserIds.has(actor.actorUserId)) {
      blockers.push('The currently signed-in admin is part of the cleanup set. Remove that account from the seed dataset before running cleanup.');
    }

    if (seedUsers.some((user) => String(user.email ?? '').trim().toLowerCase() === protectedAdminEmail)) {
      blockers.push('The protected production admin account admin@projtrack.codes cannot be part of the cleanup set.');
    }

    if (activeSeedAdminCount > 0 && activeAdminCount - activeSeedAdminCount < 1) {
      blockers.push('Running this cleanup would remove the last active admin account.');
    }

    for (const subject of seedSubjects) {
      const teacherUserId = String(subject.teacher?.userId ?? '').trim();
      if (teacherUserId && !seedUserIds.has(teacherUserId)) {
        blockers.push(
          `Subject ${subject.code} (${subject.id}) is still assigned to a non-seed teacher and cannot be removed safely.`,
        );
      }

      const nonSeedEnrollments = subject.enrollments.filter(
        (enrollment) => !seedStudentProfileIds.has(enrollment.studentId),
      );
      if (nonSeedEnrollments.length > 0) {
        blockers.push(
          `Subject ${subject.code} (${subject.id}) still contains non-seed enrollments and cannot be removed safely.`,
        );
      }

      const nonSeedSubjectSections = subject.subjectSections.filter(
        (link) => !seedSectionIds.has(link.sectionId),
      );
      if (nonSeedSubjectSections.length > 0) {
        for (const link of nonSeedSubjectSections) {
          const section = sections.find((item) => item.id === link.sectionId);
          const evaluation = sectionSeedEvaluations.get(link.sectionId);
          blockers.push(
            `Subject ${subject.code} (${subject.id}) is linked to section ${section?.name ?? link.sectionId} (${link.sectionId}) via subject-section. ${this.seedCleanupSectionRelationSummary(section?.name ?? link.sectionId, link.sectionId, evaluation)}`,
          );
        }
      }

      const nonSeedSubjectGroups = groups.filter(
        (group) => group.subjectId === subject.id && !seedGroupIds.has(group.id),
      );
      if (nonSeedSubjectGroups.length > 0) {
        blockers.push(
          `Subject ${subject.code} (${subject.id}) still has groups linked to non-seed members or sections.`,
        );
      }
    }

    for (const group of groups) {
      if (!seedGroupIds.has(group.id)) {
        continue;
      }

      const nonSeedMembers = group.members.filter((member) => !seedUserIds.has(member.studentId));
      if (nonSeedMembers.length > 0) {
        blockers.push(
          `Group ${group.name} (${group.id}) includes non-seed members and cannot be removed safely.`,
        );
      }

      if (group.sectionId && !seedSectionIds.has(group.sectionId)) {
        const section = sections.find((item) => item.id === group.sectionId);
        const evaluation = sectionSeedEvaluations.get(group.sectionId);
        blockers.push(
          `Group ${group.name} (${group.id}) is linked to section ${section?.name ?? group.sectionId} (${group.sectionId}). ${this.seedCleanupSectionRelationSummary(section?.name ?? group.sectionId, group.sectionId, evaluation)}`,
        );
      }
    }

    for (const section of seedSections) {
      const nonSeedStudents = section.students.filter(
        (student) => !seedStudentProfileIds.has(student.id),
      );
      if (nonSeedStudents.length > 0) {
        blockers.push(
          `Section ${section.name} (${section.id}) still contains non-seed students and cannot be removed safely.`,
        );
      }

      const nonSeedSectionEnrollments = section.enrollments.filter(
        (enrollment) =>
          !seedStudentProfileIds.has(enrollment.studentId) || !seedSubjectIds.has(enrollment.subjectId),
      );
      if (nonSeedSectionEnrollments.length > 0) {
        blockers.push(
          `Section ${section.name} (${section.id}) still contains non-seed enrollments and cannot be removed safely.`,
        );
      }

      const nonSeedSectionGroups = section.groups.filter(
        (group) => !seedGroupIds.has(group.id),
      );
      if (nonSeedSectionGroups.length > 0) {
        blockers.push(
          `Section ${section.name} (${section.id}) still contains non-seed groups and cannot be removed safely.`,
        );
      }

      const nonSeedSectionSubjects = section.subjectSections.filter(
        (link) => !seedSubjectIds.has(link.subjectId),
      );
      if (nonSeedSectionSubjects.length > 0) {
        blockers.push(
          `Section ${section.name} (${section.id}) is still linked to non-seed subjects and cannot be removed safely.`,
        );
      }
    }

    for (const academicYearLevel of academicYearLevels) {
      if (!seedAcademicYearLevelIds.has(academicYearLevel.id)) {
        continue;
      }

      const nonSeedSections = academicYearLevel.sections.filter(
        (section) => !seedSectionIds.has(section.id),
      );
      if (nonSeedSections.length > 0) {
        blockers.push(
          `Academic year level ${academicYearLevel.name} (${academicYearLevel.id}) still includes non-seed sections.`,
        );
      }

      const nonSeedStudents = academicYearLevel.students.filter(
        (student) => !seedStudentProfileIds.has(student.id),
      );
      if (nonSeedStudents.length > 0) {
        blockers.push(
          `Academic year level ${academicYearLevel.name} (${academicYearLevel.id}) still includes non-seed students.`,
        );
      }
    }

    for (const academicYear of academicYears) {
      if (!seedAcademicYearIds.has(academicYear.id)) {
        continue;
      }

      const nonSeedSections = academicYear.sections.filter(
        (section) => !seedSectionIds.has(section.id),
      );
      if (nonSeedSections.length > 0) {
        blockers.push(
          `Academic year ${academicYear.name} (${academicYear.id}) still includes non-seed sections.`,
        );
      }

      const nonSeedStudents = academicYear.students.filter(
        (student) => !seedStudentProfileIds.has(student.id),
      );
      if (nonSeedStudents.length > 0) {
        blockers.push(
          `Academic year ${academicYear.name} (${academicYear.id}) still includes non-seed students.`,
        );
      }

      const nonSeedLevels = academicYear.levels.filter(
        (level) => !seedAcademicYearLevelIds.has(level.id),
      );
      if (nonSeedLevels.length > 0) {
        blockers.push(
          `Academic year ${academicYear.name} (${academicYear.id}) still includes non-seed year levels.`,
        );
      }
    }

    for (const department of seedDepartments) {
      const normalizedName = String(department.name ?? '').trim().toLowerCase();
      const nonSeedTeachers = users.filter(
        (user) =>
          String(user.teacherProfile?.department ?? '').trim().toLowerCase() === normalizedName &&
          !seedUserIds.has(user.id),
      );
      if (nonSeedTeachers.length > 0) {
        blockers.push(
          `Department ${department.name} (${department.id}) is still used by non-seed teachers and cannot be removed safely.`,
        );
      }
    }

    for (const user of seedUsers) {
      if (user.teacherProfile?.id) {
        const nonSeedSubjects = subjects.filter(
          (subject) =>
            subject.teacherId === user.teacherProfile?.id && !seedSubjectIds.has(subject.id),
        );
        if (nonSeedSubjects.length > 0) {
          blockers.push(
            `Teacher ${this.userName(user)} (${user.id}) is still assigned to non-seed subjects.`,
          );
        }
      }

      if (user.studentProfile?.id) {
        const nonSeedEnrollments = subjects.flatMap((subject) =>
          subject.enrollments.filter(
            (enrollment) =>
              enrollment.studentId === user.studentProfile?.id && !seedSubjectIds.has(subject.id),
          ),
        );
        if (nonSeedEnrollments.length > 0) {
          blockers.push(
            `Student ${this.userName(user)} (${user.id}) is still enrolled in non-seed subjects.`,
          );
        }
      }

      const nonSeedMemberships = groups.filter(
        (group) =>
          group.members.some((member) => member.studentId === user.id) &&
          !seedGroupIds.has(group.id),
      );
      if (nonSeedMemberships.length > 0) {
        blockers.push(
          `User ${this.userName(user)} (${user.id}) still belongs to non-seed groups.`,
        );
      }

      const nonSeedSubmissionRefs = submissions.filter(
        (submission) =>
          !seedSubmissionIds.has(submission.id) &&
          (submission.studentId === user.id ||
            submission.submittedById === user.id ||
            submission.reviewerId === user.id),
      );
      if (nonSeedSubmissionRefs.length > 0) {
        blockers.push(
          `User ${this.userName(user)} (${user.id}) is still referenced by non-seed submissions.`,
        );
      }

      const nonSeedSubmissionEvents = submissions
        .filter((submission) => !seedSubmissionIds.has(submission.id))
        .flatMap((submission) =>
          submission.events.filter((event) => event.actorUserId === user.id),
        );
      if (nonSeedSubmissionEvents.length > 0) {
        blockers.push(
          `User ${this.userName(user)} (${user.id}) is still referenced by non-seed submission events.`,
        );
      }
    }

    for (const submission of seedSubmissions) {
      if (submission.studentId && !seedUserIds.has(submission.studentId)) {
        blockers.push(
          `Submission ${submission.title} (${submission.id}) is still owned by a non-seed student.`,
        );
      }

      if (submission.submittedById && !seedUserIds.has(submission.submittedById)) {
        blockers.push(
          `Submission ${submission.title} (${submission.id}) is still linked to a non-seed submitter.`,
        );
      }

      if (submission.reviewerId && !seedUserIds.has(submission.reviewerId)) {
        blockers.push(
          `Submission ${submission.title} (${submission.id}) is still linked to a non-seed reviewer.`,
        );
      }

      if (submission.groupId && !seedGroupIds.has(submission.groupId)) {
        blockers.push(
          `Submission ${submission.title} (${submission.id}) is still linked to a non-seed group.`,
        );
      }

      const nonSeedActors = submission.events.filter(
        (event) => event.actorUserId && !seedUserIds.has(String(event.actorUserId)),
      );
      if (nonSeedActors.length > 0) {
        blockers.push(
          `Submission ${submission.title} (${submission.id}) still contains non-seed submission-event actors.`,
        );
      }
    }

    const uniqueBlockers = Array.from(new Set(blockers));
    const counts = {
      users: seedUsers.length,
      studentProfiles: seedUsers.filter((user) => user.studentProfile?.id).length,
      teacherProfiles: seedUsers.filter((user) => user.teacherProfile?.id).length,
      departments: seedDepartments.length,
      academicYears: seedAcademicYearIds.size,
      academicYearLevels: seedAcademicYearLevelIds.size,
      sections: seedSections.length,
      subjectSections: seedSubjectSectionIds.size,
      subjects: seedSubjects.length,
      enrollments: seedEnrollmentIds.size,
      groups: seedGroups.length,
      groupMembers: seedGroupMemberIds.size,
      activities: seedTasks.length,
      submissions: seedSubmissions.length,
      submissionEvents: seedSubmissionEventIds.size,
      submissionFiles: seedSubmissionFileIds.size,
      notifications: seedNotifications.length,
      announcements: seedAnnouncementIds.size,
      requests: seedRequestIds.size,
      mailJobs: seedEmailJobs.length,
      authSessions: seedAuthSessionIds.size,
      accountActionTokens: seedAccountActionTokenIds.size,
      auditLogs: seedAuditLogIds.size,
    };

    const countEntries = this.seedCleanupCountEntries(counts).filter(([, count]) => count > 0);
    const totalRecords = countEntries.reduce((sum, [, count]) => sum + count, 0);
    const cleanupEnabled = this.allowSeedCleanup();
    const production = this.isProductionRuntime();
    const productionOverride = this.allowProductionAdminToolRuns();

    const envWarnings: string[] = [];
    if (!cleanupEnabled) {
      envWarnings.push('Set ALLOW_SEED_DATA_CLEANUP=true before running the cleanup tool.');
    }
    if (production && !productionOverride) {
      envWarnings.push('Set ALLOW_PRODUCTION_ADMIN_TOOL_RUNS=true during a controlled maintenance window before running cleanup in production.');
    }

    const safeToExecute =
      totalRecords > 0 &&
      uniqueBlockers.length === 0 &&
      envWarnings.length === 0;

    const summary =
      totalRecords === 0
        ? 'Seed cleanup cannot run because seed records are not safely identifiable.'
        : uniqueBlockers.length > 0
          ? 'Seed cleanup is blocked because one or more candidate records are still linked to non-seed data.'
          : envWarnings.length > 0
            ? 'Seed cleanup preview is ready, but execution is blocked until the required environment flags are enabled.'
            : 'Seed cleanup preview is ready for execution.';

    return {
      summary,
      safeToExecute,
      totalRecords,
      nonZeroEntityCount: countEntries.length,
      confirmationWord: 'CLEAN SEED DATA',
      backupRequired: true,
      envGuards: {
        allowSeedDataCleanup: cleanupEnabled,
        production,
        allowProductionAdminToolRuns: production ? productionOverride : null,
      },
      counts,
      blockedReasons: uniqueBlockers,
      envWarnings,
      details: [
        'Create and verify a fresh database backup before any destructive cleanup.',
        'This tool removes only clearly identifiable demo, seed, or test records.',
        ...countEntries.map(
          ([label, count]) => `${this.toTitleWords(label)}: ${count}`,
        ),
        ...envWarnings,
        ...uniqueBlockers,
      ],
      executionDetails: countEntries.map(
        ([label, count]) => `${this.toTitleWords(label)} deleted: ${count}`,
      ),
      users: seedUsers.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        name: this.userName(user) || user.email,
        studentNumber: user.studentProfile?.studentNumber ?? null,
        employeeId: user.teacherProfile?.employeeId ?? null,
      })),
      departments: seedDepartments.map((department) => ({
        id: department.id,
        name: department.name,
        description: department.description ?? '',
      })),
      academicYears: academicYears
        .filter((year) => seedAcademicYearIds.has(year.id))
        .map((year) => ({
          id: year.id,
          name: year.name,
          status: year.status,
        })),
      academicYearLevels: academicYearLevels
        .filter((level) => seedAcademicYearLevelIds.has(level.id))
        .map((level) => ({
          id: level.id,
          name: level.name,
          academicYearId: level.academicYearId,
        })),
      sections: seedSections.map((section) => ({
        id: section.id,
        name: section.name,
        academicYearId: section.academicYearId ?? null,
        academicYearLevelId: section.academicYearLevelId ?? null,
      })),
      subjects: seedSubjects.map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
      })),
      subjectSections: seedSubjectSections.map((link) => ({
        id: link.id,
        subjectId: link.subjectId,
        sectionId: link.sectionId,
      })),
      tasks: seedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        subjectId: task.subjectId,
      })),
      enrollments: seedEnrollments.map((enrollment) => ({
        id: enrollment.id,
        studentId: enrollment.studentId,
        subjectId: enrollment.subjectId,
        sectionId: enrollment.sectionId ?? null,
      })),
      groups: seedGroups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        subjectId: group.subjectId,
      })),
      groupMembers: seedGroupMembers.map((member) => ({
        id: member.id,
        groupId: member.groupId,
        subjectId: member.subjectId,
        studentId: member.studentId,
      })),
      submissions: seedSubmissions.map((submission) => ({
        id: submission.id,
        title: submission.title,
        studentId: submission.studentId ?? null,
        groupId: submission.groupId ?? null,
        subjectId: submission.subjectId,
      })),
      submissionEvents: seedSubmissionEvents.map((event) => ({
        id: event.id,
        submissionId: event.submissionId,
        actorUserId: event.actorUserId ?? null,
        action: event.action,
      })),
      notifications: seedNotifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
      })),
      announcements: seedAnnouncements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        status: announcement.status,
      })),
      requests: seedRequests.map((request) => ({
        id: request.id,
        requester: request.requester,
        type: request.type,
        subject: request.subject,
      })),
      mailJobs: seedEmailJobs.map((job) => ({
        id: job.id,
        email: job.userEmail,
        idempotencyKey: job.idempotencyKey ?? null,
      })),
      authSessions: seedAuthSessions.map((session) => ({
        id: session.id,
        userId: session.userId,
      })),
      accountActionTokens: seedAccountActionTokens.map((token) => ({
        id: token.id,
        userId: token.userId,
        type: token.type,
      })),
      auditLogs: seedAuditLogs.map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId ?? null,
        entityId: log.entityId ?? null,
        action: log.action,
        module: log.module,
      })),
      submissionFiles: seedSubmissionFiles.map((file) => ({
        id: file.id,
        relativePath: file.relativePath,
      })),
      protectedAdminStillActive: users.some(
        (user) =>
          String(user.email ?? '').trim().toLowerCase() === protectedAdminEmail &&
          user.role === 'ADMIN' &&
          String(user.status).toUpperCase() === 'ACTIVE',
      ),
      userIds: seedUsers.map((user) => user.id),
      studentProfileIds: Array.from(seedStudentProfileIds),
      teacherProfileIds: Array.from(seedTeacherProfileIds),
      departmentIds: Array.from(seedDepartmentIds),
      academicYearIds: Array.from(seedAcademicYearIds),
      academicYearLevelIds: Array.from(seedAcademicYearLevelIds),
      sectionIds: Array.from(seedSectionIds),
      subjectIds: Array.from(seedSubjectIds),
      subjectSectionIds: Array.from(seedSubjectSectionIds),
      enrollmentIds: Array.from(seedEnrollmentIds),
      taskIds: Array.from(seedTaskIds),
      groupIds: Array.from(seedGroupIds),
      groupMemberIds: Array.from(seedGroupMemberIds),
      submissionIds: Array.from(seedSubmissionIds),
      submissionEventIds: Array.from(seedSubmissionEventIds),
      submissionFileIds: Array.from(seedSubmissionFileIds),
      notificationIds: Array.from(seedNotificationIds),
      announcementIds: Array.from(seedAnnouncementIds),
      requestIds: Array.from(seedRequestIds),
      mailJobIds: Array.from(seedMailJobIds),
      authSessionIds: Array.from(seedAuthSessionIds),
      accountActionTokenIds: Array.from(seedAccountActionTokenIds),
      auditLogIds: Array.from(seedAuditLogIds),
    };
  }

  // ───── Seed cleanup helpers ─────

  private isSeedUserCandidate(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    status?: string | null;
    studentProfile?: { studentNumber?: string | null } | null;
    teacherProfile?: { employeeId?: string | null } | null;
  }) {
    const email = String(user.email ?? '').trim().toLowerCase();
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();

    if (this.isSeedEmailAddress(email)) {
      return true;
    }

    if (this.isLikelyTestGmailUser(user)) {
      return true;
    }

    return /^(demo|seed|test|sample)\b/.test(fullName);
  }

  private isSeedEmailAddress(email?: string | null) {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized || normalized === 'admin@projtrack.codes') {
      return false;
    }

    const localPart = normalized.split('@')[0] ?? '';
    const domain = normalized.split('@')[1] ?? '';
    if (!localPart || !domain) {
      return false;
    }

    if (
      domain === 'projtrack.local' ||
      domain.endsWith('.test') ||
      domain.endsWith('.example')
    ) {
      return true;
    }

    if (/^(demo|seed|test|sample)[._-]?/.test(localPart)) {
      return true;
    }

    return domain === 'gmail.com' && /(?:^|[+._-])(demo|seed|test|sample)(?:$|[+._-]|\d)/.test(localPart);
  }

  private isLikelyTestGmailUser(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    status?: string | null;
    studentProfile?: { studentNumber?: string | null } | null;
    teacherProfile?: { employeeId?: string | null } | null;
  }) {
    const email = String(user.email ?? '').trim().toLowerCase();
    const localPart = email.split('@')[0] ?? '';
    const domain = email.split('@')[1] ?? '';
    if (domain !== 'gmail.com') {
      return false;
    }

    if (/[+._-](projtrack|reset|demo|seed|test|sample)(?:$|[+._-]|\d)/i.test(localPart)) {
      return true;
    }

    const firstName = String(user.firstName ?? '').trim().toLowerCase();
    const lastName = String(user.lastName ?? '').trim().toLowerCase();
    const placeholderName = (value: string) =>
      /^(asd[a-z0-9]*|test[a-z0-9]*|demo[a-z0-9]*|sample[a-z0-9]*|seed[a-z0-9]*|manual|reset)$/i.test(value);
    const studentNumber = String(user.studentProfile?.studentNumber ?? '').trim().toLowerCase();
    const employeeId = String(user.teacherProfile?.employeeId ?? '').trim().toLowerCase();

    if (/^(manual-reset-|test-|demo-|sample-|seed-)/i.test(studentNumber)) {
      return true;
    }

    if (/^(test-|demo-|sample-|seed-)/i.test(employeeId)) {
      return true;
    }

    return (
      String(user.role ?? '').toUpperCase() === 'STUDENT' &&
      (String(user.status ?? '').toUpperCase() === 'PENDING_SETUP' ||
        String(user.status ?? '').toUpperCase() === 'PENDING_ACTIVATION' ||
        String(user.status ?? '').toUpperCase() === 'ACTIVE') &&
      placeholderName(firstName) &&
      placeholderName(lastName)
    );
  }

  private isSeedLabel(value?: string | null) {
    return /(?:^|[\s._-])(demo|seed|test|sample)(?:[\s._-]|$)/i.test(
      String(value ?? '').trim(),
    );
  }

  private isExactSeedAnnouncementCandidate(announcement: {
    title?: string | null;
    body?: string | null;
  }) {
    return (
      String(announcement.title ?? '').trim().toLowerCase() === 'midterm review week' &&
      String(announcement.body ?? '').trim().toLowerCase() ===
        'please check your subject deadlines this week.'
    );
  }

  private isExactSeedRequestCandidate(request: {
    requester?: string | null;
    type?: string | null;
    subject?: string | null;
    details?: string | null;
  }) {
    return (
      String(request.requester ?? '').trim().toLowerCase() === 'maria santos' &&
      String(request.type ?? '').trim().toLowerCase() === 'late submission appeal' &&
      String(request.subject ?? '').trim().toLowerCase() === 'capstone project' &&
      String(request.details ?? '').trim().toLowerCase() ===
        'requesting allowance for late submission of chapter 2.'
    );
  }

  private seedCleanupCountEntries(counts: Record<string, number>) {
    const orderedKeys = [
      'users',
      'studentProfiles',
      'teacherProfiles',
      'departments',
      'academicYears',
      'academicYearLevels',
      'sections',
      'subjectSections',
      'subjects',
      'enrollments',
      'groups',
      'groupMembers',
      'activities',
      'submissions',
      'submissionEvents',
      'submissionFiles',
      'notifications',
      'announcements',
      'requests',
      'mailJobs',
      'authSessions',
      'accountActionTokens',
      'auditLogs',
    ] as const;

    return orderedKeys.map((key) => [key, Number(counts[key] ?? 0)] as const);
  }

  private seedCleanupSectionRelationSummary(
    sectionName: string,
    sectionId: string,
    evaluation?: {
      relationKind: 'demo-only' | 'mixed' | 'real-only' | 'unlinked';
      relationCounts: {
        students: { demo: number; real: number };
        enrollmentStudents: { demo: number; real: number };
        enrollmentSubjects: { demo: number; real: number };
        groups: { demo: number; real: number };
        subjectSections: { demo: number; real: number };
      };
    },
  ) {
    if (!evaluation) {
      return `Section ${sectionName} (${sectionId}) could not be classified safely.`;
    }

    const totals = summarizeSeedRelationCounts(evaluation.relationCounts);
    return `Section relation state: ${describeSeedRelationKind(evaluation.relationKind)}. Demo-linked refs: ${totals.demo}. Real-linked refs: ${totals.real}.`;
  }

  private userName(user: { firstName?: string | null; lastName?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private toTitleWords(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  // ───── Environment guards ─────

  private isProductionRuntime(): boolean {
    return [process.env.NODE_ENV, process.env.APP_ENV]
      .some((value) => String(value ?? '').toLowerCase() === 'production');
  }

  private allowSeedCleanup(): boolean {
    return String(process.env.ALLOW_SEED_DATA_CLEANUP ?? 'false').toLowerCase() === 'true';
  }

  private allowProductionAdminToolRuns(): boolean {
    return String(process.env.ALLOW_PRODUCTION_ADMIN_TOOL_RUNS ?? 'false').toLowerCase() === 'true';
  }

  private async assertAdminRateLimit(
    action: string,
    actor?: AdminActorContext,
    targetKey?: string,
    options?: { limit?: number; windowMs?: number; blockMs?: number },
  ) {
    const limit = Math.max(1, Number(options?.limit ?? process.env.ADMIN_ACTION_MAX_PER_HOUR ?? 30));
    const windowMs = Math.max(60_000, Number(options?.windowMs ?? 60 * 60 * 1000));
    const blockMs = Math.max(60_000, Number(options?.blockMs ?? 60 * 60 * 1000));
    const key = [
      actor?.actorUserId || actor?.ipAddress || 'unknown-admin',
      String(targetKey ?? 'global').trim().toLowerCase() || 'global',
    ].join('|');
    const rateAction = `admin:${String(action || 'action').trim().toLowerCase() || 'action'}`;
    const now = new Date();

    const existing = await this.prisma.authRateLimit.findUnique({
      where: { action_key: { action: rateAction, key } },
    });

    if (existing?.blockedUntil && existing.blockedUntil.getTime() > now.getTime()) {
      throw new HttpException('Too many admin actions. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!existing || existing.firstAttemptAt.getTime() + windowMs <= now.getTime()) {
      await this.prisma.authRateLimit.upsert({
        where: { action_key: { action: rateAction, key } },
        update: {
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          blockedUntil: null,
        },
        create: {
          action: rateAction,
          key,
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        },
      });
      return;
    }

    if (existing.attempts >= limit) {
      await this.prisma.authRateLimit.update({
        where: { action_key: { action: rateAction, key } },
        data: {
          lastAttemptAt: now,
          blockedUntil: new Date(now.getTime() + blockMs),
        },
      });
      throw new HttpException('Too many admin actions. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.authRateLimit.update({
      where: { action_key: { action: rateAction, key } },
      data: {
        attempts: existing.attempts + 1,
        lastAttemptAt: now,
      },
    });
  }

  downloadSystemToolArtifact(path: string) {
    return this.systemToolsRepository.resolveSystemToolArtifact(path);
  }

  async importSystemToolBackup(fileName: string, contentBase64: string) {
    const response = this.systemToolsRepository.importBackupArtifact({ fileName, contentBase64 });
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'IMPORT',
      module: 'System Tools',
      target: response.title,
      result: 'Success',
      details: response.summary,
    });
    return response;
  }
}
