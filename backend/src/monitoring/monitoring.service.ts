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

export interface RecentClientErrorReport extends ClientErrorReport {
  receivedAt: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly recentClientErrors: RecentClientErrorReport[] = [];
  private readonly recentClientErrorLimit = 25;

  reportClientError(payload: ClientErrorReport) {
    const receivedAt = new Date().toISOString();
    const report: RecentClientErrorReport = {
      ...payload,
      receivedAt,
    };

    this.recentClientErrors.unshift(report);
    if (this.recentClientErrors.length > this.recentClientErrorLimit) {
      this.recentClientErrors.length = this.recentClientErrorLimit;
    }

    this.logger.error(
      JSON.stringify({
        event: 'client.error',
        ...report,
      }),
    );

    return {
      ok: true,
      errorId: payload.errorId,
      receivedAt,
    };
  }

  getRecentClientErrors() {
    return {
      count: this.recentClientErrors.length,
      items: [...this.recentClientErrors],
    };
  }
}
