export const EmailJobType = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  BULK: 'BULK',
} as const;

export type EmailJobType = (typeof EmailJobType)[keyof typeof EmailJobType];

export const EmailJobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  DEAD: 'DEAD',
  CANCELLED: 'CANCELLED',
  PAUSED_LIMIT_REACHED: 'PAUSED_LIMIT_REACHED',
} as const;

export type EmailJobStatus = (typeof EmailJobStatus)[keyof typeof EmailJobStatus];

export const AccountActionTokenType = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  ACCOUNT_ACTIVATION: 'ACCOUNT_ACTIVATION',
} as const;

export type AccountActionTokenType =
  (typeof AccountActionTokenType)[keyof typeof AccountActionTokenType];

export const UserStatus = {
  PENDING_SETUP: 'PENDING_SETUP',
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  PENDING_PASSWORD_SETUP: 'PENDING_PASSWORD_SETUP',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  RESTRICTED: 'RESTRICTED',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
  GRADUATED: 'GRADUATED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const DataDeletionRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  CANCELLED: 'CANCELLED',
} as const;

export type DataDeletionRequestStatus =
  (typeof DataDeletionRequestStatus)[keyof typeof DataDeletionRequestStatus];

export type PrismaJsonValue = Record<string, unknown>;
export type PrismaEmailJobWhereInput = Record<string, unknown>;

export function hasPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === code
  );
}
