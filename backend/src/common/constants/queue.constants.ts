export const MAIL_QUEUE_DEFAULTS = {
  TX_PER_MIN: 60,
  BULK_PER_MIN: 20,
  POLL_MS: 15_000,
  QUEUED_WARNING_MS: 5 * 60 * 1000,
  PROCESSING_WARNING_MS: 5 * 60 * 1000,
  STALE_LOCK_MS: 10 * 60 * 1000,
  HEARTBEAT_STALE_BUFFER_MS: 30_000,
} as const;

export const MAIL_QUEUE_ENV_KEYS = {
  TX_PER_MIN: ['MAILRELAY_TX_PER_MIN', 'MAIL_TX_PER_MIN'],
  BULK_PER_MIN: ['MAILRELAY_BULK_PER_MIN', 'MAIL_BULK_PER_MIN'],
  POLL_MS: ['MAIL_WORKER_POLL_MS', 'MAIL_QUEUE_POLL_MS'],
  QUEUED_WARNING_MS: ['MAIL_QUEUE_WARNING_MS', 'MAIL_QUEUED_WARNING_MS'],
  PROCESSING_WARNING_MS: ['MAIL_PROCESSING_WARNING_MS'],
  PROCESSING_STALE_MS: ['MAIL_PROCESSING_STALE_MS', 'MAIL_STALE_LOCK_MS'],
  HEARTBEAT_STALE_MS: ['MAIL_WORKER_HEARTBEAT_STALE_MS'],
} as const;

function envNumber(keys: readonly string[], fallback: number, env: NodeJS.ProcessEnv) {
  for (const key of keys) {
    const parsed = Number(env[key]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
}

export function mailWorkerPollMs(env: NodeJS.ProcessEnv = process.env) {
  return envNumber(MAIL_QUEUE_ENV_KEYS.POLL_MS, MAIL_QUEUE_DEFAULTS.POLL_MS, env);
}

export function mailQueuedWarningMs(env: NodeJS.ProcessEnv = process.env) {
  return envNumber(
    MAIL_QUEUE_ENV_KEYS.QUEUED_WARNING_MS,
    MAIL_QUEUE_DEFAULTS.QUEUED_WARNING_MS,
    env,
  );
}

export function mailProcessingWarningMs(env: NodeJS.ProcessEnv = process.env) {
  return envNumber(
    MAIL_QUEUE_ENV_KEYS.PROCESSING_WARNING_MS,
    MAIL_QUEUE_DEFAULTS.PROCESSING_WARNING_MS,
    env,
  );
}

export function mailProcessingStaleMs(env: NodeJS.ProcessEnv = process.env) {
  return envNumber(
    MAIL_QUEUE_ENV_KEYS.PROCESSING_STALE_MS,
    MAIL_QUEUE_DEFAULTS.STALE_LOCK_MS,
    env,
  );
}

export function mailWorkerHeartbeatStaleMs(
  env: NodeJS.ProcessEnv = process.env,
  pollMs = mailWorkerPollMs(env),
) {
  const fallback = Math.max(
    pollMs * 2 + MAIL_QUEUE_DEFAULTS.HEARTBEAT_STALE_BUFFER_MS,
    60_000,
  );
  return envNumber(MAIL_QUEUE_ENV_KEYS.HEARTBEAT_STALE_MS, fallback, env);
}
