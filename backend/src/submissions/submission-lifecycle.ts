export type SubmissionLifecycleStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'GRADED'
  | 'LATE'
  | 'NEEDS_REVISION'
  | 'REOPENED';

export function normalizeSubmissionLifecycleStatus(status?: string | null): SubmissionLifecycleStatus {
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

export function canStudentEditSubmission(status?: string | null) {
  const canonical = normalizeSubmissionLifecycleStatus(status);
  return canonical === 'DRAFT' || canonical === 'NEEDS_REVISION' || canonical === 'REOPENED' || canonical === 'OPEN';
}

export function canTransitionSubmissionStatus(current: string | null | undefined, next: string | null | undefined) {
  const from = normalizeSubmissionLifecycleStatus(current);
  const to = normalizeSubmissionLifecycleStatus(next);
  if (to === from) return true;
  const allowed: Record<SubmissionLifecycleStatus, SubmissionLifecycleStatus[]> = {
    DRAFT: ['SUBMITTED', 'LATE'],
    OPEN: ['SUBMITTED', 'LATE'],
    SUBMITTED: ['REVIEWED', 'GRADED', 'NEEDS_REVISION'],
    REVIEWED: ['GRADED', 'NEEDS_REVISION', 'REOPENED'],
    GRADED: ['REOPENED'],
    LATE: ['REVIEWED', 'GRADED', 'NEEDS_REVISION'],
    NEEDS_REVISION: ['SUBMITTED', 'LATE', 'REOPENED'],
    REOPENED: ['SUBMITTED', 'LATE', 'REVIEWED', 'GRADED', 'NEEDS_REVISION'],
  };
  return allowed[from].includes(to);
}
