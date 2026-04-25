import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AuditRecordCreateInput) {
    return this.prisma.auditLog.create({
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

  async listAuditLogs() {
    return this.prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
