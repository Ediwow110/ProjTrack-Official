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

  async createRefreshSession(user: SessionUser, meta?: RequestMeta, remember = false) {
    const sessionId = randomUUID();
    const refreshTtlMs = remember ? this.tokenService.getRememberRefreshTtlMs() : this.tokenService.getRefreshTtlMs();
    const refreshToken = this.tokenService.createRefreshToken(user, sessionId, refreshTtlMs, remember);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs),
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

    const sessionId = String(payload.sid);
    const userId = String(payload.sub);
    const remember = payload.remember === true;
    const refreshTtlMs = remember ? this.tokenService.getRememberRefreshTtlMs() : this.tokenService.getRefreshTtlMs();
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Refresh session not found.');
    }

    if (session.revokedAt) {
      if (session.replacedBySessionId) {
        await this.revokeAllForUser(session.userId);
      }
      throw new UnauthorizedException('Refresh token has already been rotated or revoked.');
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (session.tokenHash !== tokenHash) {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Refresh token mismatch detected.');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('User not found or inactive.');
    }

    const nextSessionId = randomUUID();
    const nextRefreshToken = this.tokenService.createRefreshToken(
      { id: user.id, role: user.role, email: user.email },
      nextSessionId,
      refreshTtlMs,
      remember,
    );

    const rotation = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authSession.updateMany({
        where: {
          id: session.id,
          userId,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
          replacedBySessionId: nextSessionId,
        },
      });

      if (consumed.count !== 1) {
        const current = await tx.authSession.findUnique({
          where: { id: session.id },
          select: { userId: true, replacedBySessionId: true },
        });
        if (current?.replacedBySessionId) {
          await tx.authSession.updateMany({
            where: { userId: current.userId, revokedAt: null },
            data: { revokedAt: now, lastUsedAt: now },
          });
        }
        return { rotated: false };
      }

      await tx.authSession.create({
        data: {
          id: nextSessionId,
          userId: user.id,
          tokenHash: this.hashToken(nextRefreshToken),
          expiresAt: new Date(now.getTime() + refreshTtlMs),
          lastUsedAt: now,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      });

      return { rotated: true };
    });

    if (!rotation.rotated) {
      throw new UnauthorizedException('Refresh token has already been rotated or revoked.');
    }

    return {
      user,
      refreshToken: nextRefreshToken,
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
