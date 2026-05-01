import { Injectable, Logger } from '@nestjs/common';

export interface ClientErrorReport {
  errorId: string;
  message: string;
  stack?: string;
  route?: string;
  userAgent?: string;
  online?: boolean;
  timestamp?: string;
  context?: Record<string, unknown>;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  reportClientError(payload: ClientErrorReport) {
    this.logger.error(
      JSON.stringify({
        event: 'client.error',
        ...payload,
      }),
    );

    return {
      ok: true,
      errorId: payload.errorId,
      receivedAt: new Date().toISOString(),
    };
  }
}
