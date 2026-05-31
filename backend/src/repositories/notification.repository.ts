import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_NOTIFICATION_LIST_TAKE = 50;
const MAX_NOTIFICATION_LIST_TAKE = 200;

type NotificationListOptions = {
  take?: number;
  skip?: number;
};

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private clampListTake(take?: number) {
    if (!Number.isFinite(take)) return DEFAULT_NOTIFICATION_LIST_TAKE;
    return Math.max(1, Math.min(Math.floor(Number(take)), MAX_NOTIFICATION_LIST_TAKE));
  }

  private clampListSkip(skip?: number) {
    if (!Number.isFinite(skip)) return 0;
    return Math.max(0, Math.floor(Number(skip)));
  }

  async create(input: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    dedupeKey?: string;
  }, tx?: any) {
    const client = tx ?? this.prisma;
    if (input.dedupeKey) {
      return client.notification.upsert({
        where: { dedupeKey: input.dedupeKey },
        update: {
          title: input.title,
          body: input.body,
          type: input.type ?? 'system',
          isRead: false,
        },
        create: {
          userId: input.userId,
          title: input.title,
          body: input.body,
          type: input.type ?? 'system',
          dedupeKey: input.dedupeKey,
          isRead: false,
        },
      });
    }

    return client.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type ?? 'system',
        isRead: false,
      },
    });
  }

  async listForUser(userId: string, options: NotificationListOptions = {}) {
    return this.prisma.notification.findMany({
      take: this.clampListTake(options.take),
      skip: this.clampListSkip(options.skip),
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(userId: string, id: string) {
    const record = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: true, count: record.count };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, count: result.count };
  }
}
