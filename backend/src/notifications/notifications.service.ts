import { Injectable } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createInAppNotification(userId: string, title: string, body: string) {
    const record = await this.notificationRepository.create({
      userId,
      title,
      body,
      type: 'system',
    });

    return {
      success: true,
      ...record,
      status: 'created',
    };
  }

  listForUser(userId: string) {
    return this.notificationRepository.listForUser(userId);
  }

  markRead(userId: string, id: string) {
    return this.notificationRepository.markRead(userId, id);
  }

  markAllRead(userId: string) {
    return this.notificationRepository.markAllRead(userId);
  }
}

