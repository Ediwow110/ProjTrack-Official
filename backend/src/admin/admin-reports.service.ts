import { Injectable } from '@nestjs/common';
import { AdminReportsRepository } from '../repositories/admin-reports.repository';
import { AdminOpsRepository } from '../repositories/admin-ops.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly adminReportsRepository: AdminReportsRepository,
    private readonly adminOpsRepository: AdminOpsRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async reportSummary(section?: string, subjectId?: string) {
    return this.adminReportsRepository.summary(section, subjectId);
  }

  async reportCurrentView(section?: string, subjectId?: string) {
    return this.adminReportsRepository.currentView(section, subjectId);
  }

  async reportExport(section?: string, subjectId?: string) {
    return this.adminReportsRepository.exportCsv(section, subjectId);
  }

  async reportDashboard(section?: string, subjectId?: string) {
    return this.adminReportsRepository.reportBundle(section, subjectId);
  }

  async requests(status?: string) {
    return this.adminOpsRepository.listRequests(status);
  }

  async requestAction(id: string, status: 'Approved' | 'Rejected') {
    const request = await this.adminOpsRepository.updateRequestStatus(id, status);
    await this.auditLogs.record({
      actorRole: 'ADMIN',
      action: status.toUpperCase(),
      module: 'Requests',
      target: `${request.type} – ${request.requester}`,
      result: 'Success',
      details: `Request moved to ${status}.`,
    });
    return { ok: true, status };
  }
}
