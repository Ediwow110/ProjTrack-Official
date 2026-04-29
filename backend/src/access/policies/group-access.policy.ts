export const OPEN_GROUP_STATUSES = ['PENDING', 'ACTIVE'] as const;

export function isJoinableGroupStatus(status?: string | null) {
  return OPEN_GROUP_STATUSES.includes(
    String(status ?? 'ACTIVE').trim().toUpperCase() as (typeof OPEN_GROUP_STATUSES)[number],
  );
}
