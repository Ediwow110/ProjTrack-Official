import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountActionTokenType } from '@prisma/client';
import { ACCOUNT_ACTION_TOKEN_TTL_MS } from '../common/constants/mail-policy.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  accountActionTokenHash,
  createPublicAccountActionRef,
  createRawAccountActionToken,
  decryptAccountActionToken,
  encryptAccountActionToken,
  safeCompareTokenHash,
} from './token-crypto';

type IssueInput = {
  userId: string;
  type: AccountActionTokenType;
};

function tokenPrefix(type: AccountActionTokenType) {
  return type === AccountActionTokenType.PASSWORD_RESET ? 'reset' : 'activation';
}

function refPrefix(type: AccountActionTokenType) {
  return type === AccountActionTokenType.PASSWORD_RESET ? 'rst' : 'act';
}

function ttlMs(type: AccountActionTokenType) {
  return type === AccountActionTokenType.PASSWORD_RESET
    ? ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET
    : ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION;
}

@Injectable()
export class AccountActionTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issuePasswordReset(userId: string) {
    return this.issue({ userId, type: AccountActionTokenType.PASSWORD_RESET });
  }

  async issueActivation(userId: string) {
    return this.issue({ userId, type: AccountActionTokenType.ACCOUNT_ACTIVATION });
  }

  async consumePasswordReset(ref: string, token: string) {
    return this.consume(AccountActionTokenType.PASSWORD_RESET, ref, token);
  }

  async consumeActivation(ref: string, token: string) {
    return this.consume(AccountActionTokenType.ACCOUNT_ACTIVATION, ref, token);
  }

  async consumePasswordResetTx(tx: any, ref: string, token: string) {
    return this.consume(AccountActionTokenType.PASSWORD_RESET, ref, token, tx);
  }

  async consumeActivationTx(tx: any, ref: string, token: string) {
    return this.consume(AccountActionTokenType.ACCOUNT_ACTIVATION, ref, token, tx);
  }

  private async issue(input: IssueInput) {
    const active = await this.prisma.accountActionToken.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (active) {
      try {
        return {
          token: decryptAccountActionToken(active.encryptedToken),
          publicRef: active.publicRef,
          expiresAt: active.expiresAt,
          reused: true,
        };
      } catch {
        await this.prisma.accountActionToken.update({
          where: { id: active.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    const token = createRawAccountActionToken(tokenPrefix(input.type));
    const publicRef = createPublicAccountActionRef(refPrefix(input.type));
    const expiresAt = new Date(Date.now() + ttlMs(input.type));

    await this.prisma.accountActionToken.create({
      data: {
        userId: input.userId,
        type: input.type,
        publicRef,
        tokenHash: accountActionTokenHash(token),
        encryptedToken: encryptAccountActionToken(token),
        expiresAt,
      },
    });

    return { token, publicRef, expiresAt, reused: false };
  }

  private async consume(type: AccountActionTokenType, ref: string, token: string, tx?: any) {
    const client = tx ?? this.prisma;
    const publicRef = String(ref || '').trim();
    const rawToken = String(token || '').trim();
    if (!publicRef || !rawToken) {
      throw new BadRequestException('Token reference and token are required.');
    }

    const record = await client.accountActionToken.findUnique({
      where: { publicRef },
      include: { user: { include: { studentProfile: true, teacherProfile: true } } },
    });

    if (!record || record.type !== type) {
      throw new NotFoundException('Account action token not found.');
    }
    if (record.usedAt || record.revokedAt) {
      throw new BadRequestException('Account action token has already been used.');
    }
    const now = new Date();
    if (record.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('Account action token has expired.');
    }

    const suppliedHash = accountActionTokenHash(rawToken);
    if (!safeCompareTokenHash(record.tokenHash, suppliedHash)) {
      throw new NotFoundException('Account action token not found.');
    }

    const consumed = await client.accountActionToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      const current = await client.accountActionToken.findUnique({
        where: { id: record.id },
        select: { usedAt: true, revokedAt: true, expiresAt: true },
      });
      if (!current || current.revokedAt) {
        throw new BadRequestException('Account action token has already been used.');
      }
      if (current.usedAt) {
        throw new BadRequestException('Account action token has already been used.');
      }
      if (current.expiresAt.getTime() <= now.getTime()) {
        throw new BadRequestException('Account action token has expired.');
      }
      throw new BadRequestException('Account action token has already been used.');
    }

    return record.user;
  }
}
