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
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { runWithRequestContext } from './common/request-context';
import { logSafeMailRuntimeState } from './config/mail-runtime-diagnostics';
import { inspectRuntimeConfiguration } from './config/runtime-safety';
import { validateProductionEmailConfig } from './mail/mail-environment.guard';
import { BRANDING_ASSET_ROUTE_PREFIX } from './branding/branding.constants';
import { PrismaClient } from '@prisma/client';

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

function isProductionRuntime() {
  return (
    String(process.env.NODE_ENV ?? '').toLowerCase() === 'production' ||
    String(process.env.APP_ENV ?? '').toLowerCase() === 'production'
  );
}

function contentSecurityPolicy() {
  const appUrl = String(process.env.FRONTEND_URL || process.env.APP_URL || "'self'").replace(/\/+$/, '');
  const apiUrl = String(process.env.BACKEND_URL || '').replace(/\/+$/, '');
  const connectSrc = ["'self'", appUrl, apiUrl, ...(process.env.CSP_CONNECT_SRC || '').split(',')]
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', ...(process.env.CSP_IMG_SRC || '').split(',').map((value) => value.trim()).filter(Boolean)],
      connectSrc,
    },
  };
}

function rateLimitRules() {
  return [
    { name: 'login', prefix: '/auth/login', max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 20), windowMs: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 60_000) },
    { name: 'refresh', prefix: '/auth/refresh', max: Number(process.env.RATE_LIMIT_REFRESH_MAX || 60), windowMs: Number(process.env.RATE_LIMIT_REFRESH_WINDOW_MS || 60_000) },
    { name: 'forgot-password', prefix: '/auth/forgot-password', max: Number(process.env.RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX || 5), windowMs: Number(process.env.RATE_LIMIT_PASSWORD_RESET_REQUEST_WINDOW_MS || 60 * 60_000) },
    { name: 'reset-password', prefix: '/auth/reset-password', max: Number(process.env.RATE_LIMIT_PASSWORD_RESET_MAX || 10), windowMs: Number(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || 60 * 60_000) },
    { name: 'activation', prefix: '/auth/activate', max: Number(process.env.RATE_LIMIT_ACTIVATION_MAX || 10), windowMs: Number(process.env.RATE_LIMIT_ACTIVATION_WINDOW_MS || 60 * 60_000) },
    { name: 'file-upload', prefix: '/files/upload', max: Number(process.env.RATE_LIMIT_FILE_UPLOAD_MAX || 30), windowMs: Number(process.env.RATE_LIMIT_FILE_UPLOAD_WINDOW_MS || 60 * 60_000) },
    { name: 'admin-import', prefix: '/admin/students/import', max: Number(process.env.RATE_LIMIT_ADMIN_IMPORT_MAX || 20), windowMs: Number(process.env.RATE_LIMIT_ADMIN_IMPORT_WINDOW_MS || 60 * 60_000) },
    { name: 'report-export', prefix: '/admin/reports/export', max: Number(process.env.RATE_LIMIT_REPORT_EXPORT_MAX || 30), windowMs: Number(process.env.RATE_LIMIT_REPORT_EXPORT_WINDOW_MS || 60 * 60_000) },
    { name: 'health', prefix: '/health', max: Number(process.env.RATE_LIMIT_HEALTH_MAX || 120), windowMs: Number(process.env.RATE_LIMIT_HEALTH_WINDOW_MS || 60_000) },
  ];
}

async function databaseRateLimit(
  prisma: PrismaClient,
  action: string,
  key: string,
  max: number,
  windowMs: number,
) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  await prisma.authRateLimit.deleteMany({
    where: { action, key, firstAttemptAt: { lte: windowStart } },
  });
  const row = await prisma.authRateLimit.upsert({
    where: { action_key: { action, key } },
    update: { attempts: { increment: 1 }, lastAttemptAt: now },
    create: { action, key, attempts: 1, firstAttemptAt: now, lastAttemptAt: now },
  });
  return row.attempts <= max;
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

  const prisma = new PrismaClient();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance();
  app.useStaticAssets(resolve(__dirname, '../uploads/branding'), {
    prefix: `${BRANDING_ASSET_ROUTE_PREFIX}/`,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
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
    contentSecurityPolicy: contentSecurityPolicy(),
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const useDatabaseRateLimit = String(process.env.HTTP_RATE_LIMIT_STORE || '').toLowerCase() === 'database';
  app.use(async (req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProductionRuntime()) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    const path = String(req?.originalUrl ?? req?.url ?? '');
    if (path.startsWith('/health')) {
      return next(); // liveness/readiness must never be rate-limited or DB-dependent
    }
    if (path.startsWith('/auth/')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    const rule = rateLimitRules().find((item) => path.startsWith(item.prefix));
    if (!rule) return next();

    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${path.split('?')[0]}`;
    const now = Date.now();
    if (useDatabaseRateLimit) {
      try {
        const allowed = await databaseRateLimit(prisma, `http:${rule.name}`, key, rule.max, rule.windowMs);
        if (!allowed) {
          res.statusCode = 429;
          return res.json({ statusCode: 429, message: 'Too many requests. Please try again later.' });
        }
        return next();
      } catch (error) {
        if (isProductionRuntime()) {
          res.statusCode = 503;
          return res.json({ statusCode: 503, message: 'Rate limiting is temporarily unavailable.' });
        }
        logger.warn(`Database rate limiting unavailable; using memory bucket. ${error instanceof Error ? error.message : ''}`.trim());
      }
    }
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > rule.max) {
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
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  });
  await app.listen(Number(process.env.PORT ?? 3001));
  const apiLogger = new Logger('Bootstrap');
  apiLogger.log('API server listening on port ' + (process.env.PORT ?? 3001));

  const shutdown = async (signal) => {
    const shutdownLogger = new Logger('Bootstrap');
    shutdownLogger.log('Received ' + signal + '; closing HTTP server gracefully.');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  if (/Database connection failed|Can't reach database server|P1001|ECONNREFUSED/i.test(message)) {
    logger.error('Local backend startup failed because PostgreSQL is not reachable or DATABASE_URL points at the wrong database. Run npm run backend:doctor, then npm run prepare:local.');
    if (isProductionRuntime()) {
      process.exit(1);
    }
    logger.warn('Continuing without database is only allowed for local development startup diagnostics.');
  } else {
    process.exit(1);
  }
});
