import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountActionTokenService } from './account-action-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountActionTokenType } from '../prisma/prisma-compat';
import { ACCOUNT_ACTION_TOKEN_TTL_MS } from '../common/constants/mail-policy.constants';
import { accountActionTokenHash } from './token-crypto';

describe('AccountActionTokenService TTL Policy', () => {
  let prisma: any;
  let service: AccountActionTokenService;

  beforeEach(() => {
    prisma = {
      accountActionToken: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new AccountActionTokenService(prisma as PrismaService);
  });

  it('issues a password reset token with approximately 15 minutes TTL', async () => {
    prisma.accountActionToken.findFirst.mockResolvedValue(null);
    prisma.accountActionToken.create.mockResolvedValue({});

    const now = Date.now();
    const result = await service.issuePasswordReset('user-1');

    const expiresAt = result.expiresAt.getTime();
    const diffMs = expiresAt - now;

    // Allow 1 second tolerance for execution time
    expect(diffMs).toBeGreaterThanOrEqual(ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET - 1000);
    expect(diffMs).toBeLessThanOrEqual(ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET + 1000);
    expect(ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET).toBe(15 * 60 * 1000);
  });

  it('issues an account activation token with approximately 1 hour TTL', async () => {
    prisma.accountActionToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.accountActionToken.create.mockResolvedValue({});

    const now = Date.now();
    const result = await service.issueActivation('user-1');

    const expiresAt = result.expiresAt.getTime();
    const diffMs = expiresAt - now;

    // Allow 1 second tolerance
    expect(diffMs).toBeGreaterThanOrEqual(ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION - 1000);
    expect(diffMs).toBeLessThanOrEqual(ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION + 1000);
    expect(ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION).toBe(60 * 60 * 1000);
  });

  it('rejects an expired token during consumption', async () => {
    const expiredDate = new Date(Date.now() - 1000);
    prisma.accountActionToken.findUnique.mockResolvedValue({
      id: 'token-1',
      type: AccountActionTokenType.PASSWORD_RESET,
      expiresAt: expiredDate,
      usedAt: null,
      revokedAt: null,
      tokenHash: 'some-hash',
      user: { status: 'PENDING' },
    });

    // Mock hash comparison to pass
    const { accountActionTokenHash } = require('./token-crypto');
    const validToken = 'reset_valid';
    prisma.accountActionToken.findUnique.mockResolvedValue({
      id: 'token-1',
      type: AccountActionTokenType.PASSWORD_RESET,
      expiresAt: expiredDate,
      usedAt: null,
      revokedAt: null,
      tokenHash: accountActionTokenHash(validToken),
      user: { status: 'PENDING' },
    });

    await expect(service.consumePasswordReset('ref-1', validToken)).rejects.toThrow(/expired/i);
  });

  describe('exact TTL boundary and one-time-use behavior (regression for BUG-TOKEN-001)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('password reset token is valid just before 15-minute expiry and invalid exactly at/after expiry', async () => {
      const userId = 'user-boundary-reset';
      const now = new Date('2026-06-01T12:00:00.000Z');
      jest.setSystemTime(now);

      prisma.accountActionToken.findFirst.mockResolvedValue(null);
      prisma.accountActionToken.create.mockImplementation(async (args: any) => ({
        id: 'token-reset-1',
        ...args.data,
      }));

      const issued = await service.issuePasswordReset(userId);
      expect(issued.expiresAt.getTime()).toBe(now.getTime() + 15 * 60 * 1000);

      // Just before expiry (14m 59s 999ms later) → still valid
      jest.setSystemTime(new Date(now.getTime() + 15 * 60 * 1000 - 1));
      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-reset-1',
        type: AccountActionTokenType.PASSWORD_RESET,
        expiresAt: issued.expiresAt,
        usedAt: null,
        revokedAt: null,
        tokenHash: accountActionTokenHash('reset-token'),
        user: { status: 'PENDING' },
      });

      // Mock successful updateMany for the consume path
      prisma.accountActionToken.updateMany.mockResolvedValueOnce({ count: 1 });

      // Should not throw
      await expect(
        service.consumePasswordReset('ref-reset', 'reset-token'),
      ).resolves.toBeDefined();

      // Exactly at expiry → expired (implementation uses < now)
      jest.setSystemTime(issued.expiresAt);
      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-reset-1',
        type: AccountActionTokenType.PASSWORD_RESET,
        expiresAt: issued.expiresAt,
        usedAt: null,
        revokedAt: null,
        tokenHash: accountActionTokenHash('reset-token'),
        user: { status: 'PENDING' },
      });

      await expect(
        service.consumePasswordReset('ref-reset', 'reset-token'),
      ).rejects.toThrow(/expired/i);
    });

    it('account activation token is valid just before 1-hour expiry and invalid at/after expiry', async () => {
      const userId = 'user-boundary-activation';
      const now = new Date('2026-06-01T12:00:00.000Z');
      jest.setSystemTime(now);

      prisma.accountActionToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.accountActionToken.create.mockImplementation(async (args: any) => ({
        id: 'token-act-1',
        ...args.data,
      }));

      const issued = await service.issueActivation(userId);
      expect(issued.expiresAt.getTime()).toBe(now.getTime() + 60 * 60 * 1000);

      // Just before expiry → valid
      jest.setSystemTime(new Date(now.getTime() + 60 * 60 * 1000 - 1));
      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-act-1',
        type: AccountActionTokenType.ACCOUNT_ACTIVATION,
        expiresAt: issued.expiresAt,
        usedAt: null,
        revokedAt: null,
        tokenHash: accountActionTokenHash('act-token'),
        user: { status: 'PENDING' },
      });

      // Mock successful updateMany for the consume path
      prisma.accountActionToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(
        service.consumeActivation('ref-act', 'act-token'),
      ).resolves.toBeDefined();

      // At expiry → expired
      jest.setSystemTime(issued.expiresAt);
      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-act-1',
        type: AccountActionTokenType.ACCOUNT_ACTIVATION,
        expiresAt: issued.expiresAt,
        usedAt: null,
        revokedAt: null,
        tokenHash: accountActionTokenHash('act-token'),
        user: { status: 'PENDING' },
      });

      await expect(
        service.consumeActivation('ref-act', 'act-token'),
      ).rejects.toThrow(/expired/i);
    });

    it('used reset token cannot be reused (one-time use)', async () => {
      const userId = 'user-onetime-reset';
      const now = new Date('2026-06-01T12:00:00.000Z');
      jest.setSystemTime(now);

      const token = 'onetime-reset-token';
      const hash = accountActionTokenHash(token);

      // First successful consume marks it used
      prisma.accountActionToken.findUnique.mockResolvedValueOnce({
        id: 'token-onetime-1',
        type: AccountActionTokenType.PASSWORD_RESET,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        usedAt: null,
        revokedAt: null,
        tokenHash: hash,
        user: { status: 'PENDING' },
      });

      prisma.accountActionToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.consumePasswordReset('ref-onetime', token)).resolves.toBeDefined();

      // Second consume should fail as already used
      prisma.accountActionToken.findUnique.mockResolvedValueOnce({
        id: 'token-onetime-1',
        type: AccountActionTokenType.PASSWORD_RESET,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        usedAt: now,
        revokedAt: null,
        tokenHash: hash,
        user: { status: 'PENDING' },
      });

      await expect(service.consumePasswordReset('ref-onetime', token)).rejects.toThrow(/already used/i);
    });

    it('revoked token cannot be used', async () => {
      const userId = 'user-revoked';
      const now = new Date('2026-06-01T12:00:00.000Z');
      jest.setSystemTime(now);

      const token = 'revoked-token';
      const hash = accountActionTokenHash(token);

      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-revoked-1',
        type: AccountActionTokenType.PASSWORD_RESET,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        usedAt: null,
        revokedAt: now, // revoked
        tokenHash: hash,
        user: { status: 'PENDING' },
      });

      await expect(service.consumePasswordReset('ref-revoked', token)).rejects.toThrow(/already used/i);
    });

    it('token type is enforced (activation token rejected by reset consume)', async () => {
      const userId = 'user-type-mismatch';
      const now = new Date('2026-06-01T12:00:00.000Z');
      jest.setSystemTime(now);

      const token = 'activation-token-used-as-reset';
      const hash = accountActionTokenHash(token);

      prisma.accountActionToken.findUnique.mockResolvedValue({
        id: 'token-type-1',
        type: AccountActionTokenType.ACCOUNT_ACTIVATION, // wrong type
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        usedAt: null,
        revokedAt: null,
        tokenHash: hash,
        user: { status: 'PENDING' },
      });

      await expect(service.consumePasswordReset('ref-type', token)).rejects.toThrow(/not found/i);
    });
  });
});
