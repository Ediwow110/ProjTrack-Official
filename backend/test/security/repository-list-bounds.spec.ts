import { readFileSync } from 'fs';
import { join } from 'path';

describe('repository list bounds guard', () => {
  const auditRepositorySource = readFileSync(
    join(process.cwd(), 'src', 'repositories', 'audit-log.repository.ts'),
    'utf8',
  );
  const userRepositorySource = readFileSync(
    join(process.cwd(), 'src', 'repositories', 'user.repository.ts'),
    'utf8',
  );

  it('keeps audit log listing hard bounded', () => {
    expect(auditRepositorySource).toContain('MAX_AUDIT_LOG_LIST_TAKE = 500');
    expect(auditRepositorySource).toContain('take: this.clampListTake(options.take)');
    expect(auditRepositorySource).toContain('skip: this.clampListSkip(options.skip)');
  });

  it('keeps user listing hard bounded', () => {
    expect(userRepositorySource).toContain('MAX_USER_REPOSITORY_LIST_TAKE = 500');
    expect(userRepositorySource).toContain('take: this.clampListTake(options.take)');
    expect(userRepositorySource).toContain('skip: this.clampListSkip(options.skip)');
    expect(userRepositorySource).toContain("return this.listByRole('STUDENT', options)");
  });
});
