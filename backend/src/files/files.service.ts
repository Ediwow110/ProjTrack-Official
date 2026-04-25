import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { getS3Config, getStorageSummary } from './storage.config';

@Injectable()
export class FilesService {
  private readonly storageRoot = join(process.cwd(), 'uploads');
  private readonly storage = getStorageSummary();
  private readonly s3Config = getS3Config();
  private readonly maxUploadBytes = Number(process.env.FILE_UPLOAD_MAX_MB || 20) * 1024 * 1024;
  private readonly allowedExtensions = String(
    process.env.FILE_UPLOAD_ALLOWED_EXTENSIONS || '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp',
  )
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  private readonly s3Client =
    this.storage.mode === 's3' && this.s3Config.bucket && this.s3Config.region
      ? new S3Client({
          region: this.s3Config.region,
          endpoint: this.s3Config.endpoint || undefined,
          forcePathStyle: this.s3Config.forcePathStyle,
          credentials:
            this.s3Config.accessKeyId && this.s3Config.secretAccessKey
              ? {
                  accessKeyId: this.s3Config.accessKeyId,
                  secretAccessKey: this.s3Config.secretAccessKey,
                }
              : undefined,
        })
      : null;

  constructor(private readonly prisma: PrismaService) {
    if (this.storage.mode === 'local' && !existsSync(this.storageRoot)) {
      mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  private ensureDir(scope: string) {
    const dir = join(this.storageRoot, scope);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private normalizeRelativePath(relativePath: string) {
    const normalized = String(relativePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();

    if (!normalized || normalized.includes('..') || !/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) {
      throw new BadRequestException('Invalid file path.');
    }

    return normalized;
  }

  private inferContentType(fileName: string) {
    switch (extname(fileName).toLowerCase()) {
      case '.pdf':
        return 'application/pdf';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.ppt':
        return 'application/vnd.ms-powerpoint';
      case '.pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.csv':
        return 'text/csv';
      case '.txt':
        return 'text/plain';
      case '.zip':
        return 'application/zip';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  private async putObject(relativePath: string, fileName: string, buffer: Buffer) {
    const normalized = this.normalizeRelativePath(relativePath);

    if (this.storage.mode === 's3') {
      if (!this.s3Client || !this.s3Config.bucket) {
        throw new BadRequestException('S3 storage is enabled, but the client is not configured correctly.');
      }

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: normalized,
          Body: buffer,
          ContentType: this.inferContentType(fileName),
        }),
      );
      return;
    }

    const dir = this.ensureDir(normalized.split('/').slice(0, -1).join('/') || 'general');
    writeFileSync(join(dir, basename(normalized)), buffer);
  }

  private async deleteObject(relativePath: string) {
    const normalized = this.normalizeRelativePath(relativePath);

    if (this.storage.mode === 's3') {
      if (!this.s3Client || !this.s3Config.bucket) {
        throw new BadRequestException('S3 storage is enabled, but the client is not configured correctly.');
      }

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: normalized,
        }),
      );
      return;
    }

    const target = join(this.storageRoot, normalized);
    if (!existsSync(target)) {
      throw new NotFoundException('File not found.');
    }
    unlinkSync(target);
  }

