export type AppRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface RequestActor {
  userId?: string;
  role: AppRole | 'SYSTEM';
  email?: string;
  ipAddress?: string;
  sessionId?: string;
}
