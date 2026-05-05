import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ValidateAccountActionDto } from './dto/validate-account-action.dto';
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
import { PrismaService } from '../prisma/prisma.service';
import {
  canSendPasswordRecoveryInstructions,
  isActiveUserStatus,
  isBlockedPasswordRecoveryStatus,
  isPendingSetupStatus,
} from '../common/utils/account-setup-status';
import { userDisplayName } from '../common/utils/user-display-name';

type RequestMeta = { ipAddress?: string; userAgent?: string };
const FORGOT_PASSWORD_GENERIC_MESSAGE = 'If this email exists, we sent instructions.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    private readonly prisma: PrismaService,
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

    await this.authThrottle.reset('login', throttleKey);
    const refreshSession = await this.authSessions.createRefreshSession(
      { id: user.id, role: user.role, email: user.email },
      requestMeta,
      body.remember === true,
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
        name: userDisplayName(user),
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
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found.');
    }
    const avatarRelativePath = await this.resolveAvatarRelativePath(user.avatarRelativePath);
    return {
      id: user.id,
      identifier: this.userRepository.getPrimaryLoginIdentifier(user),
      email: user.email,
      role: user.role,
      status: user.status,
      name: userDisplayName(user),
      avatarRelativePath,
    };
  }

  async activate(body: ActivateAccountDto) {
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
    this.passwordService.assertStrongPassword(body.password);

    let user: any;
    await this.prisma.$transaction(async (tx) => {
      user = await this.accountActionTokens.consumeActivationTx(tx, body.ref, body.token);
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: this.passwordService.hash(body.password),
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
    });

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

  async validateActivation(body: ValidateAccountActionDto) {
    return this.accountActionTokens.validateActivation(body.ref, body.token);
  }

  async forgotPassword(body: RequestResetDto, requestMeta?: RequestMeta) {
    const normalizedEmail = String(body.email ?? '').trim().toLowerCase();
    const requestedRole = String(body.role ?? '').trim().toUpperCase();
    const throttleKey = this.authThrottle.buildKey('forgot-password', normalizedEmail, requestMeta?.ipAddress);
    const diagnostics: Record<string, unknown> = {
      event: 'auth.forgot_password',
      normalizedEmail,
      requestedRole: requestedRole || null,
      matchedUser: false,
      roleMatched: false,
      userStatus: null,
      throttled: false,
      tokenCreated: false,
      tokenReused: false,
      mailJobCreated: false,
      mailJobId: null,
      skippedReason: null,
    };

    try {
      await this.authThrottle.assertNotBlocked('forgot-password', throttleKey);
    } catch (error) {
      diagnostics.throttled = true;
      diagnostics.skippedReason = 'throttled';
      this.logForgotPasswordDiagnostics(diagnostics);
      throw error;
    }
    await this.authThrottle.recordFailure('forgot-password', throttleKey);
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      diagnostics.skippedReason = 'user_not_found';
      this.logForgotPasswordDiagnostics(diagnostics);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }
    diagnostics.matchedUser = true;
    diagnostics.userStatus = user.status;

    const roleMatched = !requestedRole || user.role === requestedRole;
    diagnostics.roleMatched = roleMatched;
    if (!roleMatched) {
      diagnostics.skippedReason = 'role_mismatch';
      await this.auditLogs.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RECOVERY_SKIPPED',
        module: 'Auth',
        target: normalizedEmail,
        entityId: user.id,
        result: 'Denied',
        details: JSON.stringify(diagnostics),
        ipAddress: requestMeta?.ipAddress,
      });
      this.logForgotPasswordDiagnostics(diagnostics);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }

    if (isPendingSetupStatus(user.status)) {
      diagnostics.skippedReason = 'pending_setup_requires_admin_invite';
      await this.auditLogs.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RECOVERY_SKIPPED',
        module: 'Auth',
        target: normalizedEmail,
        entityId: user.id,
        result: 'Denied',
        details: JSON.stringify(diagnostics),
        ipAddress: requestMeta?.ipAddress,
      });
      this.logForgotPasswordDiagnostics(diagnostics);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }

    if (!isActiveUserStatus(user.status) || !canSendPasswordRecoveryInstructions(user.status)) {
      diagnostics.skippedReason = isBlockedPasswordRecoveryStatus(user.status)
        ? 'blocked_status'
        : 'not_reset_eligible';
      await this.auditLogs.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RECOVERY_SKIPPED',
        module: 'Auth',
        target: normalizedEmail,
        entityId: user.id,
        result: isBlockedPasswordRecoveryStatus(user.status) ? 'Denied' : 'Failed',
        details: JSON.stringify(diagnostics),
        ipAddress: requestMeta?.ipAddress,
      });
      this.logForgotPasswordDiagnostics(diagnostics);
      return { success: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE };
    }

    const session = await this.accountActionTokens.issuePasswordReset(user.id);
    diagnostics.tokenCreated = !session.reused;
    diagnostics.tokenReused = session.reused;
    const resetLink = buildResetPasswordLink({
      token: session.token,
      ref: session.publicRef,
      role: user.role,
    });
    const mailJob = await this.mailService.queuePasswordReset({
      to: user.email,
      recipientName: userDisplayName(user),
      firstName: user.firstName,
      resetLink,
      expiresAt: session.expiresAt,
      publicRef: session.publicRef,
      firstTimeSetup: false,
    });
    diagnostics.mailJobCreated = true;
    diagnostics.mailJobId = mailJob.id;

    await this.auditLogs.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      module: 'Auth',
      target: normalizedEmail,
      entityId: user.id,
      result: 'Queued',
      details: JSON.stringify(diagnostics),
      ipAddress: requestMeta?.ipAddress,
    });
    this.logForgotPasswordDiagnostics(diagnostics);
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
    let firstTimeSetup = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        user = await this.accountActionTokens.consumePasswordResetTx(tx, body.ref, body.token);
        firstTimeSetup = isPendingSetupStatus(user.status);
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: this.passwordService.hash(body.password),
            status: firstTimeSetup ? 'ACTIVE' : undefined,
            updatedAt: new Date(),
          },
        });
        await tx.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
      });
    } catch (error) {
      await this.authThrottle.recordFailure('reset-password', throttleKey);
      throw error;
    }

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

  private logForgotPasswordDiagnostics(diagnostics: Record<string, unknown>) {
    this.logger.log(JSON.stringify(diagnostics));
  }
}
