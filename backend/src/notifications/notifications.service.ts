import { Injectable } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';

type NotificationListOptions = {
  take?: number;
  skip?: number;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createInAppNotification(userId: string, title: string, body: string, tx?: any) {
    const record = await this.notificationRepository.create({
      userId,
      title,
      body,
      type: 'system',
    }, tx);

    return {
      success: true,
      ...record,
      status: 'created',
    };
  }

  listForUser(userId: string, options: NotificationListOptions = {}) {
    return this.notificationRepository.listForUser(userId, options);
  }

  markRead(userId: string, id: string) {
    return this.notificationRepository.markRead(userId, id);
  }

  markAllRead(userId: string) {
    return this.notificationRepository.markAllRead(userId);
  }
}
