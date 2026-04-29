import { Injectable } from '@nestjs/common';
import { SubjectRepository } from './subject.repository';
import { SubmissionRepository } from './submission.repository';
import { UserRepository } from './user.repository';
import { isPendingReviewStatus } from '../access/policies/submission-access.policy';

@Injectable()
export class AdminReportsRepository {
  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly subjectRepository: SubjectRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async summary(section?: string, subjectId?: string) {
    const rows = await this.currentView(section, subjectId);
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

  async currentView(section?: string, subjectId?: string) {
    const rows: any[] = await this.submissionRepository.listSubmissions();
    const filtered: any[] = [];

    for (const row of rows) {
      const subject: any = row.subjectId ? await this.subjectRepository.findSubjectById(row.subjectId) : null;
      const ownerName = row.studentUserId || row.studentId
        ? await this.userName(row.studentUserId || row.studentId)
        : await this.groupName(row.groupId, subject?.id);
      const resolvedSection = await this.resolveSection(row, subject?.id);
      const subjectName = subject?.name ?? row.subjectId ?? 'Subject';

      if (section && resolvedSection !== section) continue;
      if (subjectId && row.subjectId !== subjectId) continue;

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

  private async resolveSection(row: any, subjectId?: string) {
    const studentId = row.studentUserId || row.studentId;
    if (studentId) {
      const user: any = await this.userRepository.findById(studentId);
      return user?.section ?? user?.studentProfile?.section?.name ?? '';
    }

    if (row.groupId && subjectId) {
      const groups: any[] = await this.subjectRepository.listGroupsBySubject(subjectId);
      const group = groups.find((item: any) => item.id === row.groupId);
      const leaderId = group?.leaderUserId || group?.leaderId || group?.memberUserIds?.[0] || group?.members?.[0]?.studentId;
      if (leaderId) {
        const leader: any = await this.userRepository.findById(leaderId);
        return leader?.section ?? leader?.studentProfile?.section?.name ?? '';
      }
    }

    return '';
  }

  private async userName(userId?: string) {
    if (!userId) return '';
    const user: any = await this.userRepository.findById(userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  }

  private async groupName(groupId?: string, subjectId?: string) {
    if (!groupId || !subjectId) return '';
    const groups: any[] = await this.subjectRepository.listGroupsBySubject(subjectId);
    return groups.find((group: any) => group.id === groupId)?.name ?? groupId;
  }
}


