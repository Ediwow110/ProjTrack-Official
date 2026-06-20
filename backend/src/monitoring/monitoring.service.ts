import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

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
  private readonly intakeWindowMs = 60_000;
  private readonly maxClientErrorReportsPerWindow = 60;
  private intakeWindowStartedAt = Date.now();
  private intakeWindowCount = 0;

  reportClientError(payload: ClientErrorReport) {
    this.assertClientErrorIntakeAllowed();
    const sanitizedPayload = this.sanitizeClientErrorReport(payload);
    const receivedAt = new Date().toISOString();
    const report: RecentClientErrorReport = {
      ...sanitizedPayload,
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
      errorId: report.errorId,
      receivedAt,
    };
  }

  getRecentClientErrors() {
    return {
      count: this.recentClientErrors.length,
      items: [...this.recentClientErrors],
    };
  }

  private assertClientErrorIntakeAllowed() {
    const now = Date.now();
    if (now - this.intakeWindowStartedAt >= this.intakeWindowMs) {
      this.intakeWindowStartedAt = now;
      this.intakeWindowCount = 0;
    }

    this.intakeWindowCount += 1;
    if (this.intakeWindowCount > this.maxClientErrorReportsPerWindow) {
      throw new HttpException('Too many client error reports.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private sanitizeClientErrorReport(payload: ClientErrorReport): ClientErrorReport {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Client error report body is required.');
    }

    return {
      errorId: this.requiredText(payload.errorId, 'errorId', 120),
      message: this.requiredText(payload.message, 'message', 500),
      stack: this.optionalText(payload.stack, 2_000),
      route: this.optionalText(payload.route, 300),
      userAgent: this.optionalText(payload.userAgent, 500),
      online: typeof payload.online === 'boolean' ? payload.online : undefined,
      timestamp: this.optionalText(payload.timestamp, 100),
      context: this.sanitizeContext(payload.context),
    };
  }

  private requiredText(value: unknown, fieldName: string, maxLength: number) {
    const text = String(value ?? '').trim();
    if (!text) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
    return text.slice(0, maxLength);
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text ? text.slice(0, maxLength) : undefined;
  }

  private sanitizeContext(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > 2_000) {
        return {
          truncated: true,
          preview: serialized.slice(0, 2_000),
        };
      }
      return value as Record<string, unknown>;
    } catch {
      return {
        truncated: true,
        preview: '[unserializable context]',
      };
    }
  }
}
