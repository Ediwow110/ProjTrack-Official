import { BackupS3StorageService } from './backup-s3-storage.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('BackupS3StorageService', () => {
  const ORIGINAL_ENV = { ...process.env };

  function createConfiguredService(): BackupS3StorageService {
    process.env.BACKUP_S3_BUCKET = 'test-bucket';
    process.env.BACKUP_S3_REGION = 'us-east-1';
    process.env.BACKUP_S3_ACCESS_KEY_ID = 'test-key';
    process.env.BACKUP_S3_SECRET_ACCESS_KEY = 'test-secret';
    return new BackupS3StorageService();
  }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('isAvailable', () => {
    it('returns false when bucket is not configured', () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      expect(service.isAvailable()).toBe(false);
    });

    it('returns true when bucket is configured', () => {
      const service = createConfiguredService();
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('writeJson', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.writeJson('test.json', {})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('readJson', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.readJson('test.json')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('describe', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.describe('test.json')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('delete', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.delete('test.json')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('listJsonArtifacts', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.listJsonArtifacts()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('checksum', () => {
    it('throws when not configured', async () => {
      delete process.env.BACKUP_S3_BUCKET;
      const service = new BackupS3StorageService();
      await expect(service.checksum('test.json')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('validation', () => {
    it('rejects path traversal file name', async () => {
      const service = createConfiguredService();
      await expect(service.writeJson('../../etc/passwd', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects empty file name', async () => {
      const service = createConfiguredService();
      await expect(service.writeJson('', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
