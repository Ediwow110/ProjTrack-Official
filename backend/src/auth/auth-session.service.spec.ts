import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthSessionService } from './auth-session.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../repositories/user.repository';

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

type FakeSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  ipAddress?: string;
  userAgent?: string;
};

function buildPrisma(session: FakeSession | null) {
  const sessions = new Map<string, FakeSession>();
  if (session) sessions.set(session.id, { ...session });
  const created: FakeSession[] = [];
  const updated: { id: string; data: any }[] = [];

  const prisma: any = {
    authSession: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.id);
        return s ? { ...s } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        if (!s) throw new Error('not found');
        Object.assign(s, data);
        updated.push({ id: where.id, data });
        return { ...s };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, s] of sessions) {
          if (where.id && where.id !== id) continue;
          if (where.userId && where.userId !== s.userId) continue;
          if (where.tokenHash && where.tokenHash !== s.tokenHash) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          if (where.expiresAt?.gt && s.expiresAt.getTime() <= where.expiresAt.gt.getTime()) continue;
          Object.assign(s, data);
          updated.push({ id, data });
          count += 1;
        }
        return { count };
      }),
      create: jest.fn(async ({ data }: any) => {
        sessions.set(data.id, { ...data, revokedAt: data.revokedAt ?? null, replacedBySessionId: data.replacedBySessionId ?? null });
        created.push({ ...data });
        return { ...data };
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma: prisma as PrismaService, sessions, created, updated };
}

function buildTokenService(verifyResult: any) {
  return {
    verifyRefreshToken: jest.fn(() => verifyResult),
    createRefreshToken: jest.fn((u: any, sid: string) => `rt:${sid}:${u.id}`),
    createAccessToken: jest.fn((u: any) => `at:${u.id}`),
    getRefreshTtlMs: () => 600_000,
    getRememberRefreshTtlMs: () => 1_200_000,
  } as unknown as TokenService;
}

function buildUserRepo(user: { id: string; email: string; role: string; status: string } | null) {
  return { findById: jest.fn(async (_id: string) => user) } as unknown as UserRepository;
}

const ACTIVE_USER = { id: 'u-1', email: 'u@example.com', role: 'STUDENT', status: 'ACTIVE' };

describe('AuthSessionService.createRefreshSession', () => {
  it('creates a session row with a hashed refresh token', async () => {
    const { prisma, sessions, created } = buildPrisma(null);
    const token = buildTokenService({ sub: ACTIVE_USER.id, sid: 'will-be-overridden' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);

    const result = await svc.createRefreshSession(
      { id: ACTIVE_USER.id, role: ACTIVE_USER.role, email: ACTIVE_USER.email },
      { ipAddress: '1.2.3.4', userAgent: 'jest' },
    );
    expect(result.refreshToken.startsWith('rt:')).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].userId).toBe(ACTIVE_USER.id);
    expect(created[0].tokenHash).toBe(sha256(result.refreshToken));
    expect(sessions.size).toBe(1);
  });
});

