export const PENDING_REVIEW_STATUSES = ['SUBMITTED', 'PENDING_REVIEW', 'LATE'] as const;

export function isPendingReviewStatus(status?: string | null) {
  return PENDING_REVIEW_STATUSES.includes(
    String(status ?? '').trim().toUpperCase() as (typeof PENDING_REVIEW_STATUSES)[number],
  );
}

export function eventActionForSubmission(fromStatus?: string | null, toStatus?: string | null) {
  const from = String(fromStatus ?? '').trim().toUpperCase();
  const to = String(toStatus ?? '').trim().toUpperCase();

  if (!from && (to === 'SUBMITTED' || to === 'LATE')) return 'SUBMITTED';
  if (from && (to === 'SUBMITTED' || to === 'LATE')) return 'RESUBMITTED';
  if (to === 'REVIEWED') return 'MARKED_REVIEWED';
  if (to === 'GRADED') return 'GRADED';
  if (to === 'NEEDS_REVISION') return 'RETURNED_FOR_REVISION';
  if (to === 'REOPENED') return 'REOPENED';
  return 'STATUS_CHANGED';
}
