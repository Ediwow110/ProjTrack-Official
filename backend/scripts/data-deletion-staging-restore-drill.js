#!/usr/bin/env node
require('dotenv').config();
require('ts-node/register/transpile-only');

const path = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { DataDeletionExecutionService } = require('../src/data-deletion/data-deletion-execution.service');
const {
  assertStageOnlyExecutionEnv,
  buildStageDeletionEvidence,
} = require('../src/data-deletion/data-deletion-staging-validation');

function tail(text, max = 2000) {
  const value = String(text || '');
  return value.length > max ? value.slice(-max) : value;
}

async function main() {
  assertStageOnlyExecutionEnv(process.env);

  const requestId = String(process.env.DATA_DELETION_REQUEST_ID || '').trim();
  const backupRunId = String(process.env.DATA_DELETION_BACKUP_RUN_ID || '').trim();
  const verificationRef = String(process.env.DATA_DELETION_VERIFICATION_REF || '').trim() || undefined;
  const actorUserId = String(process.env.DATA_DELETION_OPERATOR_USER_ID || '').trim() || undefined;
  const actorRole = String(process.env.DATA_DELETION_OPERATOR_ROLE || '').trim() || 'ADMIN';
  const runRestoreDrill = String(process.env.RUN_RESTORE_DRILL || '').trim().toLowerCase() === 'true';

  const actor = {
    actorUserId,
    actorRole,
    ipAddress: 'staging-script',
  };

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const executionService = app.get(DataDeletionExecutionService);

    let execution = await executionService.getOrCreateExecutionForRequest(requestId, actor);

    if (execution.status === 'DRY_RUN_PENDING') {
      execution = await executionService.startDryRun(execution.id, actor);
    }

    if (execution.status === 'EXECUTION_COMPLETED') {
      const evidence = buildStageDeletionEvidence({
        requestId,
        execution,
        verificationRef,
        alreadyCompleted: true,
        restoreDrill: { attempted: false, ok: false, exitCode: 0 },
        env: process.env,
      });
      maybeWriteEvidence(evidence);
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    if (execution.status !== 'BACKUP_VERIFIED' || execution.backupRunId !== backupRunId) {
      execution = await executionService.verifyBackup(execution.id, { backupRunId, verificationRef }, actor);
    }

    const executed = await executionService.attemptExecution(execution.id, actor);

    let restoreDrill = { attempted: false, ok: false, exitCode: 0 };
    if (runRestoreDrill) {
      const drillScript = path.join(__dirname, 'backup-restore-drill.mjs');
      const result = spawnSync(process.execPath, [drillScript], {
        env: process.env,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      restoreDrill = {
        attempted: true,
        ok: result.status === 0,
        exitCode: result.status ?? 1,
        stdout: tail(result.stdout),
        stderr: tail(result.stderr),
      };
      if (result.status !== 0) {
        throw new Error(`Restore drill failed with exit ${result.status}. stderr=${tail(result.stderr, 500)}`);
      }
    }

    const evidence = buildStageDeletionEvidence({
      requestId,
      execution: executed,
      verificationRef,
      restoreDrill,
      env: process.env,
    });

    maybeWriteEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await app.close();
  }
}

function maybeWriteEvidence(evidence) {
  const out = String(process.env.DATA_DELETION_EVIDENCE_OUT || '').trim();
  if (!out) return;
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(evidence, null, 2), 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
