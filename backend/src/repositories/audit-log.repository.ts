import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

const DEFAULT_AUDIT_LOG_LIST_TAKE = 100;
const MAX_AUDIT_LOG_LIST_TAKE = 500;

export interface AuditRecordCreateInput {
  actorUserId?: string;
  actorRole: string;
  action: string;
  module: string;
  target: string;
  entityId?: string;
  result: string;
  details?: string;
  ipAddress?: string;
  sessionId?: string;
  beforeValue?: string;
  afterValue?: string;
}

type AuditLogListOptions = {
  take?: number;
  skip?: number;
};

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private clampListTake(take?: number) {
    if (!Number.isFinite(take)) return DEFAULT_AUDIT_LOG_LIST_TAKE;
    return Math.max(1, Math.min(Math.floor(Number(take)), MAX_AUDIT_LOG_LIST_TAKE));
  }

  private clampListSkip(skip?: number) {
    if (!Number.isFinite(skip)) return 0;
    return Math.max(0, Math.floor(Number(skip)));
  }

  async create(input: AuditRecordCreateInput, tx?: any) {
    const client = tx ?? this.prisma;
    return client.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        module: input.module,
        target: input.target,
        entityId: input.entityId,
        result: input.result,
        details: input.details,
        ipAddress: input.ipAddress,
        sessionId: input.sessionId,
        beforeValue: input.beforeValue,
        afterValue: input.afterValue,
      },
    });
  }

  async listAuditLogs(options: AuditLogListOptions = {}) {
    return this.prisma.auditLog.findMany({
      take: this.clampListTake(options.take),
      skip: this.clampListSkip(options.skip),
      include: { actor: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
