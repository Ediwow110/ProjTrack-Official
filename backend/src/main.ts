import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { json, urlencoded } from 'body-parser';
import compression = require('compression');
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { runWithRequestContext } from './common/request-context';
import { logSafeMailRuntimeState } from './config/mail-runtime-diagnostics';
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
  logSafeMailRuntimeState(bootstrapLogger);

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance();
  if (String(process.env.TRUST_PROXY ?? 'false').toLowerCase() === 'true') {
    expressApp.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  }
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
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    const path = String(req?.originalUrl ?? req?.url ?? '');
    if (path.startsWith('/auth/')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    const rateLimited = [
      '/auth/login',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/files/upload-base64',
      '/admin/students/import',
    ].some((prefix) => path.startsWith(prefix));
    if (!rateLimited) return next();

    const windowMs = Number(process.env.HTTP_RATE_LIMIT_WINDOW_MS || 60_000);
    const limit = Number(process.env.HTTP_RATE_LIMIT_MAX || 120);
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${path.split('?')[0]}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      res.statusCode = 429;
      return res.json({ statusCode: 429, message: 'Too many requests. Please try again later.' });
    }
    return next();
  });
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
