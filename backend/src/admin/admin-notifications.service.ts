import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsRepository } from '../repositories/announcements.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MAIL_CATEGORY_KEYS } from '../common/constants/mail.constants';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

type AdminActorContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly announcementsRepository: AnnouncementsRepository,
  ) {}

  async notificationsList(role?: string, type?: string) {
    return this.prisma.notification.findMany({
      where: {
        ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
        ...(role ? { user: { role: String(role).toUpperCase() as any } } : {}),
      },
      include: { user: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationRead(id: string) {
    const target = await this.prisma.notification.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Notification not found.');

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'READ',
      module: 'Notifications',
      target: target.title,
      result: 'Success',
      details: 'Admin marked a notification as read.',
    });

    return { success: true, id };
  }

  async markAllNotificationsRead(actor?: AdminActorContext) {
    if (!actor?.actorUserId) {
      throw new ForbiddenException('Admin user context is required.');
    }
    const result = await this.prisma.notification.updateMany({
      where: { isRead: false, userId: actor?.actorUserId },
      data: { isRead: true },
    });

    await this.auditLogs.record({
      actorUserId: actor?.actorUserId,
      actorRole: 'ADMIN',
      action: 'READ_ALL',
      module: 'Notifications',
      target: 'Admin notification feed',
      result: 'Success',
      details: 'Admin marked their notifications as read.',
      ipAddress: actor?.ipAddress,
    });

    return { success: true, count: result.count };
  }

  async deleteNotifications(ids: string[]) {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)),
    );

    if (!normalizedIds.length) {
      throw new BadRequestException('At least one notification must be selected.');
    }

    const targets = await this.prisma.notification.findMany({
      where: { id: { in: normalizedIds } },
      select: { id: true, title: true },
    });

    const result = await this.prisma.notification.deleteMany({
      where: { id: { in: normalizedIds } },
    });

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: normalizedIds.length === 1 ? 'DELETE' : 'BULK_DELETE',
      module: 'Notifications',
      target:
        normalizedIds.length === 1
          ? targets[0]?.title ?? 'Notification'
          : `${result.count} notifications`,
      result: 'Success',
      details:
        normalizedIds.length === 1
          ? 'Admin deleted a notification from the feed.'
          : `Admin deleted ${result.count} notifications from the feed.`,
    });

    return { success: true, count: result.count };
  }

  async broadcast(body: { title: string; body: string; audience: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS'; channel: 'system' | 'email' | 'both' }) {
    const audienceUsers = await this.resolveAudience(body.audience);
    const audienceCount = audienceUsers.length;
    const activeUsers = audienceUsers.filter((user) => user.status === 'ACTIVE');
    const skippedInactive = audienceCount - activeUsers.length;
    const created: any[] = [];
    let emailJobsQueued = 0;

    for (const user of activeUsers) {
      if (body.channel === 'system' || body.channel === 'both') {
        created.push(await this.notifications.createInAppNotification(user.id, body.title, body.body));
      }
      if (body.channel === 'email' || body.channel === 'both') {
        const mailCategory =
          body.audience === 'ADMINS'
            ? MAIL_CATEGORY_KEYS.ADMIN
            : MAIL_CATEGORY_KEYS.NOTIFICATION;
        const mailJob = await this.mail.queue({
          to: user.email,
          templateKey: 'broadcast',
          payload: {
            title: body.title,
            body: body.body,
            audience: body.audience,
            mailCategory,
          },
        });
        if (!mailJob?.id) {
          throw new BadRequestException('Broadcast email could not be confirmed as a queued MailJob.');
        }
        emailJobsQueued += 1;
      }
    }

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'BROADCAST_CREATED',
      module: 'Notifications',
      target: body.title,
      result: 'Queued',
      details: `Broadcast queued for ${activeUsers.length} active ${body.audience} recipient(s); ${skippedInactive} inactive skipped.`,
    });

    return {
      success: true,
      audienceCount,
      activeRecipients: activeUsers.length,
      skippedInactive,
      emailJobsQueued,
      inAppCreated: created.length,
      notificationsCreated: created.length,
    };
  }

  async announcements() {
    return this.announcementsRepository.listAnnouncements();
  }

  async createAnnouncement(body: { title: string; body: string; audience?: string; status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'; publishAt?: string }) {
    const record = await this.announcementsRepository.createAnnouncement(body);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: 'ANNOUNCEMENT_CREATED',
      module: 'Announcements',
      target: record.title,
      entityId: record.id,
      result: 'Success',
    });
    return record;
  }

  async deleteAnnouncements(ids: string[]) {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)),
    );

    if (!normalizedIds.length) {
      throw new BadRequestException('At least one announcement must be selected.');
    }

    const deleted = await this.announcementsRepository.deleteAnnouncements(normalizedIds);

    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: normalizedIds.length === 1 ? 'DELETE' : 'BULK_DELETE',
      module: 'Announcements',
      target:
        normalizedIds.length === 1
          ? deleted.titles[0] ?? 'Announcement'
          : `${deleted.count} announcements`,
      result: 'Success',
      details:
        normalizedIds.length === 1
          ? 'Admin deleted an announcement.'
          : `Admin deleted ${deleted.count} announcements.`,
    });

    return { success: true, count: deleted.count };
  }

  private async resolveAudience(audience: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS') {
    if (audience === 'ALL') {
      return this.prisma.user.findMany();
    }
    if (audience === 'STUDENTS') {
      return this.prisma.user.findMany({ where: { role: 'STUDENT' } });
    }
    if (audience === 'TEACHERS') {
      return this.prisma.user.findMany({ where: { role: 'TEACHER' } });
    }
    return this.prisma.user.findMany({ where: { role: 'ADMIN' } });
  }

  private userName(user: { firstName?: string | null; lastName?: string | null; email?: string } | null): string {
    if (!user) return 'Unknown';
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return user.email ?? 'Unknown';
  }
}