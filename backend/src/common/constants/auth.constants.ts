export const ACCOUNT_ACTION_TOKEN_TYPES = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  ACCOUNT_ACTIVATION: 'ACCOUNT_ACTIVATION',
} as const;

export const AUTH_ROUTE_FRAGMENTS = {
  ACTIVATE: '/auth/activate',
  RESET_PASSWORD: '/auth/reset-password',
  UNSUBSCRIBE: '/unsubscribe',
} as const;

export const AUTH_QUERY_KEYS = {
  TOKEN: 'token',
  REF: 'ref',
  ROLE: 'role',
} as const;

export const ROLE_NAMES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;
