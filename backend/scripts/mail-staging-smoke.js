#!/usr/bin/env node
require('dotenv').config();
require('ts-node/register/transpile-only');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { MailService } = require('../src/mail/mail.service');

async function main() {
  const to = String(process.env.MAIL_SMOKE_TO || '').trim();
  if (!to) throw new Error('MAIL_SMOKE_TO is required.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const mail = app.get(MailService);
    const result = await mail.queueAdminTestEmail(to);
    console.log(JSON.stringify({
      ok: true,
      queued: result.queued,
      provider: result.provider,
      jobId: result.jobId,
      status: result.status,
    }));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

