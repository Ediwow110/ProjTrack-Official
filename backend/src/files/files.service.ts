import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { createHash, randomUUID } from 'crypto';
import { Socket } from 'net';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { getS3Config, getStorageSummary } from './storage.config';
import { AccessService } from '../access/access.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export type PendingUploadForSubmission = {
  id: string;
  userId: string;
  scope: string;
  storageKey: string;
  originalFilename: string;
  sanitizedFilename: string;
  mimeType: string | null;
  detectedExtension: string | null;
  sizeBytes: number;
  sha256: string | null;
  expiresAt: Date;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly storageRoot = join(process.cwd(), 'uploads');
  private readonly storage = getStorageSummary();
  private readonly s3Config = getS3Config();
  private readonly maxUploadBytes = Number(process.env.FILE_UPLOAD_MAX_MB || 20) * 1024 * 1024;
  private readonly pendingUploadTtlMs = Math.max(5, Number(process.env.PENDING_UPLOAD_TTL_MINUTES || 60)) * 60 * 1000;
  private readonly allowedExtensions = String(
    process.env.FILE_UPLOAD_ALLOWED_EXTENSIONS || '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp',
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly auditLogs: AuditLogsService,
  ) {
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

  private isProductionRuntime() {
    return (
      String(process.env.NODE_ENV ?? '').toLowerCase() === 'production' ||
      String(process.env.APP_ENV ?? '').toLowerCase() === 'production'
    );
  }

  private assertExtensionPolicy(extension: string) {
    const blockedExtensions = new Set([
      '.exe', '.dll', '.bat', '.cmd', '.ps1', '.sh', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.php', '.py', '.rb', '.pl',
      '.jar', '.msi', '.com', '.scr', '.vbs', '.hta', '.html', '.htm',
    ]);
    const archiveExtensions = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2']);
    if (blockedExtensions.has(extension)) {
      throw new BadRequestException('Executable, script, or active content uploads are not allowed.');
    }
    if (archiveExtensions.has(extension) && String(process.env.FILE_UPLOAD_ALLOW_ARCHIVES || 'false').toLowerCase() !== 'true') {
      throw new BadRequestException('Archive uploads are disabled by policy.');
    }
    if (!extension || !this.allowedExtensions.includes(extension)) {
      throw new BadRequestException(`Unsupported file type ${extension || '(none)'}.`);
    }
  }

  private assertMimeMatchesExtension(extension: string, contentType?: string | null) {
    const declared = String(contentType ?? '').split(';')[0].trim().toLowerCase();
    if (!declared) return;
    const expected: Record<string, string[]> = {
      '.pdf': ['application/pdf'],
      '.doc': ['application/msword', 'application/octet-stream'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
      '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
      '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
      '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
      '.csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
      '.txt': ['text/plain'],
      '.png': ['image/png'],
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.webp': ['image/webp'],
      '.zip': ['application/zip', 'application/x-zip-compressed'],
    };
    const allowed = expected[extension] || [];
    if (allowed.length && !allowed.includes(declared)) {
      throw new BadRequestException(`Uploaded MIME type ${declared} does not match ${extension}.`);
    }
  }

  private decodeBase64Strict(contentBase64: string) {
    const raw = String(contentBase64 ?? '').trim();
    const withoutDataUrl = raw.includes(',')
      ? raw.replace(/^data:[^,]*;base64,/i, '')
      : raw;
    if (!withoutDataUrl || /\s/.test(withoutDataUrl)) {
      throw new BadRequestException('Uploaded file content must be valid base64.');
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(withoutDataUrl)) {
      throw new BadRequestException('Uploaded file content must be valid base64.');
    }
    return Buffer.from(withoutDataUrl, 'base64');
  }

  private assertContentMatchesExtension(extension: string, buffer: Buffer) {
    const hex = buffer.subarray(0, 12).toString('hex');
    const ascii = buffer.subarray(0, 12).toString('ascii');
    const fail = () => {
      throw new BadRequestException(`Uploaded content does not match the ${extension} file type.`);
    };

    switch (extension) {
      case '.pdf':
        if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) fail();
        break;
      case '.png':
        if (!hex.startsWith('89504e470d0a1a0a')) fail();
        break;
      case '.jpg':
      case '.jpeg':
        if (!(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) fail();
        break;
      case '.webp':
        if (!(ascii.startsWith('RIFF') && buffer.subarray(8, 12).toString('ascii') === 'WEBP')) fail();
        break;
      case '.zip':
      case '.docx':
      case '.pptx':
      case '.xlsx':
        if (!hex.startsWith('504b0304') && !hex.startsWith('504b0506') && !hex.startsWith('504b0708')) fail();
        break;
      case '.doc':
      case '.ppt':
      case '.xls':
        if (!hex.startsWith('d0cf11e0a1b11ae1')) fail();
        break;
      case '.txt':
      case '.csv':
        if (buffer.includes(0)) fail();
        break;
      default:
        break;
    }
  }

  private async scanForMalware(buffer: Buffer, fileName: string) {
    const mode = String(process.env.FILE_MALWARE_SCAN_MODE || (this.isProductionRuntime() ? 'fail-closed' : 'disabled')).trim().toLowerCase();
    if (mode === 'disabled') return;
    const scanner = String(process.env.FILE_MALWARE_SCANNER || '').trim().toLowerCase();
    if (scanner !== 'clamav') {
      if (mode === 'fail-open') {
        this.logger.warn('Malware scanner is not configured; upload allowed because FILE_MALWARE_SCAN_MODE=fail-open.');
        return;
      }
      throw new ServiceUnavailableException('File scanning is required but no malware scanner is configured.');
    }
    try {
      await this.scanWithClamAv(buffer);
    } catch (error) {
      if (mode === 'fail-open') {
        this.logger.warn(`Malware scan failed open for ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  }

  private scanWithClamAv(buffer: Buffer) {
    const host = String(process.env.CLAMAV_HOST || '').trim();
    const port = Number(process.env.CLAMAV_PORT || 3310);
    const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || 10_000);
    if (!host || !Number.isFinite(port)) {
      throw new ServiceUnavailableException('ClamAV scanner host/port is not configured.');
    }

    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(new ServiceUnavailableException(error.message));
      };
      socket.setTimeout(timeoutMs);
      socket.once('timeout', () => fail(new Error('ClamAV scan timed out.')));
      socket.once('error', (error) => fail(error));
      socket.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      socket.once('close', () => {
        if (settled) return;
        settled = true;
        const response = Buffer.concat(chunks).toString('utf8');
        if (/FOUND/i.test(response)) {
          reject(new BadRequestException('Uploaded file failed malware scanning.'));
          return;
        }
        if (!/OK/i.test(response)) {
          reject(new ServiceUnavailableException('ClamAV scanner returned an unexpected response.'));
          return;
        }
        resolve();
      });
      socket.connect(port, host, () => {
        socket.write('zINSTREAM\0');
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const chunk = buffer.subarray(offset, Math.min(buffer.length, offset + 64 * 1024));
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length, 0);
          socket.write(size);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
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
    } catch {
      throw new NotFoundException('Stored object not found.');
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

      const isProduction =
        String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
        String(process.env.APP_ENV || '').toLowerCase() === 'production';

      return {
        ok: available && !isProduction,
        storageMode: 'local',
        uploadsPath: this.storageRoot,
        bucket: '',
        region: '',
        endpoint: '',
        available,
        detail: available
          ? isProduction
            ? 'Local uploads directory is writable, but production object storage is not enabled.'
            : 'Local uploads directory is writable.'
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
    if (this.isProductionRuntime() && String(process.env.ALLOW_BASE64_UPLOADS_IN_PRODUCTION || 'false').toLowerCase() !== 'true') {
      throw new BadRequestException('Base64 JSON uploads are disabled in production. Use multipart upload.');
    }
    const buffer = this.decodeBase64Strict(input.contentBase64);
    return this.uploadBuffer({
      ...input,
      buffer,
    });
  }

  async uploadBuffer(input: {
    fileName: string;
    buffer: Buffer;
    contentType?: string;
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
    this.assertExtensionPolicy(extension);
    this.assertMimeMatchesExtension(extension, input.contentType);

    const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.alloc(0);
    if (!buffer.byteLength) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    if (buffer.byteLength > this.maxUploadBytes) {
      throw new BadRequestException(`Uploaded file exceeds the ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB limit.`);
    }
    if (extension) {
      this.assertContentMatchesExtension(extension, buffer);
    }
    await this.scanForMalware(buffer, safeName);

    const id = randomUUID();
    const outputName = `${id}${extname(safeName) || '.bin'}`;
    const relativePath = this.normalizeRelativePath(join(scope, outputName).replace(/\\/g, '/'));
    await this.putObject(relativePath, safeName, buffer);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const pendingUpload = input.uploadedByUserId
      ? await this.prisma.pendingUpload.create({
          data: {
            userId: input.uploadedByUserId,
            scope,
            storageKey: relativePath,
            originalFilename: basename(input.fileName || safeName),
            sanitizedFilename: safeName,
            mimeType: input.contentType || this.inferContentType(safeName),
            detectedExtension: extension || null,
            sizeBytes: buffer.byteLength,
            sha256,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + this.pendingUploadTtlMs),
          },
        })
      : null;

    return {
      id,
      uploadId: pendingUpload?.id || id,
      fileName: safeName,
      storedName: outputName,
      scope,
      sizeBytes: buffer.byteLength,
      sha256,
      path: this.storage.mode === 'local' ? join(this.storageRoot, relativePath) : relativePath,
      relativePath,
      uploadedAt: new Date().toISOString(),
      expiresAt: pendingUpload?.expiresAt.toISOString(),
      uploadedByUserId: input.uploadedByUserId,
      uploadedByRole: input.uploadedByRole,
    };
  }

  async resolvePendingUploadsForSubmission(input: {
    uploadIds: string[];
    userId: string;
  }): Promise<PendingUploadForSubmission[]> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new ForbiddenException('Authenticated student session is required to attach uploads.');
    }

    const uploadIds = Array.from(
      new Set((input.uploadIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
    );
    if (!uploadIds.length) return [];

    const rows = await this.prisma.pendingUpload.findMany({
      where: {
        id: { in: uploadIds },
        userId,
        status: 'PENDING',
        consumedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const found = new Map(rows.map((row) => [row.id, row]));
    const missing = uploadIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new BadRequestException('One or more uploads are not available for this submission.');
    }

    const now = Date.now();
    const expired = rows.filter((row) => row.expiresAt.getTime() <= now);
    if (expired.length) {
      await this.prisma.pendingUpload.updateMany({
        where: { id: { in: expired.map((row) => row.id) }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('One or more uploads have expired. Upload the file again before submitting.');
    }

    const missingStorage: string[] = [];
    for (const row of rows) {
      if (!(await this.hasObject(row.storageKey))) {
        missingStorage.push(row.id);
      }
    }
    if (missingStorage.length) {
      throw new BadRequestException('One or more uploads are missing from storage. Upload the file again before submitting.');
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    return uploadIds.map((id) => byId.get(id)).filter(Boolean) as PendingUploadForSubmission[];
  }

  async cleanupExpiredPendingUploads(limit = 100) {
    const take = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
    const expired = await this.prisma.pendingUpload.findMany({
      where: {
        status: 'PENDING',
        consumedAt: null,
        expiresAt: { lt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
      take,
    });
    if (!expired.length) return { expired: 0, deletedStorageObjects: 0, warnings: [] as string[] };

    const warnings: string[] = [];
    let deletedStorageObjects = 0;
    for (const upload of expired) {
      try {
        await this.deleteObject(upload.storageKey);
        deletedStorageObjects += 1;
      } catch (error) {
        warnings.push(
          `${upload.id}: ${error instanceof Error ? error.message : 'Unable to delete expired pending upload.'}`,
        );
      }
    }

    await this.prisma.pendingUpload.updateMany({
      where: { id: { in: expired.map((upload) => upload.id) }, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    return { expired: expired.length, deletedStorageObjects, warnings };
  }

  async list(scope?: string, actor?: { userId?: string; role?: string }) {
    const scopedFiles = await this.prisma.submissionFile.findMany({
      where: {
        deletedAt: null,
        ...(scope ? { relativePath: { startsWith: `${scope}/` } } : {}),
        ...(actor?.role === 'TEACHER'
          ? { submission: { subject: { teacher: { userId: actor.userId } } } }
          : {}),
      },
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

    const storageRows = actor?.role === 'ADMIN'
      ? this.storage.mode === 's3'
        ? await this.listS3Objects(scope)
        : this.listLocalObjects(scope)
      : [];

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
    let meta: any = null;
    try {
      meta = await this.access.requireUserCanDownloadFile(actor?.userId, actor?.role, normalized);
    } catch (error) {
      await this.auditLogs.record({
        actorUserId: actor?.userId,
        actorRole: String(actor?.role || 'UNKNOWN'),
        action: 'FILE_ACCESS_DENIED',
        module: 'Files',
        target: normalized,
        result: 'Denied',
        details: error instanceof Error ? error.message : 'File access denied.',
      });
      throw error;
    }

    if (this.storage.mode === 's3') {
      const fileName = meta?.fileName || basename(normalized);
      await this.auditLogs.record({
        actorUserId: actor?.userId,
        actorRole: String(actor?.role || 'UNKNOWN'),
        action: 'FILE_DOWNLOADED',
        module: 'Files',
        target: normalized,
        entityId: meta?.id,
        result: 'Success',
      });
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
    await this.auditLogs.record({
      actorUserId: actor?.userId,
      actorRole: String(actor?.role || 'UNKNOWN'),
      action: 'FILE_DOWNLOADED',
      module: 'Files',
      target: normalized,
      entityId: meta?.id,
      result: 'Success',
    });

    return {
      absolutePath: target,
      fileName: meta?.fileName || basename(target),
      meta,
    };
  }

  async validateUploadedFileReferences(relativePaths: string[]) {
    const normalizedPaths = Array.from(
      new Set(relativePaths.map((item) => this.normalizeRelativePath(item))),
    );
    const missingStorage: string[] = [];
    for (const relativePath of normalizedPaths) {
      if (!(await this.hasObject(relativePath))) {
        missingStorage.push(relativePath);
      }
    }
    if (missingStorage.length) {
      throw new BadRequestException('One or more uploaded files are missing from storage.');
    }
    return normalizedPaths;
  }

  async ensureFilesAttachedToSubmission(input: {
    relativePaths: string[];
    submissionId: string;
    activityId?: string;
    subjectId?: string;
  }) {
    const relativePaths = await this.validateUploadedFileReferences(input.relativePaths);
    if (!relativePaths.length) return [];

    const rows = await this.prisma.submissionFile.findMany({
      where: {
        submissionId: input.submissionId,
        relativePath: { in: relativePaths },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    const found = new Set(rows.map((row) => row.relativePath).filter(Boolean) as string[]);
    const missingMetadata = relativePaths.filter((item) => !found.has(item));
    if (missingMetadata.length) {
      throw new BadRequestException('One or more uploaded files are not linked to the saved submission.');
    }
    return rows;
  }

  async attachFilesToSubmission(input: {
    relativePaths: string[];
    submissionId: string;
    activityId?: string;
    subjectId?: string;
  }) {
    return this.ensureFilesAttachedToSubmission(input);
  }

  async listForSubmission(submissionId: string, actor?: { userId?: string; role?: string }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    if (!submission) throw new NotFoundException('Submission not found.');
    if (actor?.role === 'STUDENT') {
      await this.access.requireStudentCanAccessSubmission(actor.userId, submissionId);
    } else if (actor?.role === 'TEACHER') {
      await this.access.requireTeacherCanReviewSubmission(actor.userId, submissionId);
    } else if (actor?.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have access to this submission.');
    }
    return this.prisma.submissionFile.findMany({
      where: { submissionId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeStorageObjectOnly(relativePath: string, actor?: { userId?: string; role?: string }) {
    const normalized = this.normalizeRelativePath(relativePath);
    await this.deleteObject(normalized);
    await this.auditLogs.record({
      actorUserId: actor?.userId,
      actorRole: String(actor?.role || 'UNKNOWN'),
      action: 'FILE_STORAGE_OBJECT_DELETED',
      module: 'Files',
      target: normalized,
      result: 'Success',
      details: 'Deleted an orphaned storage object after associated database metadata was removed.',
    });
    return { success: true, removed: normalized };
  }

  async remove(relativePath: string, actor?: { userId?: string; role?: string }) {
    const normalized = this.normalizeRelativePath(relativePath);
    const meta = await this.access.requireUserCanDownloadFile(actor?.userId, actor?.role, normalized);
    let markedDeleted = false;
    if (meta?.id) {
      await this.prisma.submissionFile.update({
        where: { id: meta.id },
        data: { deletedAt: new Date() },
      });
      markedDeleted = true;
    }
    let storageAlreadyMissing = false;
    try {
      await this.deleteObject(normalized);
    } catch (error) {
      if (error instanceof NotFoundException && markedDeleted) {
        storageAlreadyMissing = true;
      } else {
        await this.auditLogs.record({
          actorUserId: actor?.userId,
          actorRole: String(actor?.role || 'UNKNOWN'),
          action: 'FILE_DELETE_STORAGE_FAILED',
          module: 'Files',
          target: normalized,
          entityId: meta?.id,
          result: 'Failed',
          details: error instanceof Error ? error.message : 'Storage delete failed.',
        });
        throw new BadRequestException('File metadata was marked deleted, but the storage object could not be removed. Review file inventory for cleanup.');
      }
    }
    await this.auditLogs.record({
      actorUserId: actor?.userId,
      actorRole: String(actor?.role || 'UNKNOWN'),
      action: 'FILE_DELETED',
      module: 'Files',
      target: normalized,
      entityId: meta?.id,
      result: 'Success',
      details: meta?.submissionId
        ? `Deleted file metadata linked to submission ${meta.submissionId}.${storageAlreadyMissing ? ' Storage object was already missing.' : ''}`
        : 'Deleted untracked storage object.',
    });
    return { success: true, removed: normalized };
  }
}
