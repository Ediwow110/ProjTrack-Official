import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from '../token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

type AnyUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName: string;
  lastName: string;
};

function buildContext(headers: Record<string, string> = {}) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => function ContextClass() {},
    request,
  } as any;
}

function buildGuard(opts: {
  requiredRoles?: string[] | undefined;
  verifyAccessReturns: any;
  user: AnyUser | null;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === ROLES_KEY ? opts.requiredRoles : undefined)),
  } as unknown as Reflector;
  const tokenService = {
    verifyAccessToken: jest.fn(() => opts.verifyAccessReturns),
  } as unknown as TokenService;
  const prisma = {
    user: { findUnique: jest.fn(async () => opts.user) },
  } as unknown as PrismaService;
  return { guard: new JwtAuthGuard(reflector, tokenService, prisma), tokenService, prisma };
}

const ACTIVE_ADMIN: AnyUser = {
  id: 'u-1',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  firstName: 'A',
  lastName: 'B',
};

describe('JwtAuthGuard', () => {
  it('rejects requests with no Authorization header', async () => {
    const { guard } = buildGuard({ verifyAccessReturns: null, user: null });
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects requests with a non-Bearer Authorization header', async () => {
    const { guard } = buildGuard({ verifyAccessReturns: null, user: null });
    const ctx = buildContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/bearer token/i);
  });

  it('rejects requests when the token does not verify', async () => {
    const { guard } = buildGuard({ verifyAccessReturns: null, user: null });
    const ctx = buildContext({ authorization: 'Bearer tampered.token.value' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid access token/i);
  });

  it('rejects refresh-typed payloads presented as access tokens', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'refresh' },
      user: ACTIVE_ADMIN,
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid access token/i);
  });

  it('rejects when the user no longer exists in the database', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'access' },
      user: null,
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no longer active/i);
  });

  it('rejects an inactive user even if the access token verifies', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'access' },
      user: { ...ACTIVE_ADMIN, status: 'INACTIVE' },
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no longer active/i);
  });

  it('rejects when the database role no longer matches the token role', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'access' },
      user: { ...ACTIVE_ADMIN, role: 'STUDENT' },
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/role changed/i);
  });

  it('rejects with ForbiddenException when role-required and user lacks the role', async () => {
    const { guard } = buildGuard({
      requiredRoles: ['ADMIN'],
      verifyAccessReturns: { sub: 'u-1', role: 'STUDENT', type: 'access' },
      user: { ...ACTIVE_ADMIN, role: 'STUDENT' },
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an active user with the required role and attaches request.user', async () => {
    const { guard } = buildGuard({
      requiredRoles: ['ADMIN'],
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'access', extraClaim: true },
      user: ACTIVE_ADMIN,
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.request.user.sub).toBe('u-1');
    expect(ctx.request.user.role).toBe('ADMIN');
    expect(ctx.request.user.email).toBe('admin@example.com');
    expect(ctx.request.user.status).toBe('ACTIVE');
    expect(ctx.request.user.extraClaim).toBe(true);
  });

  it('allows an active user when no role metadata is set on the route', async () => {
    const { guard } = buildGuard({
      requiredRoles: undefined,
      verifyAccessReturns: { sub: 'u-1', role: 'STUDENT', type: 'access' },
      user: { ...ACTIVE_ADMIN, role: 'STUDENT' },
    });
    const ctx = buildContext({ authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('accepts a capitalized "Authorization" header key', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: 'u-1', role: 'ADMIN', type: 'access' },
      user: ACTIVE_ADMIN,
    });
    const ctx = buildContext({ Authorization: 'Bearer x.y.z' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
