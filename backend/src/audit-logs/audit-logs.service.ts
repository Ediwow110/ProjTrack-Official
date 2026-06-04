import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditRecordCreateInput } from '../repositories/audit-log.repository';
import { getRequestId } from '../common/request-context';

@Injectable()
export class AuditLogsService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(input: AuditRecordCreateInput) {
    const requestId = getRequestId();
    await this.auditLogRepository.create({ ...input, requestId: input.requestId ?? requestId });
    return { success: true };
  }

  async list() {
    return this.auditLogRepository.listAuditLogs();
  }
}