  private async buildSignedDownload(relativePath: string, fileName: string) {
    if (!this.s3Client || !this.s3Config.bucket) {
      throw new NotFoundException('Object storage client is not configured.');
    }

    const normalized = this.normalizeRelativePath(relativePath);
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: normalized,
        }),
      );
    } catch (error) {
      throw new NotFoundException(
        `Stored object not found: ${error instanceof Error ? error.message : 'Unknown object storage error'}`,
      );
    }

    const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: normalized,
        ResponseContentDisposition: `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
      }),
      { expiresIn: this.s3Config.signedUrlTtlSeconds },
    );
  }

  async hasObject(relativePath?: string | null) {
    const raw = String(relativePath || '').trim();
    if (!raw) return false;

    let normalized = '';
    try {
      normalized = this.normalizeRelativePath(raw);
    } catch {
      return false;
    }

    if (this.storage.mode === 's3') {
      if (!this.s3Client || !this.s3Config.bucket) return false;
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.s3Config.bucket,
            Key: normalized,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    return existsSync(join(this.storageRoot, normalized));
  }

  async healthCheck() {
    const timestamp = new Date().toISOString();

    if (this.storage.mode === 's3') {
      if (!this.s3Client || !this.s3Config.bucket || !this.s3Config.region) {
        return {
          ok: false,
          storageMode: this.storage.mode,
          uploadsPath: this.storageRoot,
          bucket: this.s3Config.bucket,
          region: this.s3Config.region,
          endpoint: this.s3Config.endpoint,
          available: false,
          detail: 'S3 mode is enabled, but the object storage configuration is incomplete.',
          timestamp,
        };
      }

      return {
        ...(await (async () => {
          const probeKey = `.health/probe-${Date.now()}-${randomUUID()}.txt`;
          try {
            await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Config.bucket }));
            await this.s3Client.send(
              new PutObjectCommand({
                Bucket: this.s3Config.bucket,
                Key: probeKey,
                Body: Buffer.from('ok', 'utf8'),
                ContentType: 'text/plain',
              }),
            );
            await this.s3Client.send(
              new HeadObjectCommand({
                Bucket: this.s3Config.bucket,
                Key: probeKey,
              }),
            );
            await this.s3Client.send(
              new DeleteObjectCommand({
                Bucket: this.s3Config.bucket,
                Key: probeKey,
              }),
            );

            return {
              ok: true,
              storageMode: 's3',
              uploadsPath: '',
              bucket: this.s3Config.bucket,
              region: this.s3Config.region,
              endpoint: this.s3Config.endpoint,
              available: true,
              detail: 'Object storage read/write probes succeeded.',
              timestamp,
            };
          } catch (error) {
            return {
              ok: false,
              storageMode: 's3',
              uploadsPath: '',
              bucket: this.s3Config.bucket,
              region: this.s3Config.region,
              endpoint: this.s3Config.endpoint,
              available: false,
              detail: `Object storage probe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp,
            };
          }
        })()),
      };
    }

    try {
      const probeDir = this.ensureDir('.health');
      const probeFile = join(probeDir, `probe-${Date.now()}.tmp`);
      writeFileSync(probeFile, 'ok', 'utf8');
      const content = readFileSync(probeFile, 'utf8');
      unlinkSync(probeFile);
      const available = content === 'ok';

      return {
        ok: false,
        storageMode: 'local',
        uploadsPath: this.storageRoot,
        bucket: '',
        region: '',
        endpoint: '',
        available,
        detail: available
          ? 'Local uploads directory is writable, but production object storage is not enabled.'
          : 'Local uploads probe failed.',
        timestamp,
      };
    } catch (error) {
      return {
        ok: false,
        storageMode: 'local',
        uploadsPath: this.storageRoot,
        bucket: '',
        region: '',
        endpoint: '',
        available: false,
        detail: `Storage probe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      };
    }
  }

  async uploadBase64(input: {
    fileName: string;
    contentBase64: string;
    scope?: string;
    uploadedByUserId?: string;
    uploadedByRole?: string;
  }) {
    const scope = String(input.scope || 'general').trim();
    if (!/^[a-zA-Z0-9/_-]+$/.test(scope)) {
      throw new BadRequestException('Invalid upload scope.');
    }

    const safeName = basename(input.fileName || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = extname(safeName).toLowerCase();
    if (extension && this.allowedExtensions.length && !this.allowedExtensions.includes(extension)) {
      throw new BadRequestException(`Unsupported file type ${extension}.`);
    }

    const buffer = Buffer.from(input.contentBase64, 'base64');
    if (!buffer.byteLength) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    if (buffer.byteLength > this.maxUploadBytes) {
      throw new BadRequestException(`Uploaded file exceeds the ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB limit.`);
    }

    const id = randomUUID();
    const outputName = `${id}${extname(safeName) || '.bin'}`;
    const relativePath = this.normalizeRelativePath(join(scope, outputName).replace(/\\/g, '/'));
    await this.putObject(relativePath, safeName, buffer);

    return {
      id,
      fileName: safeName,
      storedName: outputName,
      scope,
      sizeBytes: buffer.byteLength,
      path: this.storage.mode === 'local' ? join(this.storageRoot, relativePath) : relativePath,
      relativePath,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: input.uploadedByUserId,
      uploadedByRole: input.uploadedByRole,
    };
  }

  async list(scope?: string) {
    const scopedFiles = await this.prisma.submissionFile.findMany({
      where: scope ? { relativePath: { startsWith: `${scope}/` } } : undefined,
      include: {
        submission: {
          select: {
            subjectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const indexed = new Map(
      scopedFiles
        .filter((file) => Boolean(file.relativePath))
        .map((file) => [
          String(file.relativePath),
          {
            id: file.id,
            fileName: file.fileName,
            storedName: basename(file.relativePath || file.fileName),
            scope: (file.relativePath || '').split('/')[0] || scope || 'general',
            sizeBytes: file.fileSize,
            relativePath: file.relativePath,
            uploadedAt: file.createdAt.toISOString(),
            modifiedAt: file.createdAt.toISOString(),
            submissionId: file.submissionId,
            subjectId: file.submission?.subjectId,
          },
        ]),
    );

    const storageRows = this.storage.mode === 's3'
      ? await this.listS3Objects(scope)
      : this.listLocalObjects(scope);

    for (const row of storageRows) {
      if (!indexed.has(row.relativePath)) {
        indexed.set(row.relativePath, row);
      }
    }

    return Array.from(indexed.values()).sort((a, b) =>
      String(b.uploadedAt || b.modifiedAt || '').localeCompare(String(a.uploadedAt || a.modifiedAt || '')),
    );
  }

  private listLocalObjects(scope?: string) {
    const baseDir = scope ? join(this.storageRoot, scope) : this.storageRoot;
    if (!existsSync(baseDir)) return [];

    const collect = (dir: string, prefix = ''): Array<any> => {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const nextPath = join(dir, entry.name);
        const relative = join(prefix, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) return [];
          return collect(nextPath, relative);
        }
        if (!entry.isFile()) return [];
        const stat = statSync(nextPath);
        const normalized = (scope ? join(scope, relative) : relative).replace(/\\/g, '/');
        if (normalized.startsWith('.health/')) return [];
        return [{
          storedName: basename(normalized),
          fileName: basename(normalized),
          scope: normalized.split('/')[0] || 'general',
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          uploadedAt: stat.mtime.toISOString(),
          relativePath: normalized,
        }];
      });
    };

    return collect(baseDir);
  }

  private async listS3Objects(scope?: string) {
    if (!this.s3Client || !this.s3Config.bucket) return [];

    const prefix = scope ? `${scope.replace(/^\/+/, '').replace(/\/+$/, '')}/` : undefined;
    const rows: any[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.s3Config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of response.Contents || []) {
        const key = String(item.Key || '').trim();
        if (!key || key.endsWith('/') || key.startsWith('.health/')) continue;
        rows.push({
          storedName: basename(key),
          fileName: basename(key),
          scope: key.split('/')[0] || 'general',
          sizeBytes: Number(item.Size || 0),
          modifiedAt: item.LastModified?.toISOString(),
          uploadedAt: item.LastModified?.toISOString(),
          relativePath: key,
        });
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return rows;
  }

  async resolveForDownload(relativePath: string, actor?: { userId?: string; role?: string }) {
    const normalized = this.normalizeRelativePath(relativePath);

    const meta = await this.prisma.submissionFile.findFirst({
      where: { relativePath: normalized },
      include: {
        submission: {
          include: {
            group: { include: { members: true } },
          },
        },
      },
    });

    if (meta && actor?.role === 'STUDENT') {
      const ownsIndividualSubmission = meta.submission?.studentId === actor.userId;
      const ownsGroupSubmission = !!meta.submission?.group?.members.some((member) => member.studentId === actor.userId);
      if (!ownsIndividualSubmission && !ownsGroupSubmission) {
        throw new ForbiddenException('You do not have access to this file.');
      }
    }

    if (this.storage.mode === 's3') {
      const fileName = meta?.fileName || basename(normalized);
      return {
        absolutePath: '',
        downloadUrl: await this.buildSignedDownload(normalized, fileName),
        expiresInSeconds: this.s3Config.signedUrlTtlSeconds,
        fileName,
        meta,
      };
    }

    const target = join(this.storageRoot, normalized);
    if (!existsSync(target)) {
      throw new NotFoundException('File not found.');
    }

    return {
      absolutePath: target,
      fileName: meta?.fileName || basename(target),
      meta,
    };
  }

  async attachFilesToSubmission(input: {
    relativePaths: string[];
    submissionId: string;
    activityId?: string;
    subjectId?: string;
  }) {
    return this.prisma.submissionFile.findMany({
      where: {
        submissionId: input.submissionId,
        relativePath: { in: input.relativePaths },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForSubmission(submissionId: string) {
    return this.prisma.submissionFile.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(relativePath: string) {
    await this.deleteObject(relativePath);
    return { success: true, removed: relativePath };
  }
}
