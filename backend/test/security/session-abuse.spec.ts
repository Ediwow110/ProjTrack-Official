import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TokenService } from '../../src/auth/token.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ROLES_KEY } from '../../src/auth/guards/roles.decorator';

type TestUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName: string;
  lastName: string;
};

const ACTIVE_STUDENT: TestUser = {
  id: 'student-1',
  email: 'student@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  firstName: 'Student',
  lastName: 'One',
};

function buildContext(headers: Record<string, string> = {}) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => function TestController() {},
    request,
  } as any;
}

function buildGuard(options: {
  requiredRoles?: string[];
  verifyAccessReturns?: any;
  verifyAccessThrows?: Error;
  user?: TestUser | null;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === ROLES_KEY ? options.requiredRoles : undefined)),
  } as unknown as Reflector;

  const tokenService = {
    verifyAccessToken: jest.fn(() => {
      if (options.verifyAccessThrows) throw options.verifyAccessThrows;
      return options.verifyAccessReturns;
    }),
  } as unknown as TokenService;

  const prisma = {
    user: {
      findUnique: jest.fn(async () => options.user ?? null),
    },
  } as unknown as PrismaService;

  return { guard: new JwtAuthGuard(reflector, tokenService, prisma), tokenService, prisma };
}

describe('session abuse security gate', () => {
  it('rejects anonymous access to protected routes', async () => {
    const { guard } = buildGuard({ user: null });
    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed authorization schemes', async () => {
    const { guard } = buildGuard({ user: null });
    await expect(guard.canActivate(buildContext({ authorization: 'Basic abc123' }))).rejects.toThrow(/bearer token/i);
  });

  it('rejects invalid or expired access tokens', async () => {
    const { guard } = buildGuard({
      verifyAccessThrows: new UnauthorizedException('jwt expired'),
      user: ACTIVE_STUDENT,
    });
    await expect(guard.canActivate(buildContext({ authorization: 'Bearer expired.token' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects refresh tokens presented to access-token-only routes', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: ACTIVE_STUDENT.id, role: 'STUDENT', type: 'refresh' },
      user: ACTIVE_STUDENT,
    });
    await expect(guard.canActivate(buildContext({ authorization: 'Bearer refresh.token' }))).rejects.toThrow(
      /Invalid access token/i,
    );
  });

  it('rejects deactivated users even when token verification succeeds', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: ACTIVE_STUDENT.id, role: 'STUDENT', type: 'access' },
      user: { ...ACTIVE_STUDENT, status: 'DEACTIVATED' },
    });
    await expect(guard.canActivate(buildContext({ authorization: 'Bearer valid.token' }))).rejects.toThrow(
      /no longer active/i,
    );
  });

  it('rejects tokens whose role no longer matches the database role', async () => {
    const { guard } = buildGuard({
      verifyAccessReturns: { sub: ACTIVE_STUDENT.id, role: 'ADMIN', type: 'access' },
      user: { ...ACTIVE_STUDENT, role: 'STUDENT' },
    });
    await expect(guard.canActivate(buildContext({ authorization: 'Bearer stale-role.token' }))).rejects.toThrow(
      /role changed/i,
    );
  });

  it('returns 403 semantics when an authenticated user has the wrong role', async () => {
    const { guard } = buildGuard({
      requiredRoles: ['ADMIN'],
      verifyAccessReturns: { sub: ACTIVE_STUDENT.id, role: 'STUDENT', type: 'access' },
      user: ACTIVE_STUDENT,
    });
    await expect(guard.canActivate(buildContext({ authorization: 'Bearer student.token' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches database-backed user identity rather than trusting token-only fields', async () => {
    const { guard } = buildGuard({
      requiredRoles: ['STUDENT'],
      verifyAccessReturns: {
        sub: 'attacker-controlled-subject',
        role: 'STUDENT',
        type: 'access',
        email: 'spoofed@example.com',
      },
      user: ACTIVE_STUDENT,
    });
    const ctx = buildContext({ authorization: 'Bearer valid.token' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.request.user.sub).toBe(ACTIVE_STUDENT.id);
    expect(ctx.request.user.email).toBe(ACTIVE_STUDENT.email);
    expect(ctx.request.user.status).toBe('ACTIVE');
  });
});
