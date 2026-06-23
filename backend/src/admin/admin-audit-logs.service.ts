import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

@Injectable()
export class AdminAuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async auditList(
    module?: string,
    role?: string,
    take?: number,
    skip?: number,
    from?: string,
    to?: string,
  ) {
    const defaultTake = 100;
    const maxTake = 500;
    const normalizedTake = Math.min(Math.max(1, take ?? defaultTake), maxTake);
    const normalizedSkip = Math.max(0, skip ?? 0);

    const createdAtFilter: Record<string, Date> = {};
    if (from) createdAtFilter.gte = new Date(from);
    if (to) createdAtFilter.lte = new Date(to);

    return this.prisma.auditLog.findMany({
      where: {
        ...(module && module !== 'All' ? { module } : {}),
        ...(role && role !== 'All' ? { actorRole: role.toUpperCase() } : {}),
        ...(from || to ? { createdAt: createdAtFilter } : {}),
      },
      include: { actor: { select: SAFE_USER_SELECT } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: normalizedTake,
      skip: normalizedSkip,
    });
  }

  async auditDetail(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: { select: SAFE_USER_SELECT } },
    });
    if (!log) throw new NotFoundException('Audit log not found.');
    return log;
  }
}
