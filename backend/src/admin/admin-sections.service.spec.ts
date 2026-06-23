import { AdminSectionsService } from './admin-sections.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  const mock: any = {
    section: { findUnique: jest.fn() },
  };
  return mock as PrismaService;
}

function buildMockAdminOpsRepository() {
  return {
    listSections: jest.fn(),
    createSection: jest.fn(),
    getSectionMasterList: jest.fn(),
    deleteSection: jest.fn(),
    moveStudents: jest.fn(),
  };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const adminOpsRepository = overrides?.adminOpsRepository ?? buildMockAdminOpsRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminSectionsService(prisma, adminOpsRepository as any, auditLogs as any);
}

describe('AdminSectionsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('sections', () => {
    it('delegates to adminOpsRepository.listSections', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.listSections as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Section A' }]);
      const service = buildService({ adminOpsRepository });
      const result = await service.sections('search', 'ay-1');
      expect(adminOpsRepository.listSections).toHaveBeenCalledWith({ search: 'search', academicYearId: 'ay-1' });
      expect(result).toEqual([{ id: 's1', name: 'Section A' }]);
    });
  });

  describe('createSection', () => {
    it('creates section and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.createSection as jest.Mock).mockResolvedValue({ id: 's1', code: 'SEC-1', academicYear: '2024-2025', yearLevel: '1st Year' });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.createSection({ code: 'SEC-1', academicYear: '2024-2025' });
      expect(adminOpsRepository.createSection).toHaveBeenCalledWith({ code: 'SEC-1', academicYear: '2024-2025' });
      expect(auditLogs.record).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('deleteSection', () => {
    it('throws when section not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.section.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.deleteSection('bad-id')).rejects.toThrow('Section not found.');
    });

    it('deletes section and logs audit', async () => {
      const prisma = buildMockPrisma();
      (prisma.section.findUnique as jest.Mock).mockResolvedValue({ id: 's1', name: 'Section A' });
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.deleteSection as jest.Mock).mockResolvedValue({ success: true });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, adminOpsRepository, auditLogs });
      const result = await service.deleteSection('s1', { actorRole: 'ADMIN' });
      expect(adminOpsRepository.deleteSection).toHaveBeenCalledWith('s1');
      expect(auditLogs.record).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('sectionMasterList', () => {
    it('delegates to adminOpsRepository.getSectionMasterList', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getSectionMasterList as jest.Mock).mockResolvedValue({ section: {}, rows: [] });
      const service = buildService({ adminOpsRepository });
      const result = await service.sectionMasterList('s1');
      expect(adminOpsRepository.getSectionMasterList).toHaveBeenCalledWith('s1');
      expect(result).toEqual({ section: {}, rows: [] });
    });
  });

  describe('moveStudents', () => {
    it('moves students and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.moveStudents as jest.Mock).mockResolvedValue({ sections: [{ id: 'src', code: 'SRC' }, { id: 'dst', code: 'DST' }] });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.moveStudents('src', 'dst', ['u1', 'u2']);
      expect(adminOpsRepository.moveStudents).toHaveBeenCalledWith('src', 'dst', ['u1', 'u2']);
      expect(auditLogs.record).toHaveBeenCalled();
      expect(result.sections).toHaveLength(2);
    });
  });
});
