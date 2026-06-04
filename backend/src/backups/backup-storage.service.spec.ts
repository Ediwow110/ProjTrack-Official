import { BackupStorageService } from './backup-storage.service';
import { BackupS3StorageService } from './backup-s3-storage.service';

describe('BackupStorageService', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('provider defaults', () => {
    it('defaults to local provider when BACKUP_STORAGE_PROVIDER is not set', () => {
      delete process.env.BACKUP_STORAGE_PROVIDER;
      delete process.env.BACKUP_S3_BUCKET;
      const s3Storage = new BackupS3StorageService();
      const service = new BackupStorageService(s3Storage);
      expect(service.getProvider()).toBe('local');
    });
  });

  describe('provider routing', () => {
    it('uses local provider by default when no env var is set', () => {
      delete process.env.BACKUP_STORAGE_PROVIDER;
      delete process.env.BACKUP_S3_BUCKET;
      const s3Storage = new BackupS3StorageService();
      const service = new BackupStorageService(s3Storage);
      expect(service.getProvider()).toBe('local');
      expect(service.supportsLocalArtifacts()).toBe(true);
    });

    it('routes to S3 when BACKUP_STORAGE_PROVIDER=s3 and S3 is configured', () => {
      process.env.BACKUP_STORAGE_PROVIDER = 's3';
      process.env.BACKUP_S3_BUCKET = 'test-bucket';
      process.env.BACKUP_S3_REGION = 'us-east-1';
      process.env.BACKUP_S3_ACCESS_KEY_ID = 'test-key';
      process.env.BACKUP_S3_SECRET_ACCESS_KEY = 'test-secret';
      const s3Storage = new BackupS3StorageService();
      const service = new BackupStorageService(s3Storage);
      expect(service.getProvider()).toBe('s3');
      expect(service.supportsLocalArtifacts()).toBe(false);
    });

    it('still reports s3 provider when S3 is not available', () => {
      process.env.BACKUP_STORAGE_PROVIDER = 's3';
      delete process.env.BACKUP_S3_BUCKET;
      const s3Storage = new BackupS3StorageService();
      const service = new BackupStorageService(s3Storage);
      expect(service.getProvider()).toBe('s3');
      expect(service.supportsLocalArtifacts()).toBe(false);
    });
  });
});
