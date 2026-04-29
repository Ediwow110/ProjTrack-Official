import { ForbiddenException, NotFoundException } from '@nestjs/common';

export function assertFound<T>(record: T | null | undefined, message: string): T {
  if (!record) {
    throw new NotFoundException(message);
  }
  return record;
}

export function assertAllowed(condition: unknown, message: string) {
  if (!condition) {
    throw new ForbiddenException(message);
  }
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  status: true,
  avatarRelativePath: true,
  createdAt: true,
} as const;

export function toSafeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    avatarRelativePath: user.avatarRelativePath ?? null,
    createdAt: user.createdAt,
  };
}
