import { readFileSync } from 'fs';
import { join } from 'path';

describe('dashboard static bounds guard', () => {
  const dashboardSource = readFileSync(
    join(process.cwd(), 'src', 'dashboard', 'dashboard.service.ts'),
    'utf8',
  );

  it('does not compute dashboard summary counts from repository list arrays', () => {
    expect(dashboardSource).not.toContain('submissionRepository.listStudentSubmissions(');
    expect(dashboardSource).not.toContain('submissionRepository.listTeacherSubmissions(');
    expect(dashboardSource).not.toContain('submissionRepository.listSubmissions(');
    expect(dashboardSource).not.toContain('subjectRepository.listSubjectsForTeacher(');
    expect(dashboardSource).not.toContain('subjectRepository.listSubjectsForStudent(');
    expect(dashboardSource).not.toContain('subjectRepository.listActivitiesBySubject(');
    expect(dashboardSource).not.toContain('userRepository.listByRole(');
  });

  it('uses database count queries for dashboard summaries', () => {
    expect(dashboardSource).toContain('this.prisma.submission.count');
    expect(dashboardSource).toContain('this.prisma.subject.count');
    expect(dashboardSource).toContain('this.prisma.user.count');
  });

  it('caps upcoming deadline dashboard results', () => {
    expect(dashboardSource).toContain('DASHBOARD_DEADLINE_LIMIT = 50');
    expect(dashboardSource).toContain('take: DASHBOARD_DEADLINE_LIMIT');
  });
});
