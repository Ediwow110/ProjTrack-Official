import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PrismaService } from '../prisma/prisma.service';
import { PENDING_REVIEW_STATUSES } from '../access/policies/submission-access.policy';

const DASHBOARD_DEADLINE_LIMIT = 50;
const DASHBOARD_ACTIVITY_LIMIT = 10;
const pendingReviewStatuses = [...PENDING_REVIEW_STATUSES];
const studentPendingStatuses = ['NOT_STARTED', 'DRAFT', 'NEEDS_REVISION', ...pendingReviewStatuses];
const studentSubmittedStatuses = ['GRADED', ...pendingReviewStatuses];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  private requireAuthenticatedUserId(userId: string | undefined, roleLabel: string) {
    const normalized = String(userId || '').trim();
    if (!normalized) {
      throw new UnauthorizedException(`Authenticated ${roleLabel.toLowerCase()} context is required.`);
    }
    return normalized;
  }

  private async resolveTeacherProfileId(teacherId: string) {
    const direct = await this.prisma.teacherProfile.findUnique({ where: { id: teacherId }, select: { id: true } });
    if (direct) return direct.id;
    const byUser = await this.prisma.teacherProfile.findUnique({ where: { userId: teacherId }, select: { id: true } });
    return byUser?.id ?? teacherId;
  }

  private async resolveStudentProfileId(userId: string) {
    const direct = await this.prisma.studentProfile.findUnique({ where: { id: userId }, select: { id: true } });
    if (direct) return direct.id;
    const byUser = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    return byUser?.id ?? userId;
  }

  private submissionOwnerWhere(userId: string) {
    return {
      OR: [{ studentId: userId }, { group: { members: { some: { studentId: userId } } } }],
    };
  }

  async studentSummary(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const ownerWhere = this.submissionOwnerWhere(studentUserId);
    const [pending, submitted, graded, overdue] = await Promise.all([
      this.prisma.submission.count({
        where: { ...ownerWhere, status: { in: studentPendingStatuses } },
      }),
      this.prisma.submission.count({
        where: { ...ownerWhere, status: { in: studentSubmittedStatuses } },
      }),
      this.prisma.submission.count({ where: { ...ownerWhere, status: 'GRADED' } }),
      this.prisma.submission.count({ where: { ...ownerWhere, status: 'LATE' } }),
    ]);
    return { pending, submitted, graded, overdue };
  }

  async studentCharts(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const studentProfileId = await this.resolveStudentProfileId(studentUserId);
    const ownerWhere = this.submissionOwnerWhere(studentUserId);

    const [draft, pendingReview, needsRevision, graded, subjects] = await Promise.all([
      this.prisma.submission.count({ where: { ...ownerWhere, status: 'DRAFT' } }),
      this.prisma.submission.count({ where: { ...ownerWhere, status: { in: pendingReviewStatuses } } }),
      this.prisma.submission.count({ where: { ...ownerWhere, status: 'NEEDS_REVISION' } }),
      this.prisma.submission.count({ where: { ...ownerWhere, status: 'GRADED' } }),
      this.prisma.subject.findMany({
        where: { enrollments: { some: { studentId: studentProfileId } } },
        select: { id: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    const subjectProgress = await Promise.all(
      subjects.map(async (subject) => {
        const [totalActivities, completed] = await Promise.all([
          this.prisma.submissionTask.count({ where: { subjectId: subject.id } }),
          this.prisma.submission.count({
            where: {
              ...ownerWhere,
              subjectId: subject.id,
              status: { in: studentSubmittedStatuses },
            },
          }),
        ]);
        return { subject: subject.name, totalActivities, completed };
      }),
    );

    return {
      statusBreakdown: { draft, pendingReview, needsRevision, graded },
      subjectProgress,
    };
  }

  async upcomingDeadlines(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const studentProfileId = await this.resolveStudentProfileId(studentUserId);
    const activities = await this.prisma.submissionTask.findMany({
      where: {
        subject: { enrollments: { some: { studentId: studentProfileId } } },
        deadline: { not: null },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        subjectId: true,
        isOpen: true,
        windowStatus: true,
      },
      orderBy: { deadline: 'asc' },
      take: DASHBOARD_DEADLINE_LIMIT,
    });
    return activities.map((activity: any) => ({
      id: activity.id,
      title: activity.title,
      deadline: activity.deadline,
      subjectId: activity.subjectId,
      windowStatus: activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED'),
    }));
  }

  async teacherSummary(teacherId?: string) {
    const teacherUserId = this.requireAuthenticatedUserId(teacherId, 'teacher');
    const teacherProfileId = await this.resolveTeacherProfileId(teacherUserId);
    const teacherSubmissionWhere = { task: { subject: { teacherId: teacherProfileId } } };
    const [subjects, pendingReviews, graded, needsRevision] = await Promise.all([
      this.prisma.subject.count({ where: { teacherId: teacherProfileId } }),
      this.prisma.submission.count({
        where: { ...teacherSubmissionWhere, status: { in: pendingReviewStatuses } },
      }),
      this.prisma.submission.count({ where: { ...teacherSubmissionWhere, status: 'GRADED' } }),
      this.prisma.submission.count({ where: { ...teacherSubmissionWhere, status: 'NEEDS_REVISION' } }),
    ]);
    return { subjects, pendingReviews, graded, needsRevision };
  }

  async adminSummary() {
    const [totalStudents, totalTeachers, totalSubjects, totalSubmissions, pendingReviews] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.subject.count(),
      this.prisma.submission.count(),
      this.prisma.submission.count({ where: { status: { in: pendingReviewStatuses } } }),
    ]);
    return { totalStudents, totalTeachers, totalSubjects, totalSubmissions, pendingReviews };
  }

  async adminActivity() {
    return this.auditLogRepository.listAuditLogs({ take: DASHBOARD_ACTIVITY_LIMIT });
  }
}