describe('AuthSessionService.rotateRefreshSession', () => {
  it('throws when the refresh token does not verify', async () => {
    const { prisma } = buildPrisma(null);
    const token = buildTokenService(null);
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when the session row is missing', async () => {
    const { prisma } = buildPrisma(null);
    const token = buildTokenService({ sub: 'u-1', sid: 'missing' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession('rt:missing:u-1')).rejects.toThrow(/Refresh session not found/);
  });

  it('refuses an already-revoked session and revokes all on replay if it had been rotated', async () => {
    const refreshTok = 'rt:s-1:u-1';
    const { prisma, sessions } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(refreshTok),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: new Date(),
      replacedBySessionId: 's-2',
    });
    sessions.set('s-2', {
      id: 's-2',
      userId: 'u-1',
      tokenHash: sha256('rt:s-2:u-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession(refreshTok)).rejects.toThrow(/already been rotated or revoked/);
    // Replay defence: the still-active sibling session should now also be revoked.
    expect(sessions.get('s-2')?.revokedAt).not.toBeNull();
  });

  it('rejects an expired session', async () => {
    const refreshTok = 'rt:s-1:u-1';
    const { prisma } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(refreshTok),
      expiresAt: new Date(Date.now() - 1000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession(refreshTok)).rejects.toThrow(/expired/);
  });

  it('treats a token-hash mismatch as a possible theft and revokes all sessions for the user', async () => {
    const realTok = 'rt:s-1:u-1';
    const { prisma, sessions } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(realTok),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession('rt:s-1:u-2-stolen')).rejects.toThrow(/mismatch/);
    expect(sessions.get('s-1')?.revokedAt).not.toBeNull();
  });

  it('rejects rotation when the user has been deactivated and revokes all their sessions', async () => {
    const refreshTok = 'rt:s-1:u-1';
    const { prisma, sessions } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(refreshTok),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const repo = buildUserRepo({ ...ACTIVE_USER, status: 'INACTIVE' });
    const svc = new AuthSessionService(prisma, token, repo);
    await expect(svc.rotateRefreshSession(refreshTok)).rejects.toThrow(/inactive/);
    expect(sessions.get('s-1')?.revokedAt).not.toBeNull();
  });

  it('rotates a valid session: revokes the old, creates a new one, returns new tokens', async () => {
    const refreshTok = 'rt:s-1:u-1';
    const { prisma, sessions, created } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(refreshTok),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const repo = buildUserRepo(ACTIVE_USER);
    const svc = new AuthSessionService(prisma, token, repo);

    const result = await svc.rotateRefreshSession(refreshTok);
    expect(result.accessToken).toBe('at:u-1');
    expect(result.refreshToken.startsWith('rt:')).toBe(true);
    expect(result.refreshToken).not.toBe(refreshTok);
    expect(sessions.get('s-1')?.revokedAt).not.toBeNull();
    expect(sessions.get('s-1')?.replacedBySessionId).toBeTruthy();
    expect(created).toHaveLength(1);
    expect(sessions.size).toBe(2);
  });
});

describe('AuthSessionService.revokeRefreshSession', () => {
  it('returns false when the refresh token does not verify', async () => {
    const { prisma } = buildPrisma(null);
    const token = buildTokenService(null);
    const svc = new AuthSessionService(prisma, token, buildUserRepo(ACTIVE_USER));
    expect(await svc.revokeRefreshSession('garbage')).toBe(false);
    expect(await svc.revokeRefreshSession(null)).toBe(false);
    expect(await svc.revokeRefreshSession(undefined)).toBe(false);
  });

  it('revokes a matching session and returns true', async () => {
    const refreshTok = 'rt:s-1:u-1';
    const { prisma, sessions } = buildPrisma({
      id: 's-1',
      userId: 'u-1',
      tokenHash: sha256(refreshTok),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const token = buildTokenService({ sub: 'u-1', sid: 's-1' });
    const svc = new AuthSessionService(prisma, token, buildUserRepo(ACTIVE_USER));
    expect(await svc.revokeRefreshSession(refreshTok)).toBe(true);
    expect(sessions.get('s-1')?.revokedAt).not.toBeNull();
  });
});

describe('AuthSessionService.revokeAllForUser', () => {
  it('revokes every active session for the user but leaves already-revoked ones unchanged', async () => {
    const { prisma, sessions } = buildPrisma({
      id: 's-active',
      userId: 'u-1',
      tokenHash: sha256('x'),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: null,
      replacedBySessionId: null,
    });
    const oldRevokedAt = new Date(Date.now() - 1_000_000);
    sessions.set('s-old', {
      id: 's-old',
      userId: 'u-1',
      tokenHash: sha256('y'),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      revokedAt: oldRevokedAt,
      replacedBySessionId: null,
    });
    const svc = new AuthSessionService(
      prisma,
      buildTokenService(null),
      buildUserRepo(ACTIVE_USER),
    );
    await svc.revokeAllForUser('u-1');
    expect(sessions.get('s-active')?.revokedAt).not.toBeNull();
    expect(sessions.get('s-old')?.revokedAt?.getTime()).toBe(oldRevokedAt.getTime());
  });
});
