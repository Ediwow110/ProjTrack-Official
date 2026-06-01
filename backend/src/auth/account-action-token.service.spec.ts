import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountActionTokenService } from './account-action-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountActionTokenType } from '../prisma/prisma-compat';
import { ACCOUNT_ACTION_TOKEN_TTL_MS } from '../common/constants/mail-policy.constants';

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
});
