export function normalizeUserStatus(status?: string | null) {
  return String(status ?? '').trim().toUpperCase();
}

export function isPendingSetupStatus(status?: string | null) {
  const normalized = normalizeUserStatus(status);
  return (
    normalized === 'PENDING_SETUP' ||
    normalized === 'PENDING_ACTIVATION' ||
    normalized === 'PENDING_PASSWORD_SETUP'
  );
}

export function isActiveUserStatus(status?: string | null) {
  return normalizeUserStatus(status) === 'ACTIVE';
}

export function isBlockedPasswordRecoveryStatus(status?: string | null) {
  const normalized = normalizeUserStatus(status);
  return (
    normalized === 'INACTIVE' ||
    normalized === 'RESTRICTED' ||
    normalized === 'DISABLED' ||
    normalized === 'ARCHIVED' ||
    normalized === 'GRADUATED'
  );
}

export function canSendPasswordRecoveryInstructions(status?: string | null) {
  return isPendingSetupStatus(status) || isActiveUserStatus(status);
}
