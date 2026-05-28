import { readFileSync } from 'fs';
import { join } from 'path';

describe('submission service static bounds guard', () => {
  const serviceSource = readFileSync(
    join(process.cwd(), 'src', 'submissions', 'submissions.service.ts'),
    'utf8',
  );
  const repositorySource = readFileSync(
    join(process.cwd(), 'src', 'repositories', 'submission.repository.ts'),
    'utf8',
  );

  it('does not route active list/export paths through legacy unbounded repository list helpers', () => {
    expect(serviceSource).not.toContain('submissionRepository.listStudentSubmissions(');
    expect(serviceSource).not.toContain('submissionRepository.listTeacherSubmissions(');
    expect(serviceSource).not.toContain('submissionRepository.listSubmissions(');
  });

  it('keeps active submission list paths database bounded', () => {
    expect(serviceSource).toContain('take: MAX_SUBMISSION_LIST_RESPONSE_ROWS');
    expect(serviceSource).toContain('take: Math.max(1, Math.min(maxRows, MAX_TEACHER_EXPORT_ROWS + 1))');
  });

  it('keeps teacher export truncation metadata in the service contract', () => {
    expect(serviceSource).toContain('truncated:');
    expect(serviceSource).toContain('maxRows: MAX_TEACHER_EXPORT_ROWS');
  });

  it('keeps legacy submission repository list helpers hard bounded', () => {
    expect(repositorySource).toContain('MAX_SUBMISSION_REPOSITORY_LIST_TAKE = 500');
    expect(repositorySource).toContain('take: this.clampListTake(options.take)');
    expect(repositorySource).toContain('skip: this.clampListSkip(options.skip)');
    expect(repositorySource).not.toContain('const tasks = await this.prisma.submissionTask.findMany');
    expect(repositorySource).not.toContain('taskId: { in: taskIds }');
  });
});
