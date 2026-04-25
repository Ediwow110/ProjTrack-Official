import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditRecordCreateInput } from '../repositories/audit-log.repository';

@Injectable()
export class AuditLogsService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(input: AuditRecordCreateInput) {
    await this.auditLogRepository.create(input);
    return { success: true };
  }

  async list() {
    return this.auditLogRepository.listAuditLogs();
  }
}
