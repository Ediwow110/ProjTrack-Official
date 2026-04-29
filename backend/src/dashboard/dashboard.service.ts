import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { UserRepository } from '../repositories/user.repository';
import { isPendingReviewStatus } from '../access/policies/submission-access.policy';

@Injectable()
export class DashboardService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subjectRepository: SubjectRepository,
    private readonly submissionRepository: SubmissionRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  private requireAuthenticatedUserId(userId: string | undefined, roleLabel: string) {
    const normalized = String(userId || '').trim();
    if (!normalized) {
      throw new UnauthorizedException(`Authenticated ${roleLabel.toLowerCase()} context is required.`);
    }
    return normalized;
  }

  async studentSummary(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const mine: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId);
    return {
      pending: mine.filter((submission) => ['NOT_STARTED', 'DRAFT', 'NEEDS_REVISION'].includes(submission.status) || isPendingReviewStatus(submission.status)).length,
      submitted: mine.filter((submission) => ['GRADED'].includes(submission.status) || isPendingReviewStatus(submission.status)).length,
      graded: mine.filter((submission) => submission.status === 'GRADED').length,
      overdue: mine.filter((submission) => submission.status === 'LATE').length,
    };
  }

  async studentCharts(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const mine: any[] = await this.submissionRepository.listStudentSubmissions(studentUserId);
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(studentUserId);
    return {
      statusBreakdown: {
        draft: mine.filter((submission) => submission.status === 'DRAFT').length,
        pendingReview: mine.filter((submission) => isPendingReviewStatus(submission.status)).length,
        needsRevision: mine.filter((submission) => submission.status === 'NEEDS_REVISION').length,
        graded: mine.filter((submission) => submission.status === 'GRADED').length,
      },
      subjectProgress: await Promise.all(subjects.map(async (subject: any) => {
        const activities = await this.subjectRepository.listActivitiesBySubject(subject.id);
        return {
          subject: subject.name,
          totalActivities: activities.length,
          completed: mine.filter((submission) => submission.subjectId === subject.id && (['GRADED'].includes(submission.status) || isPendingReviewStatus(submission.status))).length,
        };
      })),
    };
  }

  async upcomingDeadlines(userId?: string) {
    const studentUserId = this.requireAuthenticatedUserId(userId, 'student');
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(studentUserId);
    const allActivities = (await Promise.all(subjects.map((subject: any) => this.subjectRepository.listActivitiesBySubject(subject.id)))).flat();
    return allActivities.map((activity: any) => ({
      id: activity.id,
      title: activity.title,
      deadline: activity.deadline,
      subjectId: activity.subjectId,
      windowStatus: activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED'),
    }));
  }

  async teacherSummary(teacherId?: string) {
    const teacherUserId = this.requireAuthenticatedUserId(teacherId, 'teacher');
    const subjects: any[] = await this.subjectRepository.listSubjectsForTeacher(teacherUserId);
    const relevant: any[] = await this.submissionRepository.listTeacherSubmissions({ teacherId: teacherUserId });
    return {
      subjects: subjects.length,
      pendingReviews: relevant.filter((submission) => isPendingReviewStatus(submission.status)).length,
      graded: relevant.filter((submission) => submission.status === 'GRADED').length,
      needsRevision: relevant.filter((submission) => submission.status === 'NEEDS_REVISION').length,
    };
  }

  async adminSummary() {
    const students: any[] = await this.userRepository.listByRole('STUDENT');
    const teachers: any[] = await this.userRepository.listByRole('TEACHER');
    const subjects: any[] = await this.subjectRepository.listSubjects();
    const submissions: any[] = await this.submissionRepository.listSubmissions();
    return {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalSubjects: subjects.length,
      totalSubmissions: submissions.length,
      pendingReviews: submissions.filter((submission) => isPendingReviewStatus(submission.status)).length,
    };
  }

  async adminActivity() {
    const logs: any[] = await this.auditLogRepository.listAuditLogs();
    return logs.slice(0, 10);
  }
}
