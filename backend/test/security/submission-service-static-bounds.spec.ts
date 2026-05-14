import { readFileSync } from 'fs';
import { join } from 'path';

describe('submission service static bounds guard', () => {
  const serviceSource = readFileSync(
    join(process.cwd(), 'src', 'submissions', 'submissions.service.ts'),
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
});
