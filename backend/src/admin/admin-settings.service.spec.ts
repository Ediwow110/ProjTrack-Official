import { AdminSettingsService } from './admin-settings.service';
import { PrismaService } from '../prisma/prisma.service';

function buildMockPrisma() {
  const mock: any = {
    academicYear: { findUnique: jest.fn() },
    academicYearLevel: { findUnique: jest.fn() },
    course: { findUnique: jest.fn() },
  };
  return mock as PrismaService;
}

function buildMockAdminOpsRepository() {
  return {
    getAcademicSettings: jest.fn(),
    saveAcademicSettings: jest.fn(),
    ensureAcademicYear: jest.fn(),
    getSystemSettings: jest.fn(),
    saveSystemSettings: jest.fn(),
    listAcademicYears: jest.fn(),
    createAcademicYear: jest.fn(),
    deleteAcademicYear: jest.fn(),
    createAcademicYearLevel: jest.fn(),
    deleteAcademicYearLevel: jest.fn(),
    listDepartments: jest.fn(),
    getDepartment: jest.fn(),
    createDepartment: jest.fn(),
    updateDepartment: jest.fn(),
    deleteDepartment: jest.fn(),
    listCourses: jest.fn(),
    createCourse: jest.fn(),
    deleteCourse: jest.fn(),
  };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const prisma = overrides?.prisma ?? buildMockPrisma();
  const adminOpsRepository =
    overrides?.adminOpsRepository ?? buildMockAdminOpsRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminSettingsService(
    prisma,
    adminOpsRepository as any,
    auditLogs as any,
  );
}

