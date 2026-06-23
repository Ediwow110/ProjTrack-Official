import { NotFoundException } from '@nestjs/common';
import { AdminCalendarService } from './admin-calendar.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  return {
    submissionTask: { findMany: jest.fn() },
    announcement: { findMany: jest.fn() },
  } as any as PrismaService;
}

function buildService(overrides?: { prisma?: PrismaService }) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  return new AdminCalendarService(prisma);
}

describe('AdminCalendarService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('calendarEvents', () => {
    it('returns sorted activity and announcement events', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Math Homework',
          deadline: new Date('2025-06-01T10:00:00Z'),
          createdAt: new Date('2025-05-01T00:00:00Z'),
          isOpen: true,
          subjectId: 'subj-1',
          subject: { name: 'Mathematics', enrollments: [] },
        },
      ]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ann-1',
          title: 'School Holiday',
          audience: 'ALL',
          status: 'PUBLISHED',
          publishAt: new Date('2025-06-15T08:00:00Z'),
        },
      ]);

      const service = buildService({ prisma });
      const result = await service.calendarEvents();

      expect(result).toHaveLength(2);
      // Sorted by startsAt — Math Homework (June 1) before School Holiday (June 15)
      expect(result[0].id).toBe('task-1');
      expect(result[0].type).toBe('activity');
      expect(result[0].title).toBe('Math Homework');
      expect(result[0].windowStatus).toBe('OPEN');
      expect(result[1].id).toBe('ann-1');
      expect(result[1].type).toBe('announcement');
    });

    it('filters by audience for announcements', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ann-1',
          title: 'Teachers Meeting',
          audience: 'TEACHERS',
          status: 'PUBLISHED',
          publishAt: new Date('2025-06-10T08:00:00Z'),
        },
      ]);

      const service = buildService({ prisma });
      const result = await service.calendarEvents('TEACHERS');

      // prisma.announcement.findMany is called with the audience filter
      expect(prisma.announcement.findMany).toHaveBeenCalled();
      // Activity events are included for TEACHERS audience
      expect(result).toHaveLength(1);
    });

    it('filters by section for tasks', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      await service.calendarEvents(undefined, 'Section A');

      expect(prisma.submissionTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subject: {
              enrollments: {
                some: { section: { name: 'Section A' } },
              },
            },
          }),
        }),
      );
    });

    it('excludes activity events when audience is non-student/teacher', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Math Homework',
          deadline: new Date('2025-06-01T10:00:00Z'),
          createdAt: new Date('2025-05-01T00:00:00Z'),
          isOpen: true,
          subjectId: 'subj-1',
          subject: { name: 'Mathematics', enrollments: [] },
        },
      ]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      const result = await service.calendarEvents('PARENTS');

      // PARENTS audience excludes activity events
      expect(result).toHaveLength(0);
    });
  });

  describe('calendarEventDetail', () => {
    it('returns the matching event by id', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Math Homework',
          deadline: new Date('2025-06-01T10:00:00Z'),
          createdAt: new Date('2025-05-01T00:00:00Z'),
          isOpen: true,
          subjectId: 'subj-1',
          subject: { name: 'Mathematics', enrollments: [] },
        },
      ]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      const event = await service.calendarEventDetail('task-1');

      expect(event).toBeDefined();
      expect(event.id).toBe('task-1');
      expect(event.type).toBe('activity');
    });

    it('throws NotFoundException when event not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.submissionTask.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.announcement.findMany as jest.Mock).mockResolvedValue([]);

      const service = buildService({ prisma });
      await expect(service.calendarEventDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
