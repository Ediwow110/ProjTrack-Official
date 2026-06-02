import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectRepository } from './subject.repository';
import { SubmissionRepository } from './submission.repository';
import { UserRepository } from './user.repository';
import { isPendingReviewStatus } from '../access/policies/submission-access.policy';

const REPORTING_LIST_TAKE = 5000;

@Injectable()
export class AdminReportsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly submissionRepository: SubmissionRepository,
    private readonly subjectRepository: SubjectRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async summary(section?: string, subjectId?: string) {
    const dbWhere: any = {};
    if (subjectId) dbWhere.subjectId = subjectId;

    // Section filter requires in-memory resolution because section is on User/StudentProfile, not Submission
    if (section) {
      const rows = await this.currentView(undefined, subjectId);
      const filtered = rows.filter((r: any) => r.section === section);
      return this.computeSummaryFromRows(filtered);
    }

    // DB-side aggregates – no truncation, no section filter
    const [total, graded, pending, late] = await Promise.all([
      this.prisma.submission.count({ where: dbWhere }),
      this.prisma.submission.count({ where: { ...dbWhere, status: 'GRADED' } }),
      this.prisma.submission.count({
        where: { ...dbWhere, status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'LATE'] } },
      }),
      this.prisma.submission.count({ where: { ...dbWhere, status: 'LATE' } }),
    ]);

    // Per-subject breakdown via groupBy (three passes, merged into a map)
    const [bySubjectTotal, bySubjectGraded, bySubjectPending] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ['subjectId'],
        where: dbWhere,
        _count: { id: true },
      }),
      this.prisma.submission.groupBy({
        by: ['subjectId'],
        where: { ...dbWhere, status: 'GRADED' },
        _count: { id: true },
      }),
      this.prisma.submission.groupBy({
        by: ['subjectId'],
        where: { ...dbWhere, status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'LATE'] } },
        _count: { id: true },
      }),
    ]);

    // Merge groupBy results
    const gradedMap = new Map(bySubjectGraded.map((g) => [g.subjectId, g._count.id]));
    const pendingMap = new Map(bySubjectPending.map((g) => [g.subjectId, g._count.id]));

    // Batch-fetch subject names
    const subjectIds = [...new Set(bySubjectTotal.map((g) => g.subjectId))];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    const bySubject = bySubjectTotal.map((group) => ({
      subjectId: group.subjectId,
      subject: subjectNameMap.get(group.subjectId) ?? group.subjectId,
      submissions: group._count.id,
      graded: gradedMap.get(group.subjectId) ?? 0,
      pendingReview: pendingMap.get(group.subjectId) ?? 0,
    }));

    return {
      totalSubmissions: total,
      completionRate: total ? Math.round(((graded + pending) / total) * 100) : 0,
      pendingReviews: pending,
      lateRate: total ? Math.round((late / total) * 100) : 0,
      bySubject,
    };
  }

  async currentView(section?: string, subjectId?: string) {
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;

    const rows = await this.prisma.submission.findMany({
      where,
      take: REPORTING_LIST_TAKE,
      include: {
        subject: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentProfile: {
              select: {
                section: { select: { name: true } },
              },
            },
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            leaderId: true,
            members: {
              select: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentProfile: {
                      select: {
                        section: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filtered: any[] = [];

    for (const row of rows) {
      const subjectName = row.subject?.name ?? row.subjectId ?? 'Subject';

      // Resolve owner name
      let ownerName = '';
      if (row.student) {
        ownerName = `${row.student.firstName} ${row.student.lastName}`;
      } else if (row.group) {
        ownerName = row.group.name;
      }

      // Resolve section via student profile or group leader
      let resolvedSection = '';
      if (row.student?.studentProfile?.section?.name) {
        resolvedSection = row.student.studentProfile.section.name;
      } else if (row.group) {
        const leaderMember = row.group.members?.find(
          (m: any) => m.student?.id === row.group!.leaderId,
        );
        const sectionSource =
          leaderMember?.student?.studentProfile?.section?.name ??
          row.group.members?.[0]?.student?.studentProfile?.section?.name;
        if (sectionSource) resolvedSection = sectionSource;
      }

      if (section && resolvedSection !== section) continue;

      filtered.push({
        id: row.id,
        title: row.title,
        subjectId: row.subjectId,
        subject: subjectName,
        section: resolvedSection,
        status: row.status,
        grade: row.grade ?? null,
        submittedAt: row.submittedAt ?? null,
        owner: ownerName,
      });
    }

    return filtered;
  }

  async exportCsv(section?: string, subjectId?: string) {
    const rows = await this.currentView(section, subjectId);
    const header = ['id', 'title', 'subject', 'section', 'status', 'grade', 'submittedAt', 'owner'];
    const csv = [header.join(','), ...rows.map((row: any) => header.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    return { filename: 'admin-report-export.csv', csv };
  }

  async reportBundle(section?: string, subjectId?: string) {
    const summary = await this.summary(section, subjectId);
    const rows = await this.currentView(section, subjectId);

    const metrics = [
      {
        label: 'Total Submissions',
        value: String(summary.totalSubmissions),
        delta: summary.totalSubmissions ? 'active records' : 'no records',
        good: true,
      },
      {
        label: 'Completion Rate',
        value: `${summary.completionRate}%`,
        delta: 'graded + pending review',
        good: summary.completionRate >= 70,
      },
      {
        label: 'Pending Reviews',
        value: String(summary.pendingReviews),
        delta: 'teacher action',
        good: summary.pendingReviews <= 10,
      },
      {
        label: 'Late Rate',
        value: `${summary.lateRate}%`,
        delta: 'late submissions',
        good: summary.lateRate <= 20,
      },
    ];

    const completionData = summary.bySubject.map((item: any) => ({
      name: item.subject,
      rate: item.submissions ? Math.round(((item.graded + item.pendingReview) / item.submissions) * 100) : 0,
    }));

    const monthBuckets = new Map<string, { month: string; late: number; days: number; count: number }>();
    for (const row of rows) {
      const stamp = row.submittedAt ? new Date(row.submittedAt) : new Date();
      const month = stamp.toLocaleDateString('en-US', { month: 'short' });
      if (!monthBuckets.has(month)) {
        monthBuckets.set(month, { month, late: 0, days: 0, count: 0 });
      }
      const bucket = monthBuckets.get(month)!;
      bucket.count += 1;
      if (row.status === 'LATE') bucket.late += 1;
      bucket.days += row.status === 'GRADED' ? 2 : 1;
    }

    const lateData = Array.from(monthBuckets.values()).map((item) => ({
      month: item.month,
      late: item.late,
    }));

    const turnaroundData = Array.from(monthBuckets.values()).map((item) => ({
      month: item.month,
      days: item.count ? Math.round((item.days / item.count) * 10) / 10 : 0,
    }));

    const tableRows = summary.bySubject.map((item: any) => ({
      subject: item.subject,
      section: section || 'All Sections',
      completionRate: `${item.submissions ? Math.round(((item.graded + item.pendingReview) / item.submissions) * 100) : 0}%`,
      pending: item.pendingReview,
      graded: item.graded,
      avgReview: 'Event history required',
    }));

    return {
      metrics,
      completionData,
      lateData,
      turnaroundData,
      tableRows,
    };
  }

  private computeSummaryFromRows(rows: any[]) {
    const total = rows.length;
    const graded = rows.filter((row: any) => row.status === 'GRADED').length;
    const pending = rows.filter((row: any) => isPendingReviewStatus(row.status)).length;
    const late = rows.filter((row: any) => row.status === 'LATE').length;
    const bySubjectMap = new Map<string, { subjectId: string; subject: string; submissions: number; graded: number; pendingReview: number }>();

    for (const row of rows) {
      const key = row.subjectId || row.subject;
      if (!bySubjectMap.has(key)) {
        bySubjectMap.set(key, {
          subjectId: row.subjectId || key,
          subject: row.subject,
          submissions: 0,
          graded: 0,
          pendingReview: 0,
        });
      }
      const bucket = bySubjectMap.get(key)!;
      bucket.submissions += 1;
      if (row.status === 'GRADED') bucket.graded += 1;
      if (isPendingReviewStatus(row.status)) bucket.pendingReview += 1;
    }

    return {
      totalSubmissions: total,
      completionRate: total ? Math.round(((graded + pending) / total) * 100) : 0,
      pendingReviews: pending,
      lateRate: total ? Math.round((late / total) * 100) : 0,
      bySubject: Array.from(bySubjectMap.values()),
    };
  }
}
