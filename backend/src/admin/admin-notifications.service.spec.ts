import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

function buildMockPrisma() {
  const mock: any = {
    user: {
      findMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return mock as PrismaService;
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildMockMail() {
  return { queue: jest.fn() };
}

function buildMockNotifications() {
  return { createInAppNotification: jest.fn() };
}

function buildMockAnnouncementsRepository() {
  return {
    listAnnouncements: jest.fn(),
    createAnnouncement: jest.fn(),
    deleteAnnouncements: jest.fn(),
  };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  const mail = overrides?.mail ?? buildMockMail();
  const notifications = overrides?.notifications ?? buildMockNotifications();
  const announcementsRepository = overrides?.announcementsRepository ?? buildMockAnnouncementsRepository();
  return new AdminNotificationsService(prisma as any, auditLogs as any, mail as any, notifications as any, announcementsRepository as any);
}

describe('AdminNotificationsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('notificationsList', () => {
    it('returns all notifications when no filters are provided', async () => {
      const prisma = buildMockPrisma();
      const expected = [{ id: 'n1', title: 'Test' }];
      (prisma.notification.findMany as jest.Mock).mockResolvedValue(expected);

      const service = buildService({ prisma });
      const result = await service.notificationsList();

      expect(result).toEqual(expected);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {},
        include: { user: { select: SAFE_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by type when provided', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      await service.notificationsList(undefined, 'INFO');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { equals: 'INFO', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by role when provided', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      await service.notificationsList('teacher');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { role: 'TEACHER' },
          }),
        }),
      );
    });
  });

  describe('markNotificationRead', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      const service = buildService({ prisma });
      await expect(service.markNotificationRead('bad-id')).rejects.toThrow(NotFoundException);
      await expect(service.markNotificationRead('bad-id')).rejects.toThrow('Notification not found.');
    });

    it('marks the notification as read and records audit log', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
        id: 'n1',
        title: 'Test Notification',
        isRead: false,
      });
      (prisma.notification.update as jest.Mock).mockResolvedValue({
        id: 'n1',
        title: 'Test Notification',
        isRead: true,
      });

      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });

      const result = await service.markNotificationRead('n1');

      expect(result).toEqual({ success: true, id: 'n1' });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { isRead: true },
      });
      expect(auditLogs.record).toHaveBeenCalledWith({
        actorRole: 'ADMIN',
        action: 'READ',
        module: 'Notifications',
        target: 'Test Notification',
        result: 'Success',
        details: 'Admin marked a notification as read.',
      });
    });
  });

  describe('userName', () => {
    it('returns full name when both names present', () => {
      const service = buildService();
      expect((service as any).userName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
    });

    it('returns email when no names', () => {
      const service = buildService();
      expect((service as any).userName({ email: 'user@test.com' })).toBe('user@test.com');
    });

    it('returns Unknown for null user', () => {
      const service = buildService();
      expect((service as any).userName(null)).toBe('Unknown');
    });
  });

  describe('markAllNotificationsRead', () => {
    it('throws ForbiddenException when actorUserId is missing', async () => {
      const service = buildService();
      await expect(service.markAllNotificationsRead({})).rejects.toThrow(ForbiddenException);
    });

    it('updates all unread notifications and records audit log', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });

      const result = await service.markAllNotificationsRead({ actorUserId: 'admin1' });

      expect(result).toEqual({ success: true, count: 5 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { isRead: false, userId: 'admin1' },
        data: { isRead: true },
      });
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('deleteNotifications', () => {
    it('throws BadRequestException for empty ids', async () => {
      const service = buildService();
      await expect(service.deleteNotifications([])).rejects.toThrow(BadRequestException);
    });

    it('deletes notifications and records audit log', async () => {
      const prisma = buildMockPrisma();
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'n1', title: 'Test' }]);
      (prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, auditLogs });

      const result = await service.deleteNotifications(['n1']);

      expect(result).toEqual({ success: true, count: 1 });
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('broadcast', () => {
    it('throws BadRequestException when mail queue fails', async () => {
      const prisma = buildMockPrisma();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', email: 'test@test.com', status: 'ACTIVE' },
      ]);
      const mail = buildMockMail();
      (mail.queue as jest.Mock).mockResolvedValue({});
      const service = buildService({ prisma, mail });

      await expect(
        service.broadcast({ title: 'Test', body: 'Test body', audience: 'ALL', channel: 'email' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('queues notifications and emails for active users', async () => {
      const prisma = buildMockPrisma();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', email: 'test@test.com', status: 'ACTIVE' },
      ]);
      const notifications = buildMockNotifications();
      (notifications.createInAppNotification as jest.Mock).mockResolvedValue({ id: 'n1' });
      const mail = buildMockMail();
      (mail.queue as jest.Mock).mockResolvedValue({ id: 'mj1' });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, notifications, mail, auditLogs });

      const result = await service.broadcast({
        title: 'Test', body: 'Body', audience: 'ALL', channel: 'both',
      });

      expect(result.success).toBe(true);
      expect(result.activeRecipients).toBe(1);
      expect(notifications.createInAppNotification).toHaveBeenCalled();
      expect(mail.queue).toHaveBeenCalled();
    });
  });

  describe('announcements', () => {
    it('delegates to announcementsRepository', async () => {
      const announcementsRepository = buildMockAnnouncementsRepository();
      (announcementsRepository.listAnnouncements as jest.Mock).mockResolvedValue([{ id: 'a1' }]);
      const service = buildService({ announcementsRepository });

      const result = await service.announcements();

      expect(result).toEqual([{ id: 'a1' }]);
    });
  });

  describe('createAnnouncement', () => {
    it('creates announcement via repository and records audit log', async () => {
      const announcementsRepository = buildMockAnnouncementsRepository();
      (announcementsRepository.createAnnouncement as jest.Mock).mockResolvedValue({
        id: 'a1', title: 'Announcement',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ announcementsRepository, auditLogs });

      const result = await service.createAnnouncement({ title: 'Test', body: 'Body' });

      expect(result).toEqual({ id: 'a1', title: 'Announcement' });
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });

  describe('deleteAnnouncements', () => {
    it('throws BadRequestException for empty ids', async () => {
      const service = buildService();
      await expect(service.deleteAnnouncements([])).rejects.toThrow(BadRequestException);
    });

    it('deletes via repository and records audit log', async () => {
      const announcementsRepository = buildMockAnnouncementsRepository();
      (announcementsRepository.deleteAnnouncements as jest.Mock).mockResolvedValue({
        count: 2, titles: ['A1', 'A2'],
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ announcementsRepository, auditLogs });

      const result = await service.deleteAnnouncements(['a1', 'a2']);

      expect(result).toEqual({ success: true, count: 2 });
      expect(auditLogs.record).toHaveBeenCalled();
    });
  });
});
