import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MailWebhookService } from '../../src/mail/mail.webhook.service';

function buildWebhookService() {
  const prisma = {
    emailProviderEvent: {
      create: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
    },
    emailJob: { updateMany: jest.fn(async () => ({ count: 0 })) },
    emailSuppression: { upsert: jest.fn(async () => ({})) },
  } as any;
  return { service: new MailWebhookService(prisma), prisma };
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('webhook abuse security gate', () => {
  it('rejects missing webhook bodies before provider-event writes', async () => {
    const { service, prisma } = buildWebhookService();
    process.env.RESEND_WEBHOOK_SECRET = '';
    process.env.ALLOW_UNSAFE_DEV_WEBHOOKS = 'true';

    await expect(service.handleResendWebhook('', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emailProviderEvent.create).not.toHaveBeenCalled();
  });

  it('rejects unsigned webhooks unless unsafe dev bypass is explicitly enabled', async () => {
    const { service, prisma } = buildWebhookService();
    process.env.RESEND_WEBHOOK_SECRET = '';
    process.env.ALLOW_UNSAFE_DEV_WEBHOOKS = 'false';

    await expect(
      service.handleResendWebhook(JSON.stringify({ id: 'evt-1', type: 'email.delivered' }), { 'svix-id': 'evt-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.emailProviderEvent.create).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures when a webhook secret is configured', async () => {
    const { service, prisma } = buildWebhookService();
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.ALLOW_UNSAFE_DEV_WEBHOOKS = 'true';

    await expect(
      service.handleResendWebhook(JSON.stringify({ id: 'evt-1', type: 'email.delivered' }), {
        'svix-id': 'evt-1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'invalid',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.emailProviderEvent.create).not.toHaveBeenCalled();
  });

  it('requires a provider event id even in explicitly unsafe dev mode', async () => {
    const { service, prisma } = buildWebhookService();
    process.env.RESEND_WEBHOOK_SECRET = '';
    process.env.ALLOW_UNSAFE_DEV_WEBHOOKS = 'true';

    await expect(
      service.handleResendWebhook(JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg-1' } }), {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.emailProviderEvent.create).not.toHaveBeenCalled();
  });

  it('deduplicates replayed provider events by returning duplicate success', async () => {
    const p2002 = Object.assign(new Error('duplicate'), { code: 'P2002' });
    const { service, prisma } = buildWebhookService();
    prisma.emailProviderEvent.create.mockRejectedValueOnce(p2002);
    process.env.RESEND_WEBHOOK_SECRET = '';
    process.env.ALLOW_UNSAFE_DEV_WEBHOOKS = 'true';

    await expect(
      service.handleResendWebhook(JSON.stringify({ id: 'evt-1', type: 'email.delivered' }), { 'svix-id': 'evt-1' }),
    ).resolves.toEqual({ success: true, duplicate: true, providerEventId: 'evt-1' });

    expect(prisma.emailProviderEvent.update).not.toHaveBeenCalled();
  });
});
