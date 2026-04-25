import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MailService } from '../mail/mail.service';
import { AuthSessionService } from './auth-session.service';
import { AuthThrottleService } from './auth-throttle.service';
import { AccountActionTokenService } from './account-action-token.service';
import { buildResetPasswordLink } from '../common/utils/frontend-links';
import { FilesService } from '../files/files.service';
import {
  canSendPasswordRecoveryInstructions,
  isBlockedPasswordRecoveryStatus,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';
import { userDisplayName } from '../common/utils/user-display-name';

type RequestMeta = { ipAddress?: string; userAgent?: string };
const FORGOT_PASSWORD_GENERIC_MESSAGE = 'If this email exists, we sent instructions.';

@Injectable()
export class AuthService {
  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly userRepository: UserRepository,
    private readonly mailService: MailService,
    private readonly authSessions: AuthSessionService,
    private readonly authThrottle: AuthThrottleService,
    private readonly accountActionTokens: AccountActionTokenService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly files: FilesService,
  ) {}

  async login(body: LoginDto, requestMeta?: RequestMeta) {
    const identifier = String(body.identifier ?? '').trim();
    const throttleKey = this.authThrottle.buildKey('login', `${body.expectedRole}:${identifier}`, requestMeta?.ipAddress);
    await this.authThrottle.assertNotBlocked('login', throttleKey);
    const user = await this.userRepository.findByLoginIdentifier(identifier, body.expectedRole);

    if (!user || user.role !== body.expectedRole || !this.passwordService.compare(body.password, (user as any).password ?? (user as any).passwordHash)) {
      await this.authThrottle.recordFailure('login', throttleKey);
      await this.auditLogs.record({
        actorRole: body.expectedRole,
        action: 'LOGIN_FAILED',
        module: 'Auth',
        target: identifier,
        result: 'Denied',
        details: 'Invalid credentials or role mismatch.',
        ipAddress: requestMeta?.ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials or role mismatch.');
    }

    if (user.status !== 'ACTIVE') {
      await this.authThrottle.recordFailure('login', throttleKey);
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase().replace(/_/g, ' ')}.`);
    }

    if (this.passwordService.needsRehash((user as any).password ?? (user as any).passwordHash)) {
      await this.userRepository.updateAuthFields(user.id, {
        password: this.passwordService.hash(body.password),
        updatedAt: new Date().toISOString(),
      });
    }

    await this.authThrottle.reset('login', throttleKey);
    const refreshSession = await this.authSessions.createRefreshSession(
      { id: user.id, role: user.role, email: user.email },
      requestMeta,
    );

    await this.auditLogs.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      module: 'Auth',
      target: identifier,
      entityId: user.id,
      result: 'Success',
      details: 'User authenticated through backend auth flow.',
      ipAddress: requestMeta?.ipAddress,
    });

    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);

    return {
      message: 'Login successful.',
      user: {
        id: user.id,
        identifier: this.userRepository.getPrimaryLoginIdentifier(user),
        email: user.email,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
        status: user.status,
        avatarRelativePath,
      },
      accessToken: this.tokenService.createAccessToken({ id: user.id, role: user.role, email: user.email }),
      refreshToken: refreshSession.refreshToken,
    };
  }

  async refresh(body: { refreshToken: string }, requestMeta?: RequestMeta) {
    if (!body?.refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const { accessToken, refreshToken } = await this.authSessions.rotateRefreshSession(body.refreshToken, requestMeta);
    return { accessToken, refreshToken };
  }

  async logout(body?: { refreshToken?: string }, _requestMeta?: RequestMeta) {
    await this.authSessions.revokeRefreshSession(body?.refreshToken);
    return { success: true, message: 'Logged out.' };
  }

  async me(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    const token = authorization.slice('Bearer '.length).trim();
    const payload: any = this.tokenService.verifyAccessToken(token);
    if (!payload?.sub || payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token.');
    }
    const user = await this.userRepository.findById(String(payload.sub));
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);
    return {
      id: user.id,
      identifier: this.userRepository.getPrimaryLoginIdentifier(user),
      email: user.email,
      role: user.role,
      status: user.status,
      name: `${user.firstName} ${user.lastName}`,
      avatarRelativePath,
    };
  }

  async activate(body: ActivateAccountDto) {
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
    this.passwordService.assertStrongPassword(body.password);

    const user = await this.accountActionTokens.consumeActivation(body.ref, body.token);

    await this.userRepository.updateAuthFields(user.id, {
      password: this.passwordService.hash(body.password),
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
    await this.authSessions.revokeAllForUser(user.id);

    await this.auditLogs.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'ACCOUNT_ACTIVATED',
      module: 'Auth',
      target: user.email,
      entityId: user.id,
      result: 'Success',
      details: 'User completed password setup and activated account.',
    });

    return { success: true, message: 'Account activated successfully.' };
  }

  async forgotPassword(body: RequestResetDto, requestMeta?: RequestMeta) {
    const throttleKey = this.authThrottle.buildKey('forgot-password', body.email, requestMeta?.ipAddress);
    await this.authThrottle.assertNotBlocked('forgot-password', throttleKey);
    const user = await this.userRepository.findByEmail(body.email);
    if (!user) {
      await this.authThrottle.recordFailure('forgot-password', throttleKey);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }

    if (!canSendPasswordRecoveryInstructions(user.status)) {
      await this.auditLogs.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RECOVERY_SKIPPED',
        module: 'Auth',
        target: user.email,
        entityId: user.id,
        result: isBlockedPasswordRecoveryStatus(user.status) ? 'Denied' : 'Failed',
        details: `Password recovery instructions were not sent because the account status is ${String(
          user.status,
        )
          .toLowerCase()
          .replace(/_/g, ' ')}.`,
        ipAddress: requestMeta?.ipAddress,
      });
      await this.authThrottle.reset('forgot-password', throttleKey);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }

    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    const firstTimeSetup = isPendingSetupStatus(user.status);
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: user.role,
      mode: firstTimeSetup ? 'setup' : undefined,
    });
    await this.mailService.queuePasswordReset({
      to: user.email,
      recipientName: userDisplayName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
      firstTimeSetup,
    });

    await this.auditLogs.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: firstTimeSetup ? 'PASSWORD_SETUP_REQUESTED' : 'PASSWORD_RESET_REQUESTED',
      module: 'Auth',
      target: user.email,
      entityId: user.id,
      result: 'Queued',
      details: firstTimeSetup
        ? 'First-time password setup email queued.'
        : 'Password reset email queued.',
      ipAddress: requestMeta?.ipAddress,
    });
    await this.authThrottle.reset('forgot-password', throttleKey);

    return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  async resetPassword(body: ResetPasswordDto, requestMeta?: RequestMeta) {
    const throttleKey = this.authThrottle.buildKey('reset-password', body.ref, requestMeta?.ipAddress);
    await this.authThrottle.assertNotBlocked('reset-password', throttleKey);
    if (body.password !== body.confirmPassword) {
      await this.authThrottle.recordFailure('reset-password', throttleKey);
      throw new BadRequestException('Passwords do not match.');
    }
    this.passwordService.assertStrongPassword(body.password);

    let user: any;
    try {
      user = await this.accountActionTokens.consumePasswordReset(body.ref, body.token);
    } catch (error) {
      await this.authThrottle.recordFailure('reset-password', throttleKey);
      throw error;
    }
    const firstTimeSetup = isPendingSetupStatus(user.status);

    await this.userRepository.updateAuthFields(user.id, {
      password: this.passwordService.hash(body.password),
      status: firstTimeSetup ? 'ACTIVE' : undefined,
      updatedAt: new Date().toISOString(),
    });
    await this.authSessions.revokeAllForUser(user.id);

    await this.auditLogs.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: firstTimeSetup ? 'PASSWORD_SETUP_COMPLETED' : 'PASSWORD_RESET_COMPLETED',
      module: 'Auth',
      target: user.email,
      entityId: user.id,
      result: 'Success',
      details: firstTimeSetup
        ? 'User completed first-time password setup.'
        : 'User completed password reset.',
      ipAddress: requestMeta?.ipAddress,
    });
    await this.authThrottle.reset('reset-password', throttleKey);

    return { success: true, message: 'Password updated successfully.' };
  }

  private async resolveAvatarRelativePath(relativePath?: string | null) {
    const candidate = String(relativePath || '').trim();
    if (!candidate) return '';
    return (await this.files.hasObject(candidate)) ? candidate : '';
  }
}
