import { readFileSync } from 'fs';
import { join } from 'path';

describe('route-boundary evidence guard', () => {
  const subjectsControllerSource = readFileSync(
    join(process.cwd(), 'src', 'subjects', 'subjects.controller.ts'),
    'utf8',
  );
  const subjectsServiceSource = readFileSync(
    join(process.cwd(), 'src', 'subjects', 'subjects.service.ts'),
    'utf8',
  );
  const submissionsControllerSource = readFileSync(
    join(process.cwd(), 'src', 'submissions', 'submissions.controller.ts'),
    'utf8',
  );
  const performanceGateSource = readFileSync(
    join(process.cwd(), '..', 'docs', 'PERFORMANCE_ACCEPTANCE_GATE.md'),
    'utf8',
  );

  it('keeps high-volume subject routes visible for issue #44 review', () => {
    expect(subjectsControllerSource).toContain("@Get('student/subjects')");
    expect(subjectsControllerSource).toContain("@Get('student/submit-catalog')");
    expect(subjectsControllerSource).toContain("@Get('student/calendar/events')");
    expect(subjectsControllerSource).toContain("@Get('teacher/subjects')");
    expect(subjectsControllerSource).toContain("@Get('teacher/students')");
    expect(subjectsControllerSource).toContain("@Get('teacher/sections')");
    expect(subjectsControllerSource).toContain("@Get('teacher/sections/:id/master-list')");
  });

  it('keeps high-volume submission routes visible for issue #44 review', () => {
    expect(submissionsControllerSource).toContain("@Get('student/submissions')");
    expect(submissionsControllerSource).toContain("@Get('teacher/submissions')");
  });

  it('keeps issue #44 wired into the performance gate before school-scale claims', () => {
    expect(performanceGateSource).toContain('Issue #44 tracks subject/submission route-boundary pagination and seeded query-plan safety.');
    expect(performanceGateSource).toContain('PERF-FINDING-009: subject/submission route-boundary and query-plan safety remains open');
    expect(performanceGateSource).toContain('Issue #44 is unresolved for a 20k-50k registered-user claim.');
  });

  it('keeps teacher students route response pagination explicit', () => {
    expect(subjectsControllerSource).toContain('DEFAULT_TEACHER_STUDENTS_TAKE = 100');
    expect(subjectsControllerSource).toContain('MAX_TEACHER_STUDENTS_TAKE = 500');
    expect(subjectsControllerSource).toContain("@Query('take') take?: string");
    expect(subjectsControllerSource).toContain("@Query('skip') skip?: string");
    expect(subjectsControllerSource).toContain('parseBoundedTake(take, DEFAULT_TEACHER_STUDENTS_TAKE, MAX_TEACHER_STUDENTS_TAKE)');
  });

  it('keeps teacher sections route response pagination explicit', () => {
    expect(subjectsControllerSource).toContain('DEFAULT_TEACHER_SECTIONS_TAKE = 100');
    expect(subjectsControllerSource).toContain('MAX_TEACHER_SECTIONS_TAKE = 500');
    expect(subjectsControllerSource).toContain('parseBoundedTake(take, DEFAULT_TEACHER_SECTIONS_TAKE, MAX_TEACHER_SECTIONS_TAKE)');
    expect(subjectsControllerSource).toContain('rows.slice(boundedSkip, boundedSkip + boundedTake)');
  });

  it('keeps the remaining highest-risk subject service blockers explicit', () => {
    expect(subjectsServiceSource).toContain('async teacherStudents(');
    expect(subjectsServiceSource).toContain('async teacherSections(');
    expect(performanceGateSource).toContain('SubjectsService.teacherStudents');
    expect(performanceGateSource).toContain('teacher students route is controller-level response-capped but still requires DB-level cap/query-plan evidence');
    expect(performanceGateSource).toContain('SubjectsService.teacherSections');
    expect(performanceGateSource).toContain('controller-level response-capped but still requires DB-level cap/query-plan evidence');
  });
});
