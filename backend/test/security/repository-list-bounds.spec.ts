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
  const subjectRepositorySource = readFileSync(
    join(process.cwd(), 'src', 'repositories', 'subject.repository.ts'),
    'utf8',
  );
  const notificationRepositorySource = readFileSync(
    join(process.cwd(), 'src', 'repositories', 'notification.repository.ts'),
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

  it('keeps subject, activity, and group listing hard bounded', () => {
    expect(subjectRepositorySource).toContain('MAX_SUBJECT_REPOSITORY_LIST_TAKE = 500');
    expect(subjectRepositorySource).toContain('MAX_SUBJECT_ACTIVITY_LIST_TAKE = 500');
    expect(subjectRepositorySource).toContain('MAX_SUBJECT_GROUP_LIST_TAKE = 500');
    expect(subjectRepositorySource).toContain('skip: this.clampListSkip(options.skip)');
    expect(subjectRepositorySource).toContain('DEFAULT_SUBJECT_REPOSITORY_LIST_TAKE');
    expect(subjectRepositorySource).toContain('DEFAULT_SUBJECT_ACTIVITY_LIST_TAKE');
    expect(subjectRepositorySource).toContain('DEFAULT_SUBJECT_GROUP_LIST_TAKE');
  });

  it('keeps notification feed listing hard bounded', () => {
    expect(notificationRepositorySource).toContain('MAX_NOTIFICATION_LIST_TAKE = 200');
    expect(notificationRepositorySource).toContain('DEFAULT_NOTIFICATION_LIST_TAKE = 50');
    expect(notificationRepositorySource).toContain('take: this.clampListTake(options.take)');
    expect(notificationRepositorySource).toContain('skip: this.clampListSkip(options.skip)');
  });

  it('does not load full submissions arrays for subject activity listing', () => {
    expect(subjectRepositorySource).not.toContain('include: { submissions: true }');
    expect(subjectRepositorySource).toContain('include: { _count: { select: { submissions: true } } }');
  });
});
