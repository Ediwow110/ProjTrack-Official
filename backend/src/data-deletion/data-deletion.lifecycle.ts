export type DataDeletionRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'CANCELLED';

export const CONFIRMATION_PHRASE = 'DELETE MY DATA';

export function normalizeDataDeletionRequestStatus(status?: string | null): DataDeletionRequestStatus {
  const normalized = String(status || 'PENDING').trim().replace(/\s+/g, '_').toUpperCase();
  if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'DENIED' || normalized === 'CANCELLED') {
    return normalized as DataDeletionRequestStatus;
  }
  return 'PENDING';
}

export function canTransitionDataDeletionStatus(current: string | null | undefined, next: string | null | undefined): boolean {
  const from = normalizeDataDeletionRequestStatus(current);
  const to = normalizeDataDeletionRequestStatus(next);
  if (to === from) return true;
  const allowed: Record<DataDeletionRequestStatus, DataDeletionRequestStatus[]> = {
    PENDING: ['APPROVED', 'DENIED', 'CANCELLED'],
    APPROVED: [],
    DENIED: [],
    CANCELLED: [],
  };
  return allowed[from].includes(to);
}
