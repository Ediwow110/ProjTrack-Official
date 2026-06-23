import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAnnouncement(body: { title: string; body: string; audience?: string; status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'; publishAt?: string }) {
    return this.prisma.announcement.create({
      data: {
        title: body.title,
        body: body.body,
        audience: body.audience ?? 'ALL',
        status: body.status ?? 'PUBLISHED',
        publishAt: new Date(body.publishAt ?? new Date().toISOString()),
      },
    });
  }

  async deleteAnnouncements(ids: string[]) {
    const targets = await this.prisma.announcement.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });

    if (!targets.length) {
      return { count: 0, titles: [] as string[] };
    }

    const result = await this.prisma.announcement.deleteMany({
      where: { id: { in: targets.map((target) => target.id) } },
    });

    return {
      count: result.count,
      titles: targets.map((target) => target.title),
    };
  }
}
