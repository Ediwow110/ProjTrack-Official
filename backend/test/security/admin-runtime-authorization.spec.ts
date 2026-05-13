import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from '../../src/admin/admin.controller';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../src/auth/guards/roles.decorator';

const ACTIVE_ADMIN = {
  id: 'admin-user',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  firstName: 'Admin',
  lastName: 'User',
};

const ACTIVE_STUDENT = {
  id: 'student-user',
  email: 'student@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  firstName: 'Student',
  lastName: 'User',
};

function buildContext(options: { headers?: Record<string, string>; handler?: Function; controllerClass?: Function } = {}) {
  const request: any = { headers: options.headers ?? {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => options.handler ?? AdminController.prototype.stats,
    getClass: () => options.controllerClass ?? AdminController,
    request,
  } as any;
}

function buildGuard(user: any, tokenRole: string) {
  const reflector = new Reflector();
  const tokenService = {
    verifyAccessToken: jest.fn(() => ({ sub: user?.id ?? 'missing-user', role: tokenRole, type: 'access' })),
  } as any;
  const prisma = {
    user: {
      findUnique: jest.fn(async () => user),
    },
  } as any;
  return { guard: new JwtAuthGuard(reflector, tokenService, prisma), tokenService, prisma };
}

describe('admin runtime authorization gate', () => {
  it('keeps admin controller role metadata admin-only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['ADMIN']);
  });

  it('returns 401 semantics for anonymous admin route access', async () => {
    const { guard } = buildGuard(null, 'STUDENT');

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 semantics when a student calls an admin controller route', async () => {
    const { guard } = buildGuard(ACTIVE_STUDENT, 'STUDENT');

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: 'Bearer student-token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an active admin through admin controller runtime guard', async () => {
    const { guard } = buildGuard(ACTIVE_ADMIN, 'ADMIN');
    const ctx = buildContext({ headers: { authorization: 'Bearer admin-token' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.request.user).toMatchObject({ sub: 'admin-user', role: 'ADMIN', status: 'ACTIVE' });
  });

  it('rejects stale admin tokens after the database role is downgraded', async () => {
    const downgradedAdmin = { ...ACTIVE_ADMIN, role: 'STUDENT' };
    const { guard } = buildGuard(downgradedAdmin, 'ADMIN');

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: 'Bearer stale-admin-token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive admin users even when token role says admin', async () => {
    const inactiveAdmin = { ...ACTIVE_ADMIN, status: 'DEACTIVATED' };
    const { guard } = buildGuard(inactiveAdmin, 'ADMIN');

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: 'Bearer inactive-admin-token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
