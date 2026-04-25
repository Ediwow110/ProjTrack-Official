import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { UserRepository } from '../repositories/user.repository';

type SessionUser = { id: string; role: string; email: string };
type RequestMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async createRefreshSession(user: SessionUser, meta?: RequestMeta) {
    const sessionId = randomUUID();
    const refreshToken = this.tokenService.createRefreshToken(user, sessionId);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.tokenService.getRefreshTtlMs()),
        lastUsedAt: new Date(),
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    return { sessionId, refreshToken };
  }

  async rotateRefreshSession(refreshToken: string, meta?: RequestMeta) {
    const payload: any = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: String(payload.sid) },
    });

    if (!session || session.userId !== String(payload.sub)) {
      throw new UnauthorizedException('Refresh session not found.');
    }

    if (session.revokedAt) {
      if (session.replacedBySessionId) {
        await this.revokeAllForUser(session.userId);
      }
      throw new UnauthorizedException('Refresh token has already been rotated or revoked.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (session.tokenHash !== this.hashToken(refreshToken)) {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Refresh token mismatch detected.');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('User not found or inactive.');
    }

    const next = await this.createRefreshSession({ id: user.id, role: user.role, email: user.email }, meta);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedBySessionId: next.sessionId,
      },
    });

    return {
      user,
      refreshToken: next.refreshToken,
      accessToken: this.tokenService.createAccessToken({ id: user.id, role: user.role, email: user.email }),
    };
  }

  async revokeRefreshSession(refreshToken?: string | null) {
    if (!refreshToken) return false;

    const payload: any = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload?.sid) return false;

    const result = await this.prisma.authSession.updateMany({
      where: {
        id: String(payload.sid),
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
  }
}
