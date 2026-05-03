import { getS3Config, getStorageMode, getStorageSummary } from './storage.config';

describe('storage.config', () => {
  const original = { ...process.env };

  function clearStorageEnv() {
    delete process.env.OBJECT_STORAGE_MODE;
    delete process.env.FILE_STORAGE_MODE;
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_FORCE_PATH_STYLE;
    delete process.env.S3_SIGNED_URL_TTL_SECONDS;
  }

  beforeEach(() => {
    process.env = { ...original };
    clearStorageEnv();
  });

  afterAll(() => {
    process.env = original;
  });

  describe('getStorageMode', () => {
    it('defaults to "local" when nothing is set', () => {
      expect(getStorageMode()).toBe('local');
    });
    it('honours OBJECT_STORAGE_MODE first', () => {
      process.env.OBJECT_STORAGE_MODE = 'S3';
      expect(getStorageMode()).toBe('s3');
    });
    it('falls back to FILE_STORAGE_MODE when OBJECT_STORAGE_MODE is unset', () => {
      process.env.FILE_STORAGE_MODE = 's3';
      expect(getStorageMode()).toBe('s3');
    });
  });

  describe('getS3Config', () => {
    it('returns empty defaults when no S3 env is configured', () => {
      const c = getS3Config();
      expect(c.bucket).toBe('');
      expect(c.region).toBe('');
      expect(c.endpoint).toBe('');
      expect(c.accessKeyId).toBe('');
      expect(c.secretAccessKey).toBe('');
      expect(c.forcePathStyle).toBe(false);
      expect(c.signedUrlTtlSeconds).toBe(300);
    });

    it('reads all configured S3 fields', () => {
      process.env.S3_BUCKET = 'projtrack-prod-uploads';
      process.env.S3_REGION = 'sgp1';
      process.env.S3_ENDPOINT = 'https://sgp1.digitaloceanspaces.com';
      process.env.S3_ACCESS_KEY_ID = 'AKIA...';
      process.env.S3_SECRET_ACCESS_KEY = 'secret';
      process.env.S3_FORCE_PATH_STYLE = 'true';
      process.env.S3_SIGNED_URL_TTL_SECONDS = '120';
      const c = getS3Config();
      expect(c.bucket).toBe('projtrack-prod-uploads');
      expect(c.region).toBe('sgp1');
      expect(c.endpoint).toBe('https://sgp1.digitaloceanspaces.com');
      expect(c.accessKeyId).toBe('AKIA...');
      expect(c.secretAccessKey).toBe('secret');
      expect(c.forcePathStyle).toBe(true);
      expect(c.signedUrlTtlSeconds).toBe(120);
    });
  });

  describe('getStorageSummary', () => {
    it('returns an empty local summary when storage is local', () => {
      const s = getStorageSummary();
      expect(s.mode).toBe('local');
      expect(s.bucket).toBe('');
      expect(s.region).toBe('');
      expect(s.endpoint).toBe('');
      expect(s.signedUrlTtlSeconds).toBe(0);
    });

    it('returns S3 summary fields without leaking credentials', () => {
      process.env.OBJECT_STORAGE_MODE = 's3';
      process.env.S3_BUCKET = 'b';
      process.env.S3_REGION = 'r';
      process.env.S3_ENDPOINT = 'https://e';
      process.env.S3_ACCESS_KEY_ID = 'AKIA-secret';
      process.env.S3_SECRET_ACCESS_KEY = 'top-secret';
      process.env.S3_SIGNED_URL_TTL_SECONDS = '600';
      const s = getStorageSummary() as any;
      expect(s.mode).toBe('s3');
      expect(s.bucket).toBe('b');
      expect(s.region).toBe('r');
      expect(s.endpoint).toBe('https://e');
      expect(s.signedUrlTtlSeconds).toBe(600);
      expect(s.accessKeyId).toBeUndefined();
      expect(s.secretAccessKey).toBeUndefined();
      expect(JSON.stringify(s)).not.toContain('top-secret');
      expect(JSON.stringify(s)).not.toContain('AKIA-secret');
    });
  });
});
