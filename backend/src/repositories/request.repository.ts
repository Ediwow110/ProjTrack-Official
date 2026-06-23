import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listRequests(status?: string) {
    return this.prisma.request.findMany({
      where: !status || status === 'All' ? undefined : { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRequestStatus(id: string, status: 'Approved' | 'Rejected') {
    const request = await this.prisma.request.findFirst({ where: { id: String(id) } });
    if (!request) throw new NotFoundException('Request not found.');
    return this.prisma.request.update({ where: { id: request.id }, data: { status } });
  }
}
