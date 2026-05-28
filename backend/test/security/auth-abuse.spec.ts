import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';

function buildAuthService(overrides: Partial<Record<string, any>> = {}) {
  const auditLogs = overrides.auditLogs ?? { record: jest.fn(async () => undefined) };
  const userRepository =
    overrides.userRepository ??
    {
      findByLoginIdentifier: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getPrimaryLoginIdentifier: jest.fn((user: any) => user.email),
    };
  const mailService = overrides.mailService ?? { queuePasswordReset: jest.fn() };
  const authSessions =
    overrides.authSessions ??
    {
      createRefreshSession: jest.fn(),
      rotateRefreshSession: jest.fn(),
      revokeRefreshSession: jest.fn(),
    };
  const authThrottle =
    overrides.authThrottle ??
    {
      buildKey: jest.fn((scope: string, key: string, ip?: string) => `${scope}:${key}:${ip ?? ''}`),
      assertNotBlocked: jest.fn(async () => undefined),
      recordFailure: jest.fn(async () => undefined),
      reset: jest.fn(async () => undefined),
    };
  const accountActionTokens =
    overrides.accountActionTokens ??
    {
      consumePasswordResetTx: jest.fn(),
      consumeActivationTx: jest.fn(),
      validateActivation: jest.fn(),
      issuePasswordReset: jest.fn(),
    };
  const passwordService =
    overrides.passwordService ??
    {
      compare: jest.fn(),
      hash: jest.fn((value: string) => `hashed:${value}`),
      assertStrongPassword: jest.fn(),
    };
  const tokenService =
    overrides.tokenService ??
    {
      createAccessToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
  const files = overrides.files ?? { hasObject: jest.fn(async () => false) };
  const prisma =
    overrides.prisma ??
    {
      $transaction: jest.fn(async (callback: any) => callback({ user: { update: jest.fn() }, authSession: { updateMany: jest.fn() } })),
    };

  const service = new AuthService(
    auditLogs,
    userRepository,
    mailService,
    authSessions,
    authThrottle,
    accountActionTokens,
    passwordService,
    tokenService,
    files,
    prisma,
  );

  return {
    service,
    auditLogs,
    userRepository,
    mailService,
    authSessions,
    authThrottle,
    accountActionTokens,
    passwordService,
    tokenService,
    files,
    prisma,
  };
}

const ACTIVE_STUDENT = {
  id: 'student-1',
  email: 'student@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  firstName: 'Student',
  lastName: 'One',
  passwordHash: 'stored-hash',
  avatarRelativePath: null,
};

describe('auth abuse security gate', () => {
  it('rejects wrong password, records throttle failure, and writes denied audit evidence', async () => {
    const ctx = buildAuthService();
    ctx.userRepository.findByLoginIdentifier.mockResolvedValue(ACTIVE_STUDENT);
    ctx.passwordService.compare.mockReturnValue(false);

    await expect(
      ctx.service.login(
        { identifier: 'student@example.com', password: 'wrong-password', expectedRole: 'STUDENT' } as any,
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(ctx.authThrottle.recordFailure).toHaveBeenCalledWith(
      'login',
      expect.stringContaining('student@example.com'),
    );
    expect(ctx.auditLogs.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED', result: 'Denied' }));
    expect(ctx.authSessions.createRefreshSession).not.toHaveBeenCalled();
  });

  it('rejects role mismatch during login even when the password is correct', async () => {
    const ctx = buildAuthService();
    ctx.userRepository.findByLoginIdentifier.mockResolvedValue({ ...ACTIVE_STUDENT, role: 'STUDENT' });
    ctx.passwordService.compare.mockReturnValue(true);

    await expect(
      ctx.service.login(
        { identifier: 'student@example.com', password: 'correct-password', expectedRole: 'ADMIN' } as any,
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(ctx.authThrottle.recordFailure).toHaveBeenCalled();
    expect(ctx.authSessions.createRefreshSession).not.toHaveBeenCalled();
  });

  it('rejects inactive users and does not issue tokens', async () => {
    const ctx = buildAuthService();
    ctx.userRepository.findByLoginIdentifier.mockResolvedValue({ ...ACTIVE_STUDENT, status: 'DEACTIVATED' });
    ctx.passwordService.compare.mockReturnValue(true);

    await expect(
      ctx.service.login(
        { identifier: 'student@example.com', password: 'correct-password', expectedRole: 'STUDENT' } as any,
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(ctx.authThrottle.recordFailure).toHaveBeenCalled();
    expect(ctx.authSessions.createRefreshSession).not.toHaveBeenCalled();
    expect(ctx.tokenService.createAccessToken).not.toHaveBeenCalled();
  });

  it('does not enumerate unknown accounts during forgot-password', async () => {
    const ctx = buildAuthService();
    ctx.userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      ctx.service.forgotPassword({ email: 'missing@example.com', role: 'STUDENT' } as any, { ipAddress: '127.0.0.1' }),
    ).resolves.toEqual({ success: true, message: 'If this email exists, we sent instructions.' });

    expect(ctx.accountActionTokens.issuePasswordReset).not.toHaveBeenCalled();
    expect(ctx.mailService.queuePasswordReset).not.toHaveBeenCalled();
  });

  it('does not enumerate role mismatches during forgot-password', async () => {
    const ctx = buildAuthService();
    ctx.userRepository.findByEmail.mockResolvedValue({ ...ACTIVE_STUDENT, role: 'STUDENT' });

    await expect(
      ctx.service.forgotPassword({ email: 'student@example.com', role: 'ADMIN' } as any, { ipAddress: '127.0.0.1' }),
    ).resolves.toEqual({ success: true, message: 'If this email exists, we sent instructions.' });

    expect(ctx.accountActionTokens.issuePasswordReset).not.toHaveBeenCalled();
    expect(ctx.mailService.queuePasswordReset).not.toHaveBeenCalled();
    expect(ctx.auditLogs.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_RECOVERY_SKIPPED' }));
  });

  it('rejects reset-password confirmation mismatches before consuming reset tokens', async () => {
    const ctx = buildAuthService();

    await expect(
      ctx.service.resetPassword(
        { ref: 'public-ref', token: 'reset-token', password: 'StrongPass123!', confirmPassword: 'DifferentPass123!' } as any,
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.authThrottle.recordFailure).toHaveBeenCalledWith('reset-password', expect.stringContaining('public-ref'));
    expect(ctx.accountActionTokens.consumePasswordResetTx).not.toHaveBeenCalled();
  });

  it('requires refresh token before attempting refresh rotation', async () => {
    const ctx = buildAuthService();

    await expect(ctx.service.refresh({ refreshToken: '' }, { ipAddress: '127.0.0.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(ctx.authSessions.rotateRefreshSession).not.toHaveBeenCalled();
  });

  it('delegates refresh token rotation to the session service', async () => {
    const ctx = buildAuthService();
    ctx.authSessions.rotateRefreshSession.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    await expect(ctx.service.refresh({ refreshToken: 'old-refresh' }, { ipAddress: '127.0.0.1' })).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    expect(ctx.authSessions.rotateRefreshSession).toHaveBeenCalledWith('old-refresh', { ipAddress: '127.0.0.1' });
  });
});
