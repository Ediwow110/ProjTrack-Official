import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');
  const runtimeConfiguration = inspectRuntimeConfiguration(process.env);

  for (const warning of runtimeConfiguration.warnings) {
    logger.warn(warning);
  }

  if (!runtimeConfiguration.ok) {
    for (const error of runtimeConfiguration.errors) {
      logger.error(error);
    }
    throw new Error(`Runtime configuration is invalid. ${runtimeConfiguration.detail}`);
  }

  validateProductionEmailConfig(process.env);
  logSafeMailRuntimeState(logger);

  const app = await NestFactory.createApplicationContext(AppModule);
  logger.log('Dedicated worker process started. No HTTP listener is opened by this entrypoint.');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}; stopping worker process.`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrapWorker().catch((error) => {
  const logger = new Logger('WorkerBootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
