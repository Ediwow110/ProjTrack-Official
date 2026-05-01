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
  alwaysFresh?: boolean;
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
    return this.issue({
      userId,
      type: AccountActionTokenType.ACCOUNT_ACTIVATION,
      alwaysFresh: true,
    });
  }

  async consumePasswordReset(ref: string, token: string) {
    return this.consume(AccountActionTokenType.PASSWORD_RESET, ref, token);
  }

  async consumeActivation(ref: string, token: string) {
    return this.consume(AccountActionTokenType.ACCOUNT_ACTIVATION, ref, token);
  }

  async validateActivation(ref: string, token: string) {
    await this.validate(AccountActionTokenType.ACCOUNT_ACTIVATION, ref, token);
    return { valid: true };
  }

  async consumePasswordResetTx(tx: any, ref: string, token: string) {
    return this.consume(AccountActionTokenType.PASSWORD_RESET, ref, token, tx);
  }

  async consumeActivationTx(tx: any, ref: string, token: string) {
    return this.consume(AccountActionTokenType.ACCOUNT_ACTIVATION, ref, token, tx);
  }

  private async issue(input: IssueInput) {
    const now = new Date();
    const active = await this.prisma.accountActionToken.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (active && !input.alwaysFresh) {
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
          data: { revokedAt: now },
        });
      }
    }

    if (input.alwaysFresh) {
      await this.prisma.accountActionToken.updateMany({
        where: {
          userId: input.userId,
          type: input.type,
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
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
    const { client, record, now } = await this.resolveValidRecord(type, ref, token, tx);

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
        throw new BadRequestException('SETUP_LINK_ALREADY_USED: This setup link has already been used.');
      }
      if (current.usedAt) {
        throw new BadRequestException('SETUP_LINK_ALREADY_USED: This setup link has already been used.');
      }
      if (current.expiresAt.getTime() <= now.getTime()) {
        throw new BadRequestException('SETUP_LINK_EXPIRED: This setup link has expired. Please request a new activation email from your administrator.');
      }
      throw new BadRequestException('SETUP_LINK_ALREADY_USED: This setup link has already been used.');
    }

    return record.user;
  }

  private async validate(type: AccountActionTokenType, ref: string, token: string, tx?: any) {
    const { record } = await this.resolveValidRecord(type, ref, token, tx);
    return record.user;
  }

  private async resolveValidRecord(type: AccountActionTokenType, ref: string, token: string, tx?: any) {
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
      throw new BadRequestException('SETUP_LINK_ALREADY_USED: This setup link has already been used.');
    }
    const now = new Date();
    if (record.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('SETUP_LINK_EXPIRED: This setup link has expired. Please request a new activation email from your administrator.');
    }

    if (record.user.status === 'ACTIVE') {
      throw new BadRequestException('ACCOUNT_ALREADY_ACTIVE: This account is already active. Please log in.');
    }

    const suppliedHash = accountActionTokenHash(rawToken);
    if (!safeCompareTokenHash(record.tokenHash, suppliedHash)) {
      throw new NotFoundException('Account action token not found.');
    }
    return { client, record, now };
  }
}
