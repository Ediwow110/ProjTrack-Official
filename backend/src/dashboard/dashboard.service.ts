import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class DashboardService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subjectRepository: SubjectRepository,
    private readonly submissionRepository: SubmissionRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async studentSummary(userId = 'usr_student_1') {
    const mine: any[] = await this.submissionRepository.listStudentSubmissions(userId);
    return {
      pending: mine.filter((submission) => ['NOT_STARTED', 'DRAFT', 'PENDING_REVIEW', 'NEEDS_REVISION'].includes(submission.status)).length,
      submitted: mine.filter((submission) => ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'].includes(submission.status)).length,
      graded: mine.filter((submission) => submission.status === 'GRADED').length,
      overdue: mine.filter((submission) => submission.status === 'LATE').length,
    };
  }

  async studentCharts(userId = 'usr_student_1') {
    const mine: any[] = await this.submissionRepository.listStudentSubmissions(userId);
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(userId);
    return {
      statusBreakdown: {
        draft: mine.filter((submission) => submission.status === 'DRAFT').length,
        pendingReview: mine.filter((submission) => submission.status === 'PENDING_REVIEW').length,
        needsRevision: mine.filter((submission) => submission.status === 'NEEDS_REVISION').length,
        graded: mine.filter((submission) => submission.status === 'GRADED').length,
      },
      subjectProgress: await Promise.all(subjects.map(async (subject: any) => {
        const activities = await this.subjectRepository.listActivitiesBySubject(subject.id);
        return {
          subject: subject.name,
          totalActivities: activities.length,
          completed: mine.filter((submission) => submission.subjectId === subject.id && ['PENDING_REVIEW', 'GRADED', 'SUBMITTED'].includes(submission.status)).length,
        };
      })),
    };
  }

  async upcomingDeadlines(userId = 'usr_student_1') {
    const subjects: any[] = await this.subjectRepository.listSubjectsForStudent(userId);
    const allActivities = (await Promise.all(subjects.map((subject: any) => this.subjectRepository.listActivitiesBySubject(subject.id)))).flat();
    return allActivities.map((activity: any) => ({
      id: activity.id,
      title: activity.title,
      deadline: activity.deadline,
      subjectId: activity.subjectId,
      windowStatus: activity.windowStatus ?? (activity.isOpen ? 'OPEN' : 'CLOSED'),
    }));
  }

  async teacherSummary(teacherId = 'usr_teacher_1') {
    const subjects: any[] = await this.subjectRepository.listSubjectsForTeacher(teacherId);
    const relevant: any[] = await this.submissionRepository.listTeacherSubmissions({ teacherId });
    return {
      subjects: subjects.length,
      pendingReviews: relevant.filter((submission) => submission.status === 'PENDING_REVIEW').length,
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
      pendingReviews: submissions.filter((submission) => submission.status === 'PENDING_REVIEW').length,
    };
  }

  async adminActivity() {
    const logs: any[] = await this.auditLogRepository.listAuditLogs();
    return logs.slice(0, 10);
  }
}
