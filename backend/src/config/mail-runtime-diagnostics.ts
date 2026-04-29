import { Logger } from '@nestjs/common';
import { MAIL_QUEUE_DEFAULTS } from '../common/constants/queue.constants';

function envFlag(value: unknown) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function envNumber(keys: readonly string[], fallback: number, env: NodeJS.ProcessEnv) {
  for (const key of keys) {
    const parsed = Number(env[key]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
}

export function getSafeMailRuntimeState(env: NodeJS.ProcessEnv = process.env) {
  return {
    provider: String(env.MAIL_PROVIDER ?? 'stub').trim().toLowerCase() || 'stub',
    workerEnabled: envFlag(env.MAIL_WORKER_ENABLED),
    testmailEnabled: envFlag(env.TESTMAIL_ENABLED),
    appEnv: String(env.APP_ENV ?? '').trim() || 'unset',
    nodeEnv: String(env.NODE_ENV ?? '').trim() || 'unset',
    pollMs: envNumber(['MAIL_WORKER_POLL_MS', 'MAIL_QUEUE_POLL_MS'], MAIL_QUEUE_DEFAULTS.POLL_MS, env),
  };
}

export function logSafeMailRuntimeState(logger: Logger) {
  const state = getSafeMailRuntimeState();
  logger.log(
    `Mail runtime: provider=${state.provider}, workerEnabled=${state.workerEnabled}, testmail=${state.testmailEnabled}, appEnv=${state.appEnv}, nodeEnv=${state.nodeEnv}, pollMs=${state.pollMs}`,
  );
}
