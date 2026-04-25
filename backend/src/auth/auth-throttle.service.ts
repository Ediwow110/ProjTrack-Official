import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ThrottleAction = 'login' | 'forgot-password' | 'reset-password';

@Injectable()
export class AuthThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  private getConfig(action: ThrottleAction) {
    switch (action) {
      case 'forgot-password':
        return {
          limit: Number(process.env.AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS || 5),
          windowMs: Number(process.env.AUTH_FORGOT_PASSWORD_WINDOW_MS || 60 * 60 * 1000),
          blockMs: Number(process.env.AUTH_FORGOT_PASSWORD_BLOCK_MS || 60 * 60 * 1000),
        };
      case 'reset-password':
        return {
          limit: Number(process.env.AUTH_RESET_PASSWORD_MAX_ATTEMPTS || 5),
          windowMs: Number(process.env.AUTH_RESET_PASSWORD_WINDOW_MS || 60 * 60 * 1000),
          blockMs: Number(process.env.AUTH_RESET_PASSWORD_BLOCK_MS || 60 * 60 * 1000),
        };
      case 'login':
      default:
        return {
          limit: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5),
          windowMs: Number(process.env.AUTH_LOGIN_WINDOW_MS || 15 * 60 * 1000),
          blockMs: Number(process.env.AUTH_LOGIN_BLOCK_MS || 15 * 60 * 1000),
        };
    }
  }

  private formatKey(parts: Array<string | undefined | null>) {
    return parts
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean)
      .join('|');
  }

  buildKey(action: ThrottleAction, identifier?: string, ipAddress?: string) {
    return this.formatKey([action, identifier, ipAddress]);
  }

  async assertNotBlocked(action: ThrottleAction, key: string) {
    if (!key) return;

    const row = await this.prisma.authRateLimit.findUnique({
      where: {
        action_key: { action, key },
      },
    });

    if (!row) return;

    if (row.blockedUntil && row.blockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        `Too many ${action} attempts. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const config = this.getConfig(action);
    if (row.firstAttemptAt.getTime() + config.windowMs <= Date.now()) {
      await this.prisma.authRateLimit.delete({
        where: { action_key: { action, key } },
      });
    }
  }

  async recordFailure(action: ThrottleAction, key: string) {
    if (!key) return;

    const config = this.getConfig(action);
    const now = new Date();
    const existing = await this.prisma.authRateLimit.findUnique({
      where: {
        action_key: { action, key },
      },
    });

    if (!existing || existing.firstAttemptAt.getTime() + config.windowMs <= now.getTime()) {
      await this.prisma.authRateLimit.upsert({
        where: { action_key: { action, key } },
        update: {
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          blockedUntil: null,
        },
        create: {
          action,
          key,
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        },
      });
      return;
    }

    const attempts = existing.attempts + 1;
    await this.prisma.authRateLimit.update({
      where: { action_key: { action, key } },
      data: {
        attempts,
        lastAttemptAt: now,
        blockedUntil: attempts >= config.limit ? new Date(now.getTime() + config.blockMs) : null,
      },
    });
  }

  async reset(action: ThrottleAction, key: string) {
    if (!key) return;

    await this.prisma.authRateLimit.deleteMany({
      where: { action, key },
    });
  }
}
