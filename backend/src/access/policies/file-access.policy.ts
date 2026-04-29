export type FileActorRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | string | undefined;

export function normalizeRole(role: FileActorRole) {
  return String(role ?? '').trim().toUpperCase();
}
