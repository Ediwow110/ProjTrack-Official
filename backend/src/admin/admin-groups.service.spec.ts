import { AdminGroupsService } from './admin-groups.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function buildMockPrisma() {
  const mock: any = {
    group: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    groupMember: {
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return arg(mock);
      return Promise.resolve();
    }),
  };
  return mock as PrismaService;
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminGroupsService(prisma as any, auditLogs as any);
}

const SAFE_USER = { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', role: 'STUDENT', avatarUrl: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };

describe('AdminGroupsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('groups', () => {
    it('returns mapped group data', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'g1',
          name: 'Group A',
          subjectId: 'sub-1',
          inviteCode: 'ABC123',
          status: 'ACTIVE',
          leaderId: 'u1',
          createdAt: new Date(),
          subject: {
            name: 'Math',
            minGroupSize: 2,
            enrollments: [{ section: { name: 'Section 1' } }],
          },
          section: null,
          members: [
            { studentId: 'u1', role: 'LEADER', student: SAFE_USER },
            { studentId: 'u2', role: 'MEMBER', student: { ...SAFE_USER, id: 'u2', firstName: 'Jane', lastName: 'Smith' } },
          ],
        },
      ]);
      const service = buildService({ prisma });
      const result = await service.groups();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'g1',
        name: 'Group A',
        status: 'ACTIVE',
        subject: 'Math',
        section: 'Section 1',
        leader: 'John Doe',
      });
      expect(result[0].members).toHaveLength(2);
    });

    it('filters by section', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'g1',
          name: 'Group A',
          subjectId: 'sub-1',
          inviteCode: 'ABC',
          status: 'ACTIVE',
          leaderId: 'u1',
          createdAt: new Date(),
          subject: { name: 'Math', minGroupSize: 2, enrollments: [{ section: { name: 'Section 1' } }] },
          section: null,
          members: [{ studentId: 'u1', role: 'LEADER', student: SAFE_USER }],
        },
        {
          id: 'g2',
          name: 'Group B',
          subjectId: 'sub-1',
          inviteCode: 'DEF',
          status: 'ACTIVE',
          leaderId: null,
          createdAt: new Date(),
          subject: { name: 'Science', minGroupSize: 2, enrollments: [{ section: { name: 'Section 2' } }] },
          section: null,
          members: [{ studentId: 'u2', role: 'MEMBER', student: { ...SAFE_USER, id: 'u2', firstName: 'Jane', lastName: 'Smith' } }],
        },
      ]);
      const service = buildService({ prisma });
      const result = await service.groups('Section 1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Group A');
    });

    it('filters by status', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'g1',
          name: 'Group A',
          subjectId: 'sub-1',
          inviteCode: 'ABC',
          status: 'PENDING',
          leaderId: null,
          createdAt: new Date(),
          subject: { name: 'Math', minGroupSize: 2, enrollments: [{ section: { name: 'S1' } }] },
          section: null,
          members: [{ studentId: 'u1', role: 'MEMBER', student: SAFE_USER }],
        },
        {
          id: 'g2',
          name: 'Group B',
          subjectId: 'sub-1',
          inviteCode: 'DEF',
          status: 'ACTIVE',
          leaderId: null,
          createdAt: new Date(),
          subject: { name: 'Science', minGroupSize: 2, enrollments: [{ section: { name: 'S2' } }] },
          section: null,
          members: [{ studentId: 'u2', role: 'MEMBER', student: { ...SAFE_USER, id: 'u2', firstName: 'Jane', lastName: 'Smith' } }],
        },
      ]);
      const service = buildService({ prisma });
      const result = await service.groups(undefined, 'active');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Group B');
    });
  });

  describe('groupDetail', () => {
    it('returns matching group', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findMany as jest.Mock).mockResolvedValue([
        { id: 'g1', name: 'X', subjectId: 's1', inviteCode: 'C', status: 'ACTIVE', leaderId: null, createdAt: new Date(), subject: null, section: null, members: [] },
      ]);
      const service = buildService({ prisma });
      const result = await service.groupDetail('g1');
      expect(result.id).toBe('g1');
    });

    it('throws when not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findMany as jest.Mock).mockResolvedValue([]);
      const service = buildService({ prisma });
      await expect(service.groupDetail('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveGroup', () => {
    it('throws NotFoundException when group missing', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.approveGroup('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('lockGroup', () => {
    it('throws NotFoundException when group missing', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.lockGroup('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlockGroup', () => {
    it('throws NotFoundException when group missing', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.unlockGroup('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignGroupLeader', () => {
    it('throws NotFoundException when group missing', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.assignGroupLeader('bad-id', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeGroupMember', () => {
    it('throws NotFoundException when group missing', async () => {
      const prisma = buildMockPrisma();
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.removeGroupMember('bad-id', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
