import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { getRequestId } from './request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();
    const requestId = getRequestId() || String(request?.requestId || '');
    const timestamp = new Date().toISOString();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawResponse = isHttpException ? exception.getResponse() : null;
    const payload =
      typeof rawResponse === 'string'
        ? { message: rawResponse }
        : rawResponse && typeof rawResponse === 'object'
          ? (rawResponse as Record<string, unknown>)
          : {};

    const message =
      payload.message ??
      (isHttpException ? (exception instanceof Error ? exception.message : 'Request failed') : 'Internal server error');

    const errorName =
      payload.error ??
      (isHttpException ? exception.name : 'Internal Server Error');

    response.setHeader('X-Request-Id', requestId);

    this.logger.error(
      JSON.stringify({
        event: 'request.error',
        requestId,
        method: request?.method,
        path: request?.originalUrl ?? request?.url,
        statusCode: status,
        error: errorName,
        message,
      }),
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      requestId,
      timestamp,
      path: request?.originalUrl ?? request?.url,
    });
  }
}
