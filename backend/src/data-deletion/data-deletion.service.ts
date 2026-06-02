import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDataDeletionRequestDto, ReviewDataDeletionRequestDto } from './data-deletion.dto';
import {
  normalizeDataDeletionRequestStatus,
  canTransitionDataDeletionStatus,
  CONFIRMATION_PHRASE,
} from './data-deletion.lifecycle';

type ActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class DataDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private buildActorContext(req: any): ActorContext {
    return {
      actorUserId: String(req?.user?.sub ?? '').trim() || undefined,
      actorEmail: String(req?.user?.email ?? '').trim() || undefined,
      actorRole: String(req?.user?.role ?? '').trim() || undefined,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']) : undefined,
    };
  }

  async createRequest(requesterUserId: string, dto: CreateDataDeletionRequestDto, actor?: ActorContext) {
    const confirmation = String(dto?.confirmationPhrase ?? '').trim();
    if (confirmation !== CONFIRMATION_PHRASE) {
      throw new BadRequestException('Confirmation phrase must be exactly "DELETE MY DATA".');
    }

    if (actor?.actorUserId && actor.actorUserId !== requesterUserId) {
      throw new ForbiddenException('You can only request deletion for your own account.');
    }

    const existingPending = await this.prisma.dataDeletionRequest.findFirst({
      where: { requesterUserId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('You already have a pending data deletion request.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const created = await this.prisma.dataDeletionRequest.create({
      data: {
        requesterUserId,
        status: 'PENDING',
        reason: dto.reason ? String(dto.reason).trim() || null : null,
        confirmationPhrase: confirmation,
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId ?? requesterUserId,
      actorRole: actor?.actorRole ?? user.role ?? 'USER',
      action: 'DATA_DELETION_REQUESTED',
      module: 'DataDeletion',
      target: user.email || requesterUserId,
      entityId: created.id,
      result: 'Success',
      details: `User requested account data deletion. Reason provided: ${created.reason ? 'yes' : 'no'}.`,
      ipAddress: actor?.ipAddress,
    });

    return { success: true, id: created.id, status: created.status };
  }

  async listMyRequests(userId: string) {
    return this.prisma.dataDeletionRequest.findMany({
      where: { requesterUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        reason: true,
        confirmationPhrase: true,
        reviewedByUserId: true,
        reviewedAt: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getOneForOwner(id: string, userId: string) {
    const req = await this.prisma.dataDeletionRequest.findUnique({ where: { id } });
    if (!req || req.requesterUserId !== userId) {
      throw new NotFoundException('Data deletion request not found.');
    }
    return req;
  }

  async cancelOwnRequest(id: string, userId: string, actor?: ActorContext) {
    const deletionReq = await this.prisma.dataDeletionRequest.findUnique({ where: { id } });
    if (!deletionReq || deletionReq.requesterUserId !== userId) {
      throw new NotFoundException('Data deletion request not found.');
    }
    const current = normalizeDataDeletionRequestStatus(deletionReq.status);
    if (current !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be cancelled by the requester.');
    }
    if (!canTransitionDataDeletionStatus(current, 'CANCELLED')) {
      throw new BadRequestException('Cannot cancel this request.');
    }

    const updated = await this.prisma.dataDeletionRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNote: 'Cancelled by requester',
      },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId ?? userId,
      actorRole: actor?.actorRole ?? 'USER',
      action: 'DATA_DELETION_CANCELLED',
      module: 'DataDeletion',
      target: deletionReq.requesterUserId,
      entityId: id,
      result: 'Success',
      details: 'Requester cancelled their pending data deletion request.',
      beforeValue: current,
      afterValue: 'CANCELLED',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async approve(id: string, actor?: ActorContext) {
    return this.performReview(id, 'APPROVED', actor);
  }

  async deny(id: string, actor?: ActorContext, dto?: ReviewDataDeletionRequestDto) {
    return this.performReview(id, 'DENIED', actor, dto?.reviewNote);
  }

  private async performReview(
    id: string,
    targetStatus: 'APPROVED' | 'DENIED',
    actor?: ActorContext,
    reviewNote?: string,
  ) {
    const deletionReq = await this.prisma.dataDeletionRequest.findUnique({ where: { id } });
    if (!deletionReq) {
      throw new NotFoundException('Data deletion request not found.');
    }
    const current = normalizeDataDeletionRequestStatus(deletionReq.status);
    if (current !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be approved or denied.');
    }
    if (!canTransitionDataDeletionStatus(current, targetStatus)) {
      throw new BadRequestException('Invalid status transition.');
    }
    if (!actor?.actorUserId) {
      throw new ForbiddenException('Authenticated admin actor is required.');
    }

    const updated = await this.prisma.dataDeletionRequest.update({
      where: { id },
      data: {
        status: targetStatus,
        reviewedByUserId: actor.actorUserId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ? String(reviewNote).trim() || null : null,
      },
    });

    const action = targetStatus === 'APPROVED' ? 'DATA_DELETION_APPROVED' : 'DATA_DELETION_DENIED';
    await this.auditLogs.record({
      actorUserId: actor.actorUserId,
      actorRole: actor.actorRole ?? 'ADMIN',
      action,
      module: 'DataDeletion',
      target: deletionReq.requesterUserId,
      entityId: id,
      result: 'Success',
      details: `Admin ${targetStatus.toLowerCase()} data deletion request${reviewNote ? ' (note attached)' : ''}.`,
      beforeValue: current,
      afterValue: targetStatus,
      ipAddress: actor.ipAddress,
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async listAll(statusFilter?: string) {
    const where: Record<string, any> = {};
    if (statusFilter) {
      where.status = normalizeDataDeletionRequestStatus(statusFilter);
    }
    return this.prisma.dataDeletionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
        },
        reviewer: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }
}
