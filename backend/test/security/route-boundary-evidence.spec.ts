import { readFileSync } from 'fs';
import { join } from 'path';

describe('route-boundary evidence guard', () => {
  const subjectsControllerSource = readFileSync(
    join(process.cwd(), 'src', 'subjects', 'subjects.controller.ts'),
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
});
