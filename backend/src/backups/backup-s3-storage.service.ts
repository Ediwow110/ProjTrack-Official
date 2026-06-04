import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

@Injectable()
export class BackupS3StorageService {
  private readonly logger = new Logger(BackupS3StorageService.name);
  private s3Client: S3Client | null = null;
  private bucket = '';
  private prefix = '';

  constructor() {
    const endpoint = process.env.BACKUP_S3_ENDPOINT || '';
    const region = process.env.BACKUP_S3_REGION || '';
    const bucket = process.env.BACKUP_S3_BUCKET || '';
    const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY || '';
    const forcePathStyle = process.env.BACKUP_S3_FORCE_PATH_STYLE === 'true';

    if (!bucket) return;

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: forcePathStyle || undefined,
    });
    this.bucket = bucket;
    const raw = process.env.BACKUP_S3_PREFIX || '';
    this.prefix = raw.replace(/^\/+|\/+$/g, '');
    if (this.prefix && !this.prefix.endsWith('/')) this.prefix += '/';
  }

  isAvailable(): boolean {
    return this.s3Client !== null;
  }

  private buildKey(fileName: string): string {
    return `backups/${this.prefix}${fileName}`;
  }

  private assertReady(): void {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 backup storage is not configured.');
    }
  }

  private validate(fileName: string): void {
    if (!fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      throw new BadRequestException('Invalid backup file name.');
    }
  }

  async writeJson(
    fileName: string,
    payload: unknown,
  ): Promise<{ key: string; sizeBytes: number; sha256: string }> {
    this.assertReady();
    this.validate(fileName);
    const key = this.buildKey(fileName);
    const content = JSON.stringify(payload, null, 2) + '\n';
    const sha256 = createHash('sha256').update(content).digest('hex');
    try {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: content,
          ContentType: 'application/json',
        }),
      );
      return { key, sizeBytes: Buffer.byteLength(content, 'utf8'), sha256 };
    } catch (error) {
      this.logger.error(`S3 write failed: ${key}`);
      throw new InternalServerErrorException('Backup artifact could not be written to storage.');
    }
  }

  async readJson(fileName: string): Promise<unknown> {
    this.assertReady();
    this.validate(fileName);
    const key = this.buildKey(fileName);
    try {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client!.send(cmd);
      const body = await response.Body!.transformToString('utf8');
      return JSON.parse(body);
    } catch (error) {
      if ((error as { name: string }).name === 'NoSuchKey') {
        throw new NotFoundException('Backup artifact not found.');
      }
      this.logger.error(`S3 read failed: ${key}`);
      throw new InternalServerErrorException('Backup artifact could not be read from storage.');
    }
  }

  async describe(
    fileName: string,
  ): Promise<{
    provider: string;
    key: string;
    available: boolean;
    sizeBytes: number | null;
    warning: string | null;
  }> {
    this.assertReady();
    this.validate(fileName);
    const key = this.buildKey(fileName);
    try {
      const cmd = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client!.send(cmd);
      return {
        provider: 's3',
        key,
        available: true,
        sizeBytes: response.ContentLength ?? null,
        warning: null,
      };
    } catch (error) {
      if ((error as { name: string }).name === 'NotFound') {
        return {
          provider: 's3',
          key,
          available: false,
          sizeBytes: null,
          warning: 'Backup artifact is missing from storage.',
        };
      }
      this.logger.error(`S3 describe failed: ${key}`);
      return {
        provider: 's3',
        key,
        available: false,
        sizeBytes: null,
        warning: 'Backup artifact could not be checked.',
      };
    }
  }

  async delete(
    fileName: string,
  ): Promise<{ deleted: boolean; missing: boolean; key: string }> {
    this.assertReady();
    this.validate(fileName);
    const key = this.buildKey(fileName);
    try {
      await this.s3Client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return { deleted: true, missing: false, key };
    } catch (error) {
      if ((error as { name: string }).name === 'NotFound') {
        return { deleted: false, missing: true, key };
      }
      this.logger.error(`S3 delete failed: ${key}`);
      throw new InternalServerErrorException('Backup artifact could not be deleted from storage.');
    }
  }

  async listJsonArtifacts(): Promise<
    Array<{ fileName: string; key: string; sizeBytes: number; modifiedAt: Date }>
  > {
    this.assertReady();
    const searchPrefix = `backups/${this.prefix}`;
    try {
      const cmd = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: searchPrefix });
      const response = await this.s3Client!.send(cmd);
      return (response.Contents ?? [])
        .filter((obj) => obj.Key && obj.Key.endsWith('.json'))
        .map((obj) => {
          const fileName = obj.Key!.split('/').pop() || '';
          return {
            fileName,
            key: obj.Key!,
            sizeBytes: obj.Size ?? 0,
            modifiedAt: obj.LastModified ?? new Date(0),
          };
        });
    } catch (error) {
      this.logger.error(`S3 list failed: ${searchPrefix}`);
      return [];
    }
  }

  async checksum(fileName: string): Promise<string> {
    this.assertReady();
    this.validate(fileName);
    const key = this.buildKey(fileName);
    try {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client!.send(cmd);
      const body = await response.Body!.transformToString('utf8');
      return createHash('sha256').update(body).digest('hex');
    } catch (error) {
      if ((error as { name: string }).name === 'NoSuchKey') {
        throw new NotFoundException('Backup artifact not found.');
      }
      this.logger.error(`S3 checksum failed: ${key}`);
      throw new InternalServerErrorException('Backup artifact checksum could not be computed.');
    }
  }
}
