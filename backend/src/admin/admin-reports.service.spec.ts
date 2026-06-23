import { AdminReportsService } from './admin-reports.service';

function buildMockAdminReportsRepository() {
  return {
    summary: jest.fn(),
    currentView: jest.fn(),
    exportCsv: jest.fn(),
    reportBundle: jest.fn(),
  };
}

function buildMockAdminOpsRepository() {
  return {
    listRequests: jest.fn(),
    updateRequestStatus: jest.fn(),
  };
}

function buildMockAuditLogs() {
  return { record: jest.fn() };
}

function buildService(overrides?: Record<string, any>) {
  const adminReportsRepository = overrides?.adminReportsRepository ?? buildMockAdminReportsRepository();
  const adminOpsRepository = overrides?.adminOpsRepository ?? buildMockAdminOpsRepository();
  const auditLogs = overrides?.auditLogs ?? buildMockAuditLogs();
  return new AdminReportsService(adminReportsRepository as any, adminOpsRepository as any, auditLogs as any);
}

describe('AdminReportsService', () => {
  it('should be defined', () => {
    const service = buildService();
    expect(service).toBeDefined();
  });

  describe('reportSummary', () => {
    it('delegates to adminReportsRepository.summary', async () => {
      const repo = buildMockAdminReportsRepository();
      repo.summary.mockResolvedValue({ totalSubmissions: 42 });
      const service = buildService({ adminReportsRepository: repo });

      const result = await service.reportSummary('A', 's1');

      expect(repo.summary).toHaveBeenCalledWith('A', 's1');
      expect(result).toEqual({ totalSubmissions: 42 });
    });

    it('passes undefined when no args given', async () => {
      const repo = buildMockAdminReportsRepository();
      repo.summary.mockResolvedValue({ totalSubmissions: 0 });
      const service = buildService({ adminReportsRepository: repo });

      const result = await service.reportSummary();

      expect(repo.summary).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual({ totalSubmissions: 0 });
    });
  });

  describe('reportCurrentView', () => {
    it('delegates to adminReportsRepository.currentView', async () => {
      const repo = buildMockAdminReportsRepository();
      repo.currentView.mockResolvedValue([{ id: '1' }]);
      const service = buildService({ adminReportsRepository: repo });

      const result = await service.reportCurrentView('B', 's2');

      expect(repo.currentView).toHaveBeenCalledWith('B', 's2');
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('reportExport', () => {
    it('delegates to adminReportsRepository.exportCsv', async () => {
      const repo = buildMockAdminReportsRepository();
      repo.exportCsv.mockResolvedValue({ filename: 'test.csv', csv: 'a,b,c' });
      const service = buildService({ adminReportsRepository: repo });

      const result = await service.reportExport('C', 's3');

      expect(repo.exportCsv).toHaveBeenCalledWith('C', 's3');
      expect(result).toEqual({ filename: 'test.csv', csv: 'a,b,c' });
    });
  });

  describe('reportDashboard', () => {
    it('delegates to adminReportsRepository.reportBundle', async () => {
      const repo = buildMockAdminReportsRepository();
      repo.reportBundle.mockResolvedValue({ metrics: [] });
      const service = buildService({ adminReportsRepository: repo });

      const result = await service.reportDashboard('D', 's4');

      expect(repo.reportBundle).toHaveBeenCalledWith('D', 's4');
      expect(result).toEqual({ metrics: [] });
    });
  });

  describe('requests', () => {
    it('delegates to adminOpsRepository.listRequests', async () => {
      const opsRepo = buildMockAdminOpsRepository();
      opsRepo.listRequests.mockResolvedValue([{ id: 'req1', type: 'Type', status: 'Pending' }]);
      const service = buildService({ adminOpsRepository: opsRepo });

      const result = await service.requests('Pending');

      expect(opsRepo.listRequests).toHaveBeenCalledWith('Pending');
      expect(result).toEqual([{ id: 'req1', type: 'Type', status: 'Pending' }]);
    });
  });

  describe('requestAction', () => {
    it('updates status and records audit log on approval', async () => {
      const opsRepo = buildMockAdminOpsRepository();
      const auditLogs = buildMockAuditLogs();
      opsRepo.updateRequestStatus.mockResolvedValue({
        id: 'req1',
        type: 'Type',
        requester: 'user@test.com',
      });
      auditLogs.record.mockResolvedValue({ success: true });
      const service = buildService({ adminOpsRepository: opsRepo, auditLogs });

      const result = await service.requestAction('req1', 'Approved');

      expect(opsRepo.updateRequestStatus).toHaveBeenCalledWith('req1', 'Approved');
      expect(auditLogs.record).toHaveBeenCalledWith({
        actorRole: 'ADMIN',
        action: 'APPROVED',
        module: 'Requests',
        target: 'Type – user@test.com',
        result: 'Success',
        details: 'Request moved to Approved.',
      });
      expect(result).toEqual({ ok: true, status: 'Approved' });
    });

    it('updates status and records audit log on rejection', async () => {
      const opsRepo = buildMockAdminOpsRepository();
      const auditLogs = buildMockAuditLogs();
      opsRepo.updateRequestStatus.mockResolvedValue({
        id: 'req2',
        type: 'Other',
        requester: 'admin@test.com',
      });
      auditLogs.record.mockResolvedValue({ success: true });
      const service = buildService({ adminOpsRepository: opsRepo, auditLogs });

      const result = await service.requestAction('req2', 'Rejected');

      expect(opsRepo.updateRequestStatus).toHaveBeenCalledWith('req2', 'Rejected');
      expect(auditLogs.record).toHaveBeenCalledWith({
        actorRole: 'ADMIN',
        action: 'REJECTED',
        module: 'Requests',
        target: 'Other – admin@test.com',
        result: 'Success',
        details: 'Request moved to Rejected.',
      });
      expect(result).toEqual({ ok: true, status: 'Rejected' });
    });
  });
});
