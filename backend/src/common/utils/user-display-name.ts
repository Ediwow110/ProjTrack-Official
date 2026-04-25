export function userDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || String(user.email ?? '').trim() || 'ProjTrack user';
}
