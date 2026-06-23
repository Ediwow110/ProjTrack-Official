import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCalendarService {
  private readonly logger = new Logger(AdminCalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calendarEvents(audience?: string, section?: string) {
    const [tasks, announcements] = await Promise.all([
      this.prisma.submissionTask.findMany({
        where: {
          deadline: { not: null },
          ...(section
            ? {
                subject: {
                  enrollments: {
                    some: {
                      section: { name: section },
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          subject: {
            include: {
              enrollments: { include: { section: true } },
            },
          },
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.announcement.findMany({
        where: !audience || audience === 'ALL' ? undefined : { audience: { in: [audience, 'ALL'] } },
        orderBy: { publishAt: 'asc' },
      }),
    ]);

    const activityEvents = tasks
      .filter(() => !audience || audience === 'ALL' || audience === 'STUDENTS' || audience === 'TEACHERS')
      .map((task) => ({
        id: task.id,
        type: 'activity',
        title: task.title,
        audience: 'STUDENTS',
        startsAt: task.deadline?.toISOString() ?? task.createdAt.toISOString(),
        subject: task.subject?.name ?? task.subjectId,
        windowStatus: task.isOpen ? 'OPEN' : 'CLOSED',
      }));

    const announcementEvents = announcements.map((item) => ({
      id: item.id,
      type: 'announcement',
      title: item.title,
      audience: item.audience,
      startsAt: item.publishAt.toISOString(),
      subject: null,
      windowStatus: item.status,
    }));

    return [...activityEvents, ...announcementEvents].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  }

  async calendarEventDetail(id: string) {
    const events = await this.calendarEvents();
    const event = events.find((item) => item.id === id);
    if (!event) throw new NotFoundException('Calendar event not found.');
    return event;
  }
}
