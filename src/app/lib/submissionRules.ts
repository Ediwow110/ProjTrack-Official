export type CanonicalSubmissionStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'GRADED'
  | 'LATE'
  | 'NEEDS_REVISION'
  | 'REOPENED';

export type ReviewActionState = {
  canonical: CanonicalSubmissionStatus;
  canMarkReviewed: boolean;
  canGrade: boolean;
  canRequestRevision: boolean;
  canReopen: boolean;
  final: boolean;
  reason?: string;
};

const EDITABLE_STATUSES: CanonicalSubmissionStatus[] = ['DRAFT', 'NEEDS_REVISION', 'REOPENED', 'OPEN'];
const VIEWABLE_STATUSES: CanonicalSubmissionStatus[] = ['SUBMITTED', 'LATE', 'REVIEWED', 'GRADED'];

export function normalizeSubmissionStatus(status?: string | null): CanonicalSubmissionStatus {
  const normalized = String(status || 'DRAFT').trim().replace(/\s+/g, '_').toUpperCase();
  if (normalized === 'PENDING_REVIEW') return 'SUBMITTED';
  if (normalized === 'OPEN') return 'OPEN';
  if (normalized === 'SUBMITTED') return 'SUBMITTED';
  if (normalized === 'REVIEWED') return 'REVIEWED';
  if (normalized === 'GRADED') return 'GRADED';
  if (normalized === 'LATE') return 'LATE';
  if (normalized === 'NEEDS_REVISION') return 'NEEDS_REVISION';
  if (normalized === 'REOPENED') return 'REOPENED';
  return 'DRAFT';
}

export function formatSubmissionStatus(status?: string | null) {
  return normalizeSubmissionStatus(status).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function isEditableSubmissionStatus(status?: string | null) {
  return EDITABLE_STATUSES.includes(normalizeSubmissionStatus(status));
}

export function isViewOnlySubmissionStatus(status?: string | null) {
  return VIEWABLE_STATUSES.includes(normalizeSubmissionStatus(status));
}

export function getReviewActionState(status?: string | null): ReviewActionState {
  const canonical = normalizeSubmissionStatus(status);
  const final = canonical === 'GRADED' || canonical === 'REVIEWED';
  return {
    canonical,
    canMarkReviewed: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'NEEDS_REVISION',
    canGrade: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'NEEDS_REVISION' || canonical === 'REVIEWED',
    canRequestRevision: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'REVIEWED',
    canReopen: canonical === 'GRADED' || canonical === 'REVIEWED' || canonical === 'NEEDS_REVISION',
    final,
    reason: final ? 'Finalized submissions must be reopened before further changes.' : undefined,
  };
}
