import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { json, urlencoded } from 'body-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { runWithRequestContext } from './common/request-context';
import { inspectRuntimeConfiguration } from './config/runtime-safety';
import { validateProductionEmailConfig } from './mail/mail-environment.guard';

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
  resolve(__dirname, '../.env'),
];

for (const candidate of envCandidates) {
  if (!existsSync(candidate)) continue;
  loadEnv({ path: candidate, override: false });
  break;
}

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');
  const runtimeConfiguration = inspectRuntimeConfiguration(process.env);
  const bodyParserLimit = process.env.API_BODY_LIMIT || '8mb';

  for (const warning of runtimeConfiguration.warnings) {
    bootstrapLogger.warn(warning);
  }

  if (!runtimeConfiguration.ok) {
    for (const error of runtimeConfiguration.errors) {
      bootstrapLogger.error(error);
    }
    throw new Error(`Runtime configuration is invalid. ${runtimeConfiguration.detail}`);
  }

  validateProductionEmailConfig(process.env);

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const logger = new Logger('HTTP');
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.use(json({
    limit: bodyParserLimit,
    verify: (req: any, _res, buf) => {
      const url = String(req?.originalUrl ?? req?.url ?? '');
      if (url.includes('/mail/webhooks/')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }));
  app.use(urlencoded({ extended: true, limit: bodyParserLimit }));
  app.use((req: any, res: any, next: () => void) => {
    const incomingRequestId = req?.headers?.['x-request-id'];
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim()
        ? incomingRequestId.trim()
        : randomUUID();
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    runWithRequestContext({ requestId }, () => {
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        logger.log(
          JSON.stringify({
            event: 'request.complete',
            requestId,
            method: req?.method,
            path: req?.originalUrl ?? req?.url,
            statusCode: res?.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            ipAddress: req?.ip || req?.socket?.remoteAddress,
          }),
        );
      });

      next();
    });
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: allowedOrigins,
  });
  await app.listen(Number(process.env.PORT ?? 3001));
}
bootstrap();
