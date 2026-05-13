import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StudentSubmitDto } from '../../src/submissions/dto/submission.dto';
import { LoginDto } from '../../src/auth/dto/login.dto';
import { inspectRuntimeConfiguration } from '../../src/config/runtime-safety';

async function validationErrors(dtoClass: any, payload: Record<string, unknown>) {
  const instance = plainToInstance(dtoClass, payload);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
}

describe('input hardening security gate', () => {
  it('rejects mass-assignment fields on student submission DTOs', async () => {
    const errors = await validationErrors(StudentSubmitDto, {
      activityId: 'activity-1',
      title: 'Legitimate submission',
      description: 'Safe body',
      status: 'Approved',
      userId: 'attacker-user-id',
      role: 'ADMIN',
      ownerId: 'other-owner',
    });

    const rejectedProperties = errors.map((error) => error.property);
    expect(rejectedProperties).toEqual(expect.arrayContaining(['status', 'userId', 'role', 'ownerId']));
  });

  it('rejects unexpected fields on login DTOs', async () => {
    const errors = await validationErrors(LoginDto, {
      identifier: 'student@example.com',
      password: 'StrongPass123!',
      expectedRole: 'STUDENT',
      role: 'ADMIN',
      status: 'ACTIVE',
      isAdmin: true,
    });

    const rejectedProperties = errors.map((error) => error.property);
    expect(rejectedProperties).toEqual(expect.arrayContaining(['role', 'status', 'isAdmin']));
  });

  it('flags weak JWT secrets in production runtime configuration', () => {
    const result = inspectRuntimeConfiguration({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/projtrack',
      JWT_ACCESS_SECRET: 'secret',
      JWT_REFRESH_SECRET: 'secret',
      ACCOUNT_ACTION_TOKEN_ENC_KEY: Buffer.alloc(32, 'a').toString('base64'),
      APP_URL: 'https://www.projtrack.codes',
      FRONTEND_URL: 'https://www.projtrack.codes',
      BACKEND_URL: 'https://api.projtrack.codes',
      CORS_ORIGINS: 'https://www.projtrack.codes',
      MAIL_PROVIDER: 'mailrelay',
      MAIL_FROM_NAME: 'ProjTrack',
      MAIL_FROM_ADMIN: 'admin@projtrack.codes',
      MAIL_FROM_NOREPLY: 'noreply@projtrack.codes',
      MAIL_FROM_INVITE: 'invite@projtrack.codes',
      MAIL_FROM_NOTIFY: 'notify@projtrack.codes',
      MAIL_FROM_SUPPORT: 'support@projtrack.codes',
      MAILRELAY_API_KEY: 'realistic-mailrelay-key-not-placeholder-0000000000',
      MAILRELAY_API_URL: 'https://mailrelay.example.com',
      OBJECT_STORAGE_MODE: 's3',
      S3_BUCKET: 'projtrack-files',
      S3_REGION: 'ap-southeast-1',
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
      S3_SIGNED_URL_TTL_SECONDS: '300',
      MAIL_WORKER_ENABLED: 'true',
      BACKUP_WORKER_ENABLED: 'true',
      BACKUP_SCHEDULE_ENABLED: 'true',
      MAIL_WORKER_POLL_MS: '5000',
      BACKUP_WORKER_POLL_MS: '60000',
      HTTP_RATE_LIMIT_STORE: 'database',
      FILE_MALWARE_SCAN_MODE: 'fail-closed',
      FILE_MALWARE_SCANNER: 'clamav',
      CLAMAV_HOST: 'clamav.example.internal',
      CLAMAV_PORT: '3310',
      TRUST_PROXY: 'true',
      JWT_ISSUER: 'projtrack',
      JWT_AUDIENCE: 'projtrack-users',
      JWT_KEY_ID: 'key-2026-05',
    } as any);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/JWT_ACCESS_SECRET/i);
    expect(result.errors.join('\n')).toMatch(/JWT_REFRESH_SECRET/i);
    expect(result.errors.join('\n')).toMatch(/must be different/i);
  });

  it('flags unsafe local production storage and rate-limit settings', () => {
    const result = inspectRuntimeConfiguration({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/projtrack',
      JWT_ACCESS_SECRET: 'a'.repeat(64),
      JWT_REFRESH_SECRET: 'b'.repeat(64),
      ACCOUNT_ACTION_TOKEN_ENC_KEY: Buffer.alloc(32, 'b').toString('base64'),
      APP_URL: 'https://www.projtrack.codes',
      FRONTEND_URL: 'https://www.projtrack.codes',
      BACKEND_URL: 'https://api.projtrack.codes',
      CORS_ORIGINS: 'https://www.projtrack.codes',
      MAIL_PROVIDER: 'mailrelay',
      MAIL_FROM_NAME: 'ProjTrack',
      MAIL_FROM_ADMIN: 'admin@projtrack.codes',
      MAIL_FROM_NOREPLY: 'noreply@projtrack.codes',
      MAIL_FROM_INVITE: 'invite@projtrack.codes',
      MAIL_FROM_NOTIFY: 'notify@projtrack.codes',
      MAIL_FROM_SUPPORT: 'support@projtrack.codes',
      MAILRELAY_API_KEY: 'realistic-mailrelay-key-not-placeholder-0000000000',
      MAILRELAY_API_URL: 'https://mailrelay.example.com',
      OBJECT_STORAGE_MODE: 'local',
      MAIL_WORKER_ENABLED: 'true',
      BACKUP_WORKER_ENABLED: 'true',
      BACKUP_SCHEDULE_ENABLED: 'true',
      MAIL_WORKER_POLL_MS: '5000',
      BACKUP_WORKER_POLL_MS: '60000',
      HTTP_RATE_LIMIT_STORE: 'memory',
      FILE_MALWARE_SCAN_MODE: 'disabled',
      TRUST_PROXY: 'false',
      JWT_ISSUER: 'projtrack',
      JWT_AUDIENCE: 'projtrack-users',
      JWT_KEY_ID: 'key-2026-05',
    } as any);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/OBJECT_STORAGE_MODE=s3/i);
    expect(result.errors.join('\n')).toMatch(/HTTP_RATE_LIMIT_STORE/i);
    expect(result.errors.join('\n')).toMatch(/FILE_MALWARE_SCAN_MODE/i);
    expect(result.errors.join('\n')).toMatch(/TRUST_PROXY=true/i);
  });
});