describe('AdminSettingsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Academic Settings
  // ---------------------------------------------------------------------------

  describe('getAcademicSettings', () => {
    it('delegates to adminOpsRepository.getAcademicSettings', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getAcademicSettings as jest.Mock).mockResolvedValue({
        schoolYear: '2024-2025',
        semester: '1st',
      });
      const service = buildService({ adminOpsRepository });
      const result = await service.getAcademicSettings();
      expect(adminOpsRepository.getAcademicSettings).toHaveBeenCalled();
      expect(result).toEqual({ schoolYear: '2024-2025', semester: '1st' });
    });
  });

  describe('saveAcademicSettings', () => {
    it('saves settings, ensures academic year, and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.saveAcademicSettings as jest.Mock).mockResolvedValue({
        schoolYear: '2024-2025',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.saveAcademicSettings(
        { schoolYear: '2024-2025' },
        { actorEmail: 'admin@test.com', ipAddress: '127.0.0.1' },
      );
      expect(adminOpsRepository.saveAcademicSettings).toHaveBeenCalledWith({
        schoolYear: '2024-2025',
      });
      expect(adminOpsRepository.ensureAcademicYear).toHaveBeenCalledWith(
        '2024-2025',
        'ACTIVE',
      );
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          module: 'Academic Settings',
          target: 'Academic term configuration',
        }),
      );
      expect(result).toEqual({ schoolYear: '2024-2025' });
    });

    it('skips ensureAcademicYear when schoolYear is missing', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.saveAcademicSettings as jest.Mock).mockResolvedValue({});
      const service = buildService({ adminOpsRepository });
      await service.saveAcademicSettings({});
      expect(adminOpsRepository.ensureAcademicYear).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // System Settings
  // ---------------------------------------------------------------------------

  describe('getSystemSettings', () => {
    it('delegates to adminOpsRepository.getSystemSettings', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getSystemSettings as jest.Mock).mockResolvedValue({
        schoolName: 'Test School',
      });
      const service = buildService({ adminOpsRepository });
      const result = await service.getSystemSettings();
      expect(adminOpsRepository.getSystemSettings).toHaveBeenCalled();
      expect(result).toEqual({ schoolName: 'Test School' });
    });
  });

  describe('saveSystemSettings', () => {
    it('saves settings and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.saveSystemSettings as jest.Mock).mockResolvedValue({
        schoolName: 'Updated School',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.saveSystemSettings(
        { schoolName: 'Updated School' },
        { actorEmail: 'admin@test.com' },
      );
      expect(adminOpsRepository.saveSystemSettings).toHaveBeenCalledWith({
        schoolName: 'Updated School',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          module: 'Settings',
          target: 'System settings',
        }),
      );
      expect(result).toEqual({ schoolName: 'Updated School' });
    });
  });

  // ---------------------------------------------------------------------------
  // Academic Years
  // ---------------------------------------------------------------------------

  describe('academicYears', () => {
    it('delegates to adminOpsRepository.listAcademicYears', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.listAcademicYears as jest.Mock).mockResolvedValue([
        { id: 'ay1', name: '2024-2025' },
      ]);
      const service = buildService({ adminOpsRepository });
      const result = await service.academicYears('2024');
      expect(adminOpsRepository.listAcademicYears).toHaveBeenCalledWith('2024');
      expect(result).toEqual([{ id: 'ay1', name: '2024-2025' }]);
    });
  });

  describe('createAcademicYear', () => {
    it('creates and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.createAcademicYear as jest.Mock).mockResolvedValue({
        id: 'ay1',
        name: '2024-2025',
        status: 'ACTIVE',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.createAcademicYear({
        name: '2024-2025',
        status: 'ACTIVE',
      });
      expect(adminOpsRepository.createAcademicYear).toHaveBeenCalledWith({
        name: '2024-2025',
        status: 'ACTIVE',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          module: 'Academic Years',
          target: '2024-2025',
        }),
      );
      expect(result.id).toBe('ay1');
    });
  });

  describe('deleteAcademicYear', () => {
    it('throws when academic year not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.academicYear.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.deleteAcademicYear('bad-id')).rejects.toThrow(
        'Academic year not found.',
      );
    });

    it('deletes and logs audit', async () => {
      const prisma = buildMockPrisma();
      (prisma.academicYear.findUnique as jest.Mock).mockResolvedValue({
        id: 'ay1',
        name: '2024-2025',
      });
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.deleteAcademicYear as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, adminOpsRepository, auditLogs });
      const result = await service.deleteAcademicYear('ay1', {
        actorRole: 'ADMIN',
      });
      expect(adminOpsRepository.deleteAcademicYear).toHaveBeenCalledWith('ay1');
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          module: 'Academic Years',
          target: '2024-2025',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('createAcademicYearLevel', () => {
    it('creates and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.createAcademicYearLevel as jest.Mock).mockResolvedValue(
        {
          id: 'lvl1',
          academicYear: '2024-2025',
          name: '1st Year',
        },
      );
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.createAcademicYearLevel({
        academicYearId: 'ay1',
        name: '1st Year',
      });
      expect(adminOpsRepository.createAcademicYearLevel).toHaveBeenCalledWith({
        academicYearId: 'ay1',
        name: '1st Year',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          module: 'Academic Years',
          target: '2024-2025 / 1st Year',
        }),
      );
      expect(result.id).toBe('lvl1');
    });
  });

  describe('deleteAcademicYearLevel', () => {
    it('throws when level not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.academicYearLevel.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(
        service.deleteAcademicYearLevel('bad-id'),
      ).rejects.toThrow('Year level not found.');
    });

    it('deletes and logs audit', async () => {
      const prisma = buildMockPrisma();
      (prisma.academicYearLevel.findUnique as jest.Mock).mockResolvedValue({
        id: 'lvl1',
        name: '1st Year',
      });
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.deleteAcademicYearLevel as jest.Mock).mockResolvedValue(
        { success: true },
      );
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, adminOpsRepository, auditLogs });
      const result = await service.deleteAcademicYearLevel('lvl1', {
        actorRole: 'ADMIN',
      });
      expect(
        adminOpsRepository.deleteAcademicYearLevel,
      ).toHaveBeenCalledWith('lvl1');
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          module: 'Academic Years',
          target: '1st Year',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------------

  describe('departments', () => {
    it('delegates to adminOpsRepository.listDepartments', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.listDepartments as jest.Mock).mockResolvedValue([
        { id: 'd1', name: 'Science' },
      ]);
      const service = buildService({ adminOpsRepository });
      const result = await service.departments('Sci');
      expect(adminOpsRepository.listDepartments).toHaveBeenCalledWith('Sci');
      expect(result).toEqual([{ id: 'd1', name: 'Science' }]);
    });
  });

  describe('department', () => {
    it('delegates to adminOpsRepository.getDepartment', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      const service = buildService({ adminOpsRepository });
      const result = await service.department('d1');
      expect(adminOpsRepository.getDepartment).toHaveBeenCalledWith('d1');
      expect(result).toEqual({ id: 'd1', name: 'Science' });
    });
  });

  describe('createDepartment', () => {
    it('creates and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.createDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.createDepartment(
        { name: 'Science' },
        { actorRole: 'ADMIN', ipAddress: '127.0.0.1' },
      );
      expect(adminOpsRepository.createDepartment).toHaveBeenCalledWith({
        name: 'Science',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          module: 'Departments',
          target: 'Science',
        }),
      );
      expect(result.id).toBe('d1');
    });
  });

  describe('updateDepartment', () => {
    it('updates and logs audit with rename detail', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: 'Old desc',
      });
      (adminOpsRepository.updateDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Advanced Science',
        description: 'New desc',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.updateDepartment(
        'd1',
        { name: 'Advanced Science', description: 'New desc' },
        { actorRole: 'ADMIN' },
      );
      expect(adminOpsRepository.updateDepartment).toHaveBeenCalledWith('d1', {
        name: 'Advanced Science',
        description: 'New desc',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          module: 'Departments',
          details: 'Department renamed from Science to Advanced Science.',
          beforeValue: JSON.stringify({
            name: 'Science',
            description: 'Old desc',
          }),
          afterValue: JSON.stringify({
            name: 'Advanced Science',
            description: 'New desc',
          }),
        }),
      );
      expect(result.name).toBe('Advanced Science');
    });

    it('logs generic message when name unchanged', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: '',
      });
      (adminOpsRepository.updateDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: 'Updated',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      await service.updateDepartment(
        'd1',
        { description: 'Updated' },
        { actorRole: 'ADMIN' },
      );
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Department catalog entry updated.',
        }),
      );
    });
  });

  describe('deleteDepartment', () => {
    it('throws when confirmation text is wrong', async () => {
      const service = buildService();
      await expect(
        service.deleteDepartment('d1', 'wrong text'),
      ).rejects.toThrow(
        'Type DELETE DEPARTMENT to confirm deleting a department.',
      );
    });

    it('deletes and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      (adminOpsRepository.deleteDepartment as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.deleteDepartment(
        'd1',
        'DELETE DEPARTMENT',
        { actorRole: 'ADMIN' },
      );
      expect(adminOpsRepository.deleteDepartment).toHaveBeenCalledWith('d1');
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          module: 'Departments',
          target: 'Science',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Courses
  // ---------------------------------------------------------------------------

  describe('listCourses', () => {
    it('delegates to adminOpsRepository.listCourses', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.listCourses as jest.Mock).mockResolvedValue([
        { id: 'c1', name: 'Math 101' },
      ]);
      const service = buildService({ adminOpsRepository });
      const result = await service.listCourses('ay1');
      expect(adminOpsRepository.listCourses).toHaveBeenCalledWith('ay1');
      expect(result).toEqual([{ id: 'c1', name: 'Math 101' }]);
    });
  });

  describe('createCourse', () => {
    it('creates and logs audit', async () => {
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.createCourse as jest.Mock).mockResolvedValue({
        id: 'c1',
        name: 'Math 101',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ adminOpsRepository, auditLogs });
      const result = await service.createCourse(
        { academicYearId: 'ay1', name: 'Math 101', code: 'MATH101' },
        { actorRole: 'ADMIN' },
      );
      expect(adminOpsRepository.createCourse).toHaveBeenCalledWith({
        academicYearId: 'ay1',
        name: 'Math 101',
        code: 'MATH101',
      });
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          module: 'Courses',
        }),
      );
      expect(result.id).toBe('c1');
    });
  });

  describe('deleteCourse', () => {
    it('throws when course not found', async () => {
      const prisma = buildMockPrisma();
      (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
      const service = buildService({ prisma });
      await expect(service.deleteCourse('bad-id')).rejects.toThrow(
        'Course not found.',
      );
    });

    it('deletes and logs audit', async () => {
      const prisma = buildMockPrisma();
      (prisma.course.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        name: 'Math 101',
      });
      const adminOpsRepository = buildMockAdminOpsRepository();
      (adminOpsRepository.deleteCourse as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, adminOpsRepository, auditLogs });
      const result = await service.deleteCourse('c1', { actorRole: 'ADMIN' });
      expect(adminOpsRepository.deleteCourse).toHaveBeenCalledWith('c1');
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          module: 'Courses',
          target: 'Math 101',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
