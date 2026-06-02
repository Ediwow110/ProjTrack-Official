import {
  assertStageOnlyExecutionEnv,
  buildStageDeletionEvidence,
  isDisposableTarget,
  isProductionLikeValue,
} from '../../src/data-deletion/data-deletion-staging-validation';

describe('data-deletion staging validation guards (Phase 7C)', () => {
  function baseEnv(overrides: Record<string, string | undefined> = {}) {
    return {
      DATA_DELETION_STAGE_ONLY: 'staging',
      APP_ENV: 'staging',
      NODE_ENV: 'staging',
      DATA_DELETION_EXECUTION_ENABLED: 'true',
      DATA_DELETION_VALIDATE_CONFIRM: 'YES_I_UNDERSTAND',
      DATA_DELETION_REQUEST_ID: 'req-1',
      DATA_DELETION_BACKUP_RUN_ID: 'backup-1',
      DATABASE_URL: 'postgresql://dummy:dummy@localhost:5432/staging-delete-test',
      ...overrides,
    } as NodeJS.ProcessEnv;
  }

  it('accepts staging/test-only env with explicit confirmation', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv())).not.toThrow();
  });

  it('rejects missing or invalid DATA_DELETION_STAGE_ONLY scope', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({ DATA_DELETION_STAGE_ONLY: 'production' }))).toThrow(/DATA_DELETION_STAGE_ONLY/);
  });

  it('rejects production-like APP_ENV', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({ APP_ENV: 'production', NODE_ENV: 'production' }))).toThrow(/APP_ENV or NODE_ENV/);
  });

  it('rejects when deletion flag is not explicitly true', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({ DATA_DELETION_EXECUTION_ENABLED: 'false' }))).toThrow(/must be true/);
  });

  it('rejects missing explicit validation confirmation', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({ DATA_DELETION_VALIDATE_CONFIRM: 'NOPE' }))).toThrow(/YES_I_UNDERSTAND/);
  });

  it('rejects production-like DATABASE_URL', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({ DATABASE_URL: 'postgresql://x@prod.projtrack:5432/app' }))).toThrow(/production-like/);
  });

  it('requires disposable restore target when RUN_RESTORE_DRILL=true', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({
      RUN_RESTORE_DRILL: 'true',
      BACKUP_DRILL_SOURCE_DATABASE_URL: 'postgresql://x@localhost:5432/staging-source',
      BACKUP_DRILL_TARGET_DATABASE_URL: 'postgresql://x@localhost:5432/projtrack-staging',
      BACKUP_DRILL_CONFIRM_DISPOSABLE: 'YES_I_UNDERSTAND',
    }))).toThrow(/disposable target/);
  });

  it('accepts disposable restore target when RUN_RESTORE_DRILL=true', () => {
    expect(() => assertStageOnlyExecutionEnv(baseEnv({
      RUN_RESTORE_DRILL: 'true',
      BACKUP_DRILL_SOURCE_DATABASE_URL: 'postgresql://x@localhost:5432/staging-source',
      BACKUP_DRILL_TARGET_DATABASE_URL: 'postgresql://x@localhost:5432/disposable-drill-target',
      BACKUP_DRILL_CONFIRM_DISPOSABLE: 'YES_I_UNDERSTAND',
    }))).not.toThrow();
  });

  it('detects production-like values', () => {
    expect(isProductionLikeValue('postgresql://x@production.projtrack:5432/db')).toBe(true);
    expect(isProductionLikeValue('postgresql://x@localhost:5432/test-db')).toBe(false);
  });

  it('detects disposable target hints', () => {
    expect(isDisposableTarget('postgresql://x@localhost:5432/disposable-drill-target')).toBe(true);
    expect(isDisposableTarget('postgresql://x@localhost:5432/projtrack-staging')).toBe(false);
  });

  it('builds safe evidence without raw identity fields', () => {
    const evidence = buildStageDeletionEvidence({
      requestId: 'req-1',
      verificationRef: 'verify-1',
      env: baseEnv(),
      execution: {
        id: 'exec-1',
        status: 'EXECUTION_COMPLETED',
        dryRun: false,
        backupRunId: 'backup-1',
        executionCompletedAt: '2026-06-03T00:00:00.000Z',
        executionResultJson: {
          results: {
            User: { action: 'anonymize', count: 1 },
          },
        },
      },
      restoreDrill: { attempted: true, ok: true, exitCode: 0 },
    });

    expect(evidence.requestId).toBe('req-1');
    expect(evidence.executionId).toBe('exec-1');
    expect((evidence as any).email).toBeUndefined();
    expect((evidence as any).executionPlanJson).toBeUndefined();
    expect(evidence.executionResultJson).toEqual({
      results: {
        User: { action: 'anonymize', count: 1 },
      },
    });
  });
});
