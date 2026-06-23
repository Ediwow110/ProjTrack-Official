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

function buildMockSettingsRepository() {
  return {
    getAcademicSettings: jest.fn(),
    saveAcademicSettings: jest.fn(),
    getSystemSettings: jest.fn(),
    saveSystemSettings: jest.fn(),
  };
}

function buildMockAcademicStructureRepository() {
  return {
    ensureAcademicYear: jest.fn(),
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
  const settingsRepository =
    overrides?.settingsRepository ?? buildMockSettingsRepository();
  const academicStructureRepository =
    overrides?.academicStructureRepository ?? buildMockAcademicStructureRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminSettingsService(
    prisma,
    settingsRepository as any,
    academicStructureRepository as any,
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
    it('delegates to settingsRepository.getAcademicSettings', async () => {
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.getAcademicSettings as jest.Mock).mockResolvedValue({
        schoolYear: '2024-2025',
        semester: '1st',
      });
      const service = buildService({ settingsRepository });
      const result = await service.getAcademicSettings();
      expect(settingsRepository.getAcademicSettings).toHaveBeenCalled();
      expect(result).toEqual({ schoolYear: '2024-2025', semester: '1st' });
    });
  });

  describe('saveAcademicSettings', () => {
    it('saves settings, ensures academic year, and logs audit', async () => {
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.saveAcademicSettings as jest.Mock).mockResolvedValue({
        schoolYear: '2024-2025',
      });
      const academicStructureRepository = buildMockAcademicStructureRepository();
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ settingsRepository, academicStructureRepository, auditLogs });
      const result = await service.saveAcademicSettings(
        { schoolYear: '2024-2025' },
        { actorEmail: 'admin@test.com', ipAddress: '127.0.0.1' },
      );
      expect(settingsRepository.saveAcademicSettings).toHaveBeenCalledWith({
        schoolYear: '2024-2025',
      });
      expect(academicStructureRepository.ensureAcademicYear).toHaveBeenCalledWith(
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
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.saveAcademicSettings as jest.Mock).mockResolvedValue({});
      const academicStructureRepository = buildMockAcademicStructureRepository();
      const service = buildService({ settingsRepository, academicStructureRepository });
      await service.saveAcademicSettings({});
      expect(academicStructureRepository.ensureAcademicYear).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // System Settings
  // ---------------------------------------------------------------------------

  describe('getSystemSettings', () => {
    it('delegates to settingsRepository.getSystemSettings', async () => {
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.getSystemSettings as jest.Mock).mockResolvedValue({
        schoolName: 'Test School',
      });
      const service = buildService({ settingsRepository });
      const result = await service.getSystemSettings();
      expect(settingsRepository.getSystemSettings).toHaveBeenCalled();
      expect(result).toEqual({ schoolName: 'Test School' });
    });
  });

  describe('saveSystemSettings', () => {
    it('saves settings and logs audit', async () => {
      const settingsRepository = buildMockSettingsRepository();
      (settingsRepository.saveSystemSettings as jest.Mock).mockResolvedValue({
        schoolName: 'Updated School',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ settingsRepository, auditLogs });
      const result = await service.saveSystemSettings(
        { schoolName: 'Updated School' },
        { actorEmail: 'admin@test.com' },
      );
      expect(settingsRepository.saveSystemSettings).toHaveBeenCalledWith({
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
    it('delegates to academicStructureRepository.listAcademicYears', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.listAcademicYears as jest.Mock).mockResolvedValue([
        { id: 'ay1', name: '2024-2025' },
      ]);
      const service = buildService({ academicStructureRepository });
      const result = await service.academicYears('2024');
      expect(academicStructureRepository.listAcademicYears).toHaveBeenCalledWith('2024');
      expect(result).toEqual([{ id: 'ay1', name: '2024-2025' }]);
    });
  });

  describe('createAcademicYear', () => {
    it('creates and logs audit', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.createAcademicYear as jest.Mock).mockResolvedValue({
        id: 'ay1',
        name: '2024-2025',
        status: 'ACTIVE',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.createAcademicYear({
        name: '2024-2025',
        status: 'ACTIVE',
      });
      expect(academicStructureRepository.createAcademicYear).toHaveBeenCalledWith({
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.deleteAcademicYear as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, academicStructureRepository, auditLogs });
      const result = await service.deleteAcademicYear('ay1', {
        actorRole: 'ADMIN',
      });
      expect(academicStructureRepository.deleteAcademicYear).toHaveBeenCalledWith('ay1');
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.createAcademicYearLevel as jest.Mock).mockResolvedValue(
        {
          id: 'lvl1',
          academicYear: '2024-2025',
          name: '1st Year',
        },
      );
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.createAcademicYearLevel({
        academicYearId: 'ay1',
        name: '1st Year',
      });
      expect(academicStructureRepository.createAcademicYearLevel).toHaveBeenCalledWith({
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.deleteAcademicYearLevel as jest.Mock).mockResolvedValue(
        { success: true },
      );
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, academicStructureRepository, auditLogs });
      const result = await service.deleteAcademicYearLevel('lvl1', {
        actorRole: 'ADMIN',
      });
      expect(
        academicStructureRepository.deleteAcademicYearLevel,
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
    it('delegates to academicStructureRepository.listDepartments', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.listDepartments as jest.Mock).mockResolvedValue([
        { id: 'd1', name: 'Science' },
      ]);
      const service = buildService({ academicStructureRepository });
      const result = await service.departments('Sci');
      expect(academicStructureRepository.listDepartments).toHaveBeenCalledWith('Sci');
      expect(result).toEqual([{ id: 'd1', name: 'Science' }]);
    });
  });

  describe('department', () => {
    it('delegates to academicStructureRepository.getDepartment', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      const service = buildService({ academicStructureRepository });
      const result = await service.department('d1');
      expect(academicStructureRepository.getDepartment).toHaveBeenCalledWith('d1');
      expect(result).toEqual({ id: 'd1', name: 'Science' });
    });
  });

  describe('createDepartment', () => {
    it('creates and logs audit', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.createDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.createDepartment(
        { name: 'Science' },
        { actorRole: 'ADMIN', ipAddress: '127.0.0.1' },
      );
      expect(academicStructureRepository.createDepartment).toHaveBeenCalledWith({
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: 'Old desc',
      });
      (academicStructureRepository.updateDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Advanced Science',
        description: 'New desc',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.updateDepartment(
        'd1',
        { name: 'Advanced Science', description: 'New desc' },
        { actorRole: 'ADMIN' },
      );
      expect(academicStructureRepository.updateDepartment).toHaveBeenCalledWith('d1', {
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: '',
      });
      (academicStructureRepository.updateDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
        description: 'Updated',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.getDepartment as jest.Mock).mockResolvedValue({
        id: 'd1',
        name: 'Science',
      });
      (academicStructureRepository.deleteDepartment as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.deleteDepartment(
        'd1',
        'DELETE DEPARTMENT',
        { actorRole: 'ADMIN' },
      );
      expect(academicStructureRepository.deleteDepartment).toHaveBeenCalledWith('d1');
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
    it('delegates to academicStructureRepository.listCourses', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.listCourses as jest.Mock).mockResolvedValue([
        { id: 'c1', name: 'Math 101' },
      ]);
      const service = buildService({ academicStructureRepository });
      const result = await service.listCourses('ay1');
      expect(academicStructureRepository.listCourses).toHaveBeenCalledWith('ay1');
      expect(result).toEqual([{ id: 'c1', name: 'Math 101' }]);
    });
  });

  describe('createCourse', () => {
    it('creates and logs audit', async () => {
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.createCourse as jest.Mock).mockResolvedValue({
        id: 'c1',
        name: 'Math 101',
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ academicStructureRepository, auditLogs });
      const result = await service.createCourse(
        { academicYearId: 'ay1', name: 'Math 101', code: 'MATH101' },
        { actorRole: 'ADMIN' },
      );
      expect(academicStructureRepository.createCourse).toHaveBeenCalledWith({
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
      const academicStructureRepository = buildMockAcademicStructureRepository();
      (academicStructureRepository.deleteCourse as jest.Mock).mockResolvedValue({
        success: true,
      });
      const auditLogs = buildMockAuditLogs();
      const service = buildService({ prisma, academicStructureRepository, auditLogs });
      const result = await service.deleteCourse('c1', { actorRole: 'ADMIN' });
      expect(academicStructureRepository.deleteCourse).toHaveBeenCalledWith('c1');
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
