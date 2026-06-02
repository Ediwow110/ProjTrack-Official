const PROD_PATTERNS = [
  /projtrack-prod/i,
  /projtrack_prod/i,
  /prod\.projtrack/i,
  /production\.projtrack/i,
  /production-host/i,
  /\.projtrack\.codes/i,
];

const DISPOSABLE_HINTS = /(disposable|drill|scratch|throwaway|tmp|temp|test)/i;

export function isProductionLikeValue(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return PROD_PATTERNS.some((pattern) => pattern.test(text));
}

export function isDisposableTarget(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return DISPOSABLE_HINTS.test(text);
}

export function assertStageOnlyExecutionEnv(env: NodeJS.ProcessEnv) {
  const scope = String(env.DATA_DELETION_STAGE_ONLY || '').trim().toLowerCase();
  if (scope !== 'staging' && scope !== 'test') {
    throw new Error('DATA_DELETION_STAGE_ONLY must be exactly "staging" or "test". Refusing to run deletion validation.');
  }

  const appEnv = String(env.APP_ENV || env.NODE_ENV || '').trim().toLowerCase();
  if (appEnv !== 'staging' && appEnv !== 'test') {
    throw new Error('APP_ENV or NODE_ENV must be "staging" or "test" for Phase 7C validation. Refusing to run.');
  }

  if (env.DATA_DELETION_EXECUTION_ENABLED !== 'true') {
    throw new Error('DATA_DELETION_EXECUTION_ENABLED must be true for staging/test-only validation.');
  }

  if (String(env.DATA_DELETION_VALIDATE_CONFIRM || '').trim() !== 'YES_I_UNDERSTAND') {
    throw new Error('DATA_DELETION_VALIDATE_CONFIRM must equal "YES_I_UNDERSTAND".');
  }

  if (!String(env.DATA_DELETION_REQUEST_ID || '').trim()) {
    throw new Error('DATA_DELETION_REQUEST_ID is required.');
  }

  if (!String(env.DATA_DELETION_BACKUP_RUN_ID || '').trim()) {
    throw new Error('DATA_DELETION_BACKUP_RUN_ID is required.');
  }

  const dbUrl = String(env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  if (isProductionLikeValue(dbUrl)) {
    throw new Error('DATABASE_URL appears production-like. Refusing Phase 7C validation.');
  }

  const runRestoreDrill = String(env.RUN_RESTORE_DRILL || '').trim().toLowerCase() === 'true';
  if (runRestoreDrill) {
    const source = String(env.BACKUP_DRILL_SOURCE_DATABASE_URL || '').trim();
    const target = String(env.BACKUP_DRILL_TARGET_DATABASE_URL || '').trim();
    const confirm = String(env.BACKUP_DRILL_CONFIRM_DISPOSABLE || '').trim();

    if (!source) throw new Error('BACKUP_DRILL_SOURCE_DATABASE_URL is required when RUN_RESTORE_DRILL=true.');
    if (!target) throw new Error('BACKUP_DRILL_TARGET_DATABASE_URL is required when RUN_RESTORE_DRILL=true.');
    if (confirm !== 'YES_I_UNDERSTAND') {
      throw new Error('BACKUP_DRILL_CONFIRM_DISPOSABLE must equal "YES_I_UNDERSTAND" when RUN_RESTORE_DRILL=true.');
    }
    if (isProductionLikeValue(source)) {
      throw new Error('BACKUP_DRILL_SOURCE_DATABASE_URL appears production-like. Refusing restore drill.');
    }
    if (isProductionLikeValue(target)) {
      throw new Error('BACKUP_DRILL_TARGET_DATABASE_URL appears production-like. Refusing restore drill.');
    }
    if (!isDisposableTarget(target)) {
      throw new Error('BACKUP_DRILL_TARGET_DATABASE_URL must clearly indicate a disposable target. Refusing restore drill.');
    }
  }
}

type StageDeletionEvidenceInput = {
  requestId: string;
  execution: {
    id: string;
    status: string;
    dryRun?: boolean;
    backupRunId?: string | null;
    executionCompletedAt?: Date | string | null;
    executionResultJson?: unknown;
    executionError?: string | null;
  };
  verificationRef?: string | null;
  alreadyCompleted?: boolean;
  restoreDrill?: {
    attempted: boolean;
    ok: boolean;
    exitCode: number;
  } | null;
  env: NodeJS.ProcessEnv;
};

export function buildStageDeletionEvidence(input: StageDeletionEvidenceInput) {
  return {
    scope: 'Phase 7C staging-only deletion restore drill',
    requestId: input.requestId,
    executionId: input.execution.id,
    status: input.execution.status,
    dryRun: Boolean(input.execution.dryRun),
    backupRunId: input.execution.backupRunId || null,
    verificationRef: input.verificationRef || null,
    alreadyCompleted: Boolean(input.alreadyCompleted),
    executionCompletedAt: input.execution.executionCompletedAt ?? null,
    executionError: input.execution.executionError ?? null,
    executionResultJson: input.execution.executionResultJson ?? null,
    restoreDrill: input.restoreDrill || { attempted: false, ok: false, exitCode: 0 },
    environment: {
      dataDeletionStageOnly: String(input.env.DATA_DELETION_STAGE_ONLY || ''),
      appEnv: String(input.env.APP_ENV || ''),
      nodeEnv: String(input.env.NODE_ENV || ''),
      dataDeletionExecutionEnabled: String(input.env.DATA_DELETION_EXECUTION_ENABLED || ''),
    },
    generatedAt: new Date().toISOString(),
  };
}
