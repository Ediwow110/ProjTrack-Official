import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function redactDatabaseUrl(rawUrl: string | undefined) {
  const value = String(rawUrl ?? '').trim();
  if (!value) return 'not set';

  try {
    const url = new URL(value);
    const username = url.username ? `${url.username}:****@` : '';
    return `${url.protocol}//${username}${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search ? '?...' : ''}`;
  } catch {
    return value.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:****@');
  }
}

function isConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Can't reach database server/i.test(message) ||
    /ECONNREFUSED/i.test(message) ||
    /P1001/i.test(message) ||
    /connect ETIMEDOUT/i.test(message) ||
    /Connection terminated/i.test(message)
  );
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  [key: string]: any;

  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const safeDatabaseUrl = redactDatabaseUrl(process.env.DATABASE_URL);

      this.logger.error(`Database connection failed for ${safeDatabaseUrl}.`);

      if (isConnectionError(error)) {
        this.logger.error(
          [
            'Local repair steps:',
            '1. Start Docker Desktop.',
            '2. Run npm run prepare:local from the project root.',
            '3. Run npm run backend:local or npm start.',
            '4. Run npm run backend:doctor if it still fails.',
          ].join(' '),
        );
      }

      throw new Error(`Database connection failed. ${detail}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
