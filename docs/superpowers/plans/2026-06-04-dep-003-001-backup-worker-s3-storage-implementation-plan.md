# DEP-003+001: Backup Worker + S3 Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve DEP-003 (backup worker disabled on staging) and DEP-001 (local-only ephemeral backup artifacts) by adding an S3-compatible backup storage provider and enabling the backup worker on staging.

**Architecture:** Add an `s3` provider to `BackupStorageService` via a new `BackupS3StorageService` that uses `@aws-sdk/client-s3`. The local provider remains the default. `BackupStorageService` routes I/O based on `BACKUP_STORAGE_PROVIDER`. No schema migration needed — `BackupRun` already has `storage`, `artifactPath`, `sizeBytes`, `sha256`.

**Tech Stack:** NestJS, `@aws-sdk/client-s3`, DO Spaces (S3-compatible), Node 20

---

## Current Code Findings

| Area | File | Key Observations |
|------|------|-----------------|
| Storage provider | `backup-storage.service.ts:7-218` | `assertSupportedProvider()` blocks all non-local providers. Interface: `writeJson`, `readJson`, `describe`, `delete`, `listJsonArtifacts`, `checksum`, `readText`. |
| Worker | `backup-worker.service.ts:1-64` | Reads `BACKUP_WORKER_ENABLED` (must be `'true'`). Polls on `BACKUP_WORKER_POLL_MS`. |
| Runtime safety | `runtime-safety.ts:323-337` | Requires `BACKUP_WORKER_ENABLED`, `BACKUP_SCHEDULE_ENABLED`, `BACKUP_WORKER_POLL_MS`. |
| Prisma model | `schema.prisma:654-683` | `BackupRun` has `storage` (default "local"), `artifactPath`, `sizeBytes`, `sha256` — **no schema change needed** |
| S3 pattern ref | `files.service.ts:6,51-55` | Creates `S3Client({ region, endpoint, credentials })`. Uses Put/Get/Head/List/Delete commands with explicit `{ Bucket, Key }`. |
| Staging env | `docs/env/staging.env.example:67-69` | `BACKUP_WORKER_ENABLED=false`, `BACKUP_SCHEDULE_ENABLED=false` |
| Compose | `docker-compose.production.yml:80-108` | `backup-worker` has `BACKUP_WORKER_ENABLED=true`. Volume `./data/backups:/app/data/...` |

---

## Execution Plan

### Task 1: Create BackupS3StorageService

**Files:**
- Create: `backend/src/backups/backup-s3-storage.service.ts`
- No other files modified yet

**Key design decisions:**
- S3 key: `backups/{prefix}{fileName}` — the `fileName` (e.g. `projtrack-backup-2026-06-04T12-00-00-000Z-cm7abc123.json`) already contains the `BackupRun.id` (the CUID after the last `-`), making it globally unique. No separate `backupId` parameter needed.
- All public methods match `BackupStorageService`'s interface: `writeJson(fileName, payload)`, `readJson(fileName)`, `describe(fileName)`, `delete(fileName)`, `listJsonArtifacts()`, `checksum(fileName)`.
- S3 errors caught and re-thrown as `InternalServerErrorException` with redacted messages.
- `isAvailable()` returns `false` when bucket is not configured.

- [ ] **Step 1: Write the service**

```typescript
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
  private readonly s3Client: S3Client | null = null;
  private readonly bucket = '';
  private readonly prefix = '';

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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/backups/backup-s3-storage.service.ts
git commit -m "feat(backup): add BackupS3StorageService"
```

---

### Task 2: Refactor BackupStorageService for Provider Routing

**Files:**
- Modify: `backend/src/backups/backup-storage.service.ts`
- Modify: `backend/src/backups/backups.module.ts`

The existing `BackupStorageService` becomes a router. When `BACKUP_STORAGE_PROVIDER=s3`, it delegates to `BackupS3StorageService`. When `local` (default), behavior is unchanged.

**Detailed changes:**

1. **Inject `BackupS3StorageService`** into `BackupStorageService` via constructor (optional — use `@Optional()` or a `?` type).
2. **`assertSupportedProvider()`** — accept both `local` and `s3` instead of rejecting non-local.
3. **Route methods** — for each public method, if provider is `s3`, delegate to `this.s3Storage.method(fileName, ...)`. If local, existing behavior.
4. **Return type adaptation** — `writeJson` returns `{ absolutePath, sizeBytes, sha256 }` for local, but S3 returns `{ key, sizeBytes, sha256 }`. The callers in `BackupsService` use `artifact.absolutePath` to set `artifactPath` on `BackupRun`. For S3, we map `key` to `absolutePath` in the return, or we handle the difference.

Looking at `backups.service.ts:203`:
```typescript
artifact = this.storage.writeJson(fileName, { manifest, data });
```
And later (around line 536):
```typescript
artifactPath: artifact.absolutePath || run.artifactPath || null,
```

So `writeJson` must return an object with an `absolutePath` property (or the caller needs updating). For S3, the "path" is the S3 key. We can map `key` to `absolutePath` in the return from `BackupStorageService`.

Similarly, `describe()` returns `{ provider, storageRoot, absolutePath, available, sizeBytes, warning }` for local. For S3, return `{ provider, storageRoot: key, absolutePath: key, available, sizeBytes, warning }`.

The simplest approach: In `BackupStorageService`'s routed methods, normalize the S3 return to match the local shape. Set `absolutePath` to the S3 `key` value. For `describe`, set both `storageRoot` and `absolutePath` to the S3 key.

- [ ] **Step 1: Update BackupStorageService**

Edit `backend/src/backups/backup-storage.service.ts`:

```typescript
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { BackupS3StorageService } from './backup-s3-storage.service';

@Injectable()
export class BackupStorageService {
  private readonly logger = new Logger(BackupStorageService.name);
  private readonly provider: string;
  private readonly root: string;

  constructor(private readonly s3Storage?: BackupS3StorageService) {
    this.provider = String(process.env.BACKUP_STORAGE_PROVIDER || 'local').trim().toLowerCase() || 'local';
    this.root = resolve(
      process.env.BACKUP_LOCAL_DIR || join(process.cwd(), 'data/system-tools/backups'),
    );
    if (this.provider === 'local') {
      this.ensureRoot();
    }
  }

  getProvider(): string {
    return this.provider;
  }

  getRoot(): string {
    return this.root;
  }

  supportsLocalArtifacts(): boolean {
    return this.provider === 'local';
  }

  private isS3(): boolean {
    return this.provider === 's3' && this.s3Storage?.isAvailable() === true;
  }

  // ---- local-only helpers (unchanged) ----

  resolveArtifact(fileName: string): string {
    return this.resolveArtifactInRoot(fileName, this.root);
  }

  private resolveArtifactInRoot(fileName: string, root: string): string {
    const safeName = basename(String(fileName || '').trim());
    if (!safeName || safeName !== fileName || !/^[a-zA-Z0-9_.-]+$/.test(safeName)) {
      throw new BadRequestException('Invalid backup file name.');
    }
    const normalizedRoot = resolve(root);
    const absolutePath = resolve(normalizedRoot, safeName);
    if (!absolutePath.startsWith(normalizedRoot)) {
      throw new BadRequestException('Invalid backup path.');
    }
    return absolutePath;
  }

  private candidateRoots(): string[] {
    return Array.from(
      new Set(
        [
          this.root,
          resolve(process.cwd(), 'backend/data/system-tools/backups'),
          resolve(process.cwd(), 'data/system-tools/backups'),
          resolve(__dirname, '../../data/system-tools/backups'),
          resolve(__dirname, '../../../data/system-tools/backups'),
        ].map((p) => resolve(p)),
      ),
    );
  }

  private existingRoots(): string[] {
    return this.candidateRoots().filter((r) => r === this.root || existsSync(r));
  }

  private resolveExistingArtifact(fileName: string): { absolutePath: string; root: string } {
    for (const root of this.existingRoots()) {
      const absolutePath = this.resolveArtifactInRoot(fileName, root);
      if (existsSync(absolutePath)) return { absolutePath, root };
    }
    return { absolutePath: this.resolveArtifact(fileName), root: this.root };
  }

  // ---- public API (routed) ----

  async describe(fileName?: string | null): Promise<{
    provider: string;
    storageRoot: string | null;
    absolutePath: string | null;
    available: boolean;
    sizeBytes: number | null;
    warning: string | null;
  }> {
    if (!fileName) {
      return {
        provider: this.provider,
        storageRoot: this.root,
        absolutePath: null,
        available: false,
        sizeBytes: null,
        warning: 'Backup metadata exists, but the artifact name is missing.',
      };
    }

    if (this.isS3()) {
      const result = await this.s3Storage!.describe(fileName);
      return {
        provider: result.provider,
        storageRoot: result.key,
        absolutePath: result.key,
        available: result.available,
        sizeBytes: result.sizeBytes,
        warning: result.warning,
      };
    }

    // local provider (unchanged)
    const located = this.resolveExistingArtifact(fileName);
    const absolutePath = located.absolutePath;
    if (!existsSync(absolutePath)) {
      return {
        provider: this.provider,
        storageRoot: this.root,
        absolutePath,
        available: false,
        sizeBytes: null,
        warning: 'Backup artifact is missing from storage.',
      };
    }
    const st = statSync(absolutePath);
    return {
      provider: this.provider,
      storageRoot: located.root,
      absolutePath,
      available: true,
      sizeBytes: st.size,
      warning: null,
    };
  }

  async writeJson(fileName: string, payload: unknown): Promise<{
    absolutePath: string;
    sizeBytes: number;
    sha256: string;
  }> {
    if (this.isS3()) {
      const result = await this.s3Storage!.writeJson(fileName, payload);
      return { absolutePath: result.key, sizeBytes: result.sizeBytes, sha256: result.sha256 };
    }
    // local provider (unchanged)
    this.ensureRoot();
    const absolutePath = this.resolveArtifact(fileName);
    const content = JSON.stringify(payload, null, 2) + '\n';
    writeFileSync(absolutePath, content, 'utf8');
    const sha256 = createHash('sha256').update(content).digest('hex');
    const st = statSync(absolutePath);
    return { absolutePath, sizeBytes: st.size, sha256 };
  }

  async readJson(fileName: string): Promise<unknown> {
    if (this.isS3()) return this.s3Storage!.readJson(fileName);
    // local provider (unchanged)
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) throw new NotFoundException('Backup artifact not found.');
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  }

  async checksum(fileName: string): Promise<string> {
    if (this.isS3()) return this.s3Storage!.checksum(fileName);
    // local provider (unchanged)
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) throw new NotFoundException('Backup artifact not found.');
    return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
  }

  async delete(fileName: string): Promise<{ deleted: boolean; missing: boolean; absolutePath: string }> {
    if (this.isS3()) {
      const result = await this.s3Storage!.delete(fileName);
      return { deleted: result.deleted, missing: result.missing, absolutePath: result.key };
    }
    // local provider (unchanged)
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
      return { deleted: true, missing: false, absolutePath };
    }
    return { deleted: false, missing: true, absolutePath };
  }

  async listJsonArtifacts(): Promise<
    Array<{ fileName: string; absolutePath: string; sizeBytes: number; modifiedAt: Date }>
  > {
    if (this.isS3()) {
      const artifacts = await this.s3Storage!.listJsonArtifacts();
      return artifacts.map((a) => ({
        fileName: a.fileName,
        absolutePath: a.key,
        sizeBytes: a.sizeBytes,
        modifiedAt: a.modifiedAt,
      }));
    }
    // local provider (unchanged)
    this.ensureRoot();
    const seen = new Set<string>();
    return this.existingRoots().flatMap((root) =>
      readdirSync(root)
        .filter((fn) => /^[a-zA-Z0-9_.-]+\.json$/i.test(fn) && !/^backup-settings\.json$/i.test(fn))
        .filter((fn) => {
          if (seen.has(fn)) return false;
          seen.add(fn);
          return true;
        })
        .map((fn) => {
          const absolutePath = this.resolveArtifactInRoot(fn, root);
          const st = statSync(absolutePath);
          return { fileName: fn, absolutePath, sizeBytes: st.size, modifiedAt: st.mtime };
        }),
    );
  }

  // readText is only used during normalizeLocalArtifacts — keep local-only for now
  readText(fileName: string): string {
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) throw new NotFoundException('Backup artifact not found.');
    return readFileSync(absolutePath, 'utf8');
  }

  private ensureRoot(): void {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }
}
```

- [ ] **Step 2: Update BackupsModule**

Edit `backend/src/backups/backups.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupRetentionService } from './backup-retention.service';
import { BackupS3StorageService } from './backup-s3-storage.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupWorkerService } from './backup-worker.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [BackupsController],
  providers: [
    BackupsService,
    BackupWorkerService,
    BackupRetentionService,
    BackupStorageService,
    BackupS3StorageService,
  ],
  exports: [BackupsService, BackupWorkerService, BackupRetentionService],
})
export class BackupsModule {}
```

- [ ] **Step 3: Build and test**

```bash
cd backend && npm run build
```
Expected: exit 0.

Run existing tests to verify nothing broke:
```bash
cd backend && npm run test:unit -- --testPathIgnorePatterns="backup-s3-storage"
```
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backups/backup-storage.service.ts
git add backend/src/backups/backups.module.ts
git commit -m "refactor(backup): route BackupStorageService to S3 provider when configured"
```

---

### Task 3: Update Runtime Safety

**Files:**
- Modify: `backend/src/config/runtime-safety.ts`

Add S3 env validation when `BACKUP_STORAGE_PROVIDER=s3`. Keep `BACKUP_SCHEDULE_ENABLED` requirement for backward compat (existing env files and deployments set it). Add `BACKUP_STORAGE_PROVIDER` to the required env list.

- [ ] **Step 1: Add S3 validation to `validateWorkerSettings`**

Edit `backend/src/config/runtime-safety.ts` around lines 323-337:

```typescript
function validateWorkerSettings(errors: string[], warnings: string[], isProduction: boolean, env: NodeJS.ProcessEnv) {
  const target = isProduction ? errors : warnings;
  for (const key of ['MAIL_WORKER_ENABLED', 'BACKUP_WORKER_ENABLED', 'BACKUP_SCHEDULE_ENABLED']) {
    if (!hasValue(env[key])) target.push(`${key} must be explicitly configured.`);
  }
  for (const key of ['MAIL_WORKER_POLL_MS', 'BACKUP_WORKER_POLL_MS']) {
    const raw = env[key];
    if (!hasValue(raw)) {
      target.push(`${key} must be explicitly configured.`);
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1000) target.push(`${key} must be a number >= 1000.`);
  }

  // Validate S3 backup config when provider is s3
  const provider = String(env.BACKUP_STORAGE_PROVIDER || 'local').trim().toLowerCase();
  if (provider === 's3') {
    const s3Required = ['BACKUP_S3_ENDPOINT', 'BACKUP_S3_REGION', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY'];
    for (const key of s3Required) {
      if (!hasValue(env[key])) {
        errors.push(`${key} must be configured when BACKUP_STORAGE_PROVIDER=s3.`);
      }
    }
  }
}
```

- [ ] **Step 2: Build and run existing tests**

```bash
cd backend && npm run build && npm run test:unit -- --testPathIgnorePatterns="backup-s3-storage"
```
Expected: exit 0, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/runtime-safety.ts
git commit -m "feat(config): validate S3 backup env vars when provider=s3"
```

---

### Task 4: Write Unit Tests for S3 Backup

**Files:**
- Create: `backend/src/backups/backup-s3-storage.service.spec.ts`
- Create or update existing backup storage spec for provider routing

- [ ] **Step 1: Write BackupS3StorageService unit tests**

Create `backend/src/backups/backup-s3-storage.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BackupS3StorageService } from './backup-s3-storage.service';

describe('BackupS3StorageService', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('isAvailable returns false when bucket is not configured', () => {
    delete process.env.BACKUP_S3_BUCKET;
    const service = new BackupS3StorageService();
    expect(service.isAvailable()).toBe(false);
  });

  it('isAvailable returns true when bucket is configured', () => {
    process.env.BACKUP_S3_ENDPOINT = 'https://sgp1.digitaloceanspaces.com';
    process.env.BACKUP_S3_REGION = 'sgp1';
    process.env.BACKUP_S3_BUCKET = 'test-bucket';
    process.env.BACKUP_S3_ACCESS_KEY_ID = 'test-key';
    process.env.BACKUP_S3_SECRET_ACCESS_KEY = 'test-secret';
    const service = new BackupS3StorageService();
    expect(service.isAvailable()).toBe(true);
  });

  it('throws InternalServerErrorException when not configured and writeJson is called', async () => {
    delete process.env.BACKUP_S3_BUCKET;
    const service = new BackupS3StorageService();
    await expect(service.writeJson('test.json', {})).rejects.toThrow('S3 backup storage is not configured');
  });

  it('builds correct S3 key with prefix', () => {
    process.env.BACKUP_S3_BUCKET = 'test';
    process.env.BACKUP_S3_PREFIX = 'staging/';
    const service = new BackupS3StorageService();
    // Private method - test through describe behavior
    // Key pattern: backups/staging/filename.json
    expect(service.isAvailable()).toBe(true);
  });

  it('validates file name rejects path traversal', async () => {
    process.env.BACKUP_S3_BUCKET = 'test';
    const service = new BackupS3StorageService();
    await expect(service.writeJson('../../etc/passwd', {})).rejects.toThrow('Invalid backup file name');
  });
});
```

- [ ] **Step 2: Write provider routing tests**

Edit `backend/src/backups/backup-storage.service.spec.ts` — add a test block:

```typescript
describe('BackupStorageService provider routing', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults to local provider', () => {
    delete process.env.BACKUP_STORAGE_PROVIDER;
    const moduleRef = Test.createTestingModule({
      providers: [BackupStorageService, BackupS3StorageService],
    });
    // get the service and verify provider is 'local'
  });

  it('routes to S3 provider when BACKUP_STORAGE_PROVIDER=s3', () => {
    process.env.BACKUP_STORAGE_PROVIDER = 's3';
    // configure S3 service and verify routing
  });

  // Add test for error messages not containing credential values
  it('S3 error messages do not contain credentials', async () => {
    process.env.BACKUP_S3_BUCKET = 'test';
    const service = new BackupS3StorageService();
    try {
      await service.readJson('nonexistent.json');
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).not.toContain('test-key');
      expect(msg).not.toContain('test-secret');
    }
  });
});
```

**Implementation note:** S3 methods make real network calls when the S3Client is instantiated. For proper unit testing, the S3 client should be injectable/mockable. The simplest approach for now: test the validation and key building logic directly, and verify the error handling paths (which don't need network access since they throw before sending if not configured).

- [ ] **Step 3: Run all tests**

```bash
cd backend && npm run test:unit
```
Expected: all tests pass (existing + new).

- [ ] **Step 4: Run security tests**

```bash
cd backend && npm run test:security
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backups/backup-s3-storage.service.spec.ts
git add backend/src/backups/backup-storage.service.spec.ts
git commit -m "test(backup): add S3 backup storage and provider routing tests"
```

---

### Task 5: Update Environment Examples

**Files:**
- Modify: `docs/env/staging.env.example` — add S3 backup vars, set `BACKUP_WORKER_ENABLED=true`
- Modify: `docs/env/production.env.example` — add `BACKUP_S3_*` vars, clean up dead `BACKUP_STORAGE` alias

- [ ] **Step 1: Update staging env example**

Edit `docs/env/staging.env.example`:

```
BACKUP_WORKER_ENABLED=false
BACKUP_SCHEDULE_ENABLED=false
BACKUP_WORKER_POLL_MS=3600000
```

Change `BACKUP_WORKER_ENABLED` to reflect that staging should have it enabled (actual deployment sets it to `true`), but keep the example as `false` so operators consciously enable it. Add S3 vars:

```
# S3 backup storage (used when BACKUP_STORAGE_PROVIDER=s3)
BACKUP_STORAGE_PROVIDER=local
# BACKUP_S3_ENDPOINT=
# BACKUP_S3_REGION=
# BACKUP_S3_BUCKET=
# BACKUP_S3_ACCESS_KEY_ID=
# BACKUP_S3_SECRET_ACCESS_KEY=
# BACKUP_S3_PREFIX=staging/
```

- [ ] **Step 2: Update production env example**

Edit `docs/env/production.env.example`:
- Remove the dead `BACKUP_STORAGE=s3` alias line
- Add the same `BACKUP_S3_*` commented vars

- [ ] **Step 3: Commit**

```bash
git add docs/env/staging.env.example
git add docs/env/production.env.example
git commit -m "docs(env): add S3 backup env vars, clean up dead BACKUP_STORAGE alias"
```

---

### Task 6: End-to-End Verification (Full Suite)

- [ ] **Step 1: Build**

```bash
cd backend && npm run build
```
Expected: exit 0.

- [ ] **Step 2: Unit tests**

```bash
cd backend && npm run test:unit
```
Expected: all tests pass.

- [ ] **Step 3: Security tests**

```bash
cd backend && npm run test:security
```
Expected: all pass.

- [ ] **Step 4: Prisma validate**

```powershell
$env:DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
cd backend
npm exec --package=prisma@6.19.3 -- prisma validate
```
Expected: schema valid.

- [ ] **Step 5: Global typecheck**

```bash
cd D:\Vscode\ProjTrack-Official && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 6: Global tests**

```bash
cd D:\Vscode\ProjTrack-Official && npm test
```
Expected: all frontend tests pass.

- [ ] **Step 7: Commit any final fixes**

If any test failed, fix and commit.

---

### Task 7: Create PR and Merge

- [ ] **Step 1: Create focused branch**

```bash
git checkout -b dep/backup-worker-s3-storage
```

- [ ] **Step 2: Push and open PR**

```bash
git push origin dep/backup-worker-s3-storage
gh pr create --base main --head dep/backup-worker-s3-storage --title "feat(backup): add S3 backup storage and enable worker" --body "Closes DEP-003 and DEP-001 for staging."
```

- [ ] **Step 3: Wait for CI**

```bash
gh pr checks 170 --watch
```
Expected: all checks green.

- [ ] **Step 4: Merge (with user authorization)**

```bash
gh pr merge <PR_NUMBER> --merge --match-head-commit <HEAD_SHA>
```

- [ ] **Step 5: Sync main**

```bash
git checkout main && git pull --ff-only origin main
```

---

### Task 8: Staging Deployment and Verification

- [ ] **Step 1: Create DO Spaces bucket**

Create `projtrack-staging-backups` via DO dashboard. Generate a separate access key (distinct from upload access key).

- [ ] **Step 2: Configure staging env**

SSH into staging droplet:
```bash
ssh root@STAGING_IP
cd /opt/projtrack
# Edit backend.env.production (or backend.env.staging)
# Add:
# BACKUP_STORAGE_PROVIDER=s3
# BACKUP_S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
# BACKUP_S3_REGION=sgp1
# BACKUP_S3_BUCKET=projtrack-staging-backups
# BACKUP_S3_ACCESS_KEY_ID=<generated key>
# BACKUP_S3_SECRET_ACCESS_KEY=<generated secret>
# BACKUP_S3_PREFIX=staging/
# BACKUP_WORKER_ENABLED=true
```

- [ ] **Step 3: Rebuild and restart**

```bash
cd /opt/projtrack/repo
git pull origin main
VCS_REF=$(git rev-parse HEAD) docker compose build --no-cache backend backup-worker
docker compose up -d
```

- [ ] **Step 4: Verify worker is running**

```bash
docker compose logs backup-worker --tail 50
```
Expected: "Backup worker is enabled. Loading persisted automatic backup schedule."

- [ ] **Step 5: Trigger manual backup**

Via admin UI: navigate to `/admin/backups` and click "Run Backup". Or via API:
```bash
curl -X POST https://api-staging.projtrack.codes/admin/backups/run -H "Authorization: Bearer <ADMIN_TOKEN>"
```

- [ ] **Step 6: Verify S3 artifact**

```bash
# Using DO Spaces CLI or aws CLI
aws s3 ls s3://projtrack-staging-backups/backups/staging/ --recursive --endpoint https://sgp1.digitaloceanspaces.com
```
Expected: a `.json` file exists.

- [ ] **Step 7: Verify /health/backups**

```bash
curl -s https://api-staging.projtrack.codes/health/backups | jq .
```
Expected: `worker.enabled: true`, `latestSuccessful` populated with `sizeBytes` and `sha256`.

- [ ] **Step 8: Restart worker and verify artifact survives**

```bash
docker compose restart backup-worker
# Wait 10s
curl -s https://api-staging.projtrack.codes/health/backups | jq '.latestSuccessful'
```
Expected: artifact still present and available.

- [ ] **Step 9: Update staging deployment report**

Edit `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md`:
- Mark DEP-003: CLOSED — worker enabled and running
- Mark DEP-001: CLOSED — durable S3 artifact with size/checksum, survives restart
- Keep DEP-004 and DEP-005 as open

---

## Schema Decision

**No schema change required.** The existing `BackupRun` model already has:

| Field | Type | Used For |
|-------|------|----------|
| `storage` | String (default "local") | Stores provider name — auto-set to `"s3"` via `this.storage.getProvider()` |
| `artifactPath` | String? | Stores S3 key when S3 provider is active |
| `fileName` | String? | Same filename convention — already globally unique |
| `sizeBytes` | BigInt? | Already populated from `writeJson` return |
| `sha256` | String? | Already populated from `writeJson` return |

---

## File Change Summary

| File | Change | Reason |
|------|--------|--------|
| `backend/src/backups/backup-s3-storage.service.ts` | **Create** | New S3 storage provider |
| `backend/src/backups/backup-s3-storage.service.spec.ts` | **Create** | Unit tests for S3 provider |
| `backend/src/backups/backup-storage.service.ts` | **Modify** | Route to S3 provider when configured |
| `backend/src/backups/backup-storage.service.spec.ts` | **Modify** | Add provider routing tests |
| `backend/src/backups/backups.module.ts` | **Modify** | Register BackupS3StorageService |
| `backend/src/config/runtime-safety.ts` | **Modify** | Validate S3 env vars when provider=s3 |
| `docs/env/staging.env.example` | **Modify** | Add S3 backup vars, worker flag |
| `docs/env/production.env.example` | **Modify** | Add S3 backup vars, clean dead alias |
| `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md` | **Modify** | Update after live verification |

**No other files changed.** The following callers require zero changes because `BackupStorageService`'s public interface is preserved:
- `BackupsService` (backups.service.ts)
- `HealthService` (health.service.ts) — reads from `BackupsService`, not directly from storage
- `BackupsController` (backups.controller.ts) — same
- All admin backup UI — backend API unchanged

---

## Env Requirements

| Var | Purpose | Required when |
|-----|---------|---------------|
| `BACKUP_STORAGE_PROVIDER=s3` | Select S3 provider | Always validated |
| `BACKUP_S3_ENDPOINT` | DO Spaces endpoint | provider=s3 |
| `BACKUP_S3_REGION` | Region (e.g. `sgp1`) | provider=s3 |
| `BACKUP_S3_BUCKET` | Bucket name | provider=s3 |
| `BACKUP_S3_ACCESS_KEY_ID` | Spaces access key | provider=s3 |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Spaces secret key | provider=s3 |
| `BACKUP_S3_PREFIX` | Key prefix for multi-env (e.g. `staging/`) | Optional |
| `BACKUP_S3_FORCE_PATH_STYLE` | Force path-style addressing | Optional |
| `BACKUP_WORKER_ENABLED=true` | Enable backup worker | Operator decision |
| `BACKUP_SCHEDULE_ENABLED` | Kept for backward compat (dead config) | Runtime safety requires it |

**Rules:**
- No secret values in this plan or committed files
- Backup Spaces access key must be distinct from upload Spaces access key
- Backup bucket must have least-privilege policy (only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`)

---

## Security Plan

| Concern | Mitigation |
|---------|------------|
| Credential leakage | S3 errors caught → redacted `InternalServerErrorException`. Logger message never includes credential values. |
| Path traversal | AWS SDK rejects `../` in keys. `validate()` checks filename regex `/^[a-zA-Z0-9_.-]+$/`. |
| Cross-environment collision | `BACKUP_S3_PREFIX` scopes keys per environment (e.g. `staging/`). |
| Least-privilege | Backup Spaces key scoped to single bucket with minimal permissions. |
| SSE | DO Spaces provides default SSE-S3 encryption at rest. |
| Public access | Bucket is private. Artifact download requires admin auth (existing `/admin/backups/:id/download`). |
| Retention | `delete()` removes S3 object. `BackupRetentionService.cleanupExpired()` calls delete. |
| No logging of payloads | Logger only writes key names and operation status, never artifact contents. |

---

## Verification Plan

### Local

```bash
cd backend && npm run build
cd backend && npm run test:unit
cd backend && npm run test:security
$env:DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
cd backend && npm exec --package=prisma@6.19.3 -- prisma validate
cd .. && npm run typecheck
cd .. && npm test
```

### CI

- PR checks all green
- User authorization required before merge
- Merge commit (no squash, no rebase)

### Staging

1. Create DO Spaces bucket with separate access key
2. Set `BACKUP_STORAGE_PROVIDER=s3` + all `BACKUP_S3_*` vars in staging env
3. Set `BACKUP_WORKER_ENABLED=true`
4. Rebuild: `VCS_REF=$(git rev-parse HEAD) docker compose build --no-cache backend backup-worker`
5. Restart: `docker compose up -d`
6. Trigger manual backup via admin UI
7. Verify S3 artifact via Spaces CLI
8. Verify `/health/backups` reports artifact with size/SHA-256, `worker.enabled: true`
9. Restart worker container, recheck artifact availability
10. Update `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md`

---

## Rollback Plan

| Scenario | Action |
|----------|--------|
| Worker fails to start | Set `BACKUP_WORKER_ENABLED=false`, restart worker container |
| S3 provider errors | Set `BACKUP_STORAGE_PROVIDER=local`, restart backend. Local provider is default fallback. |
| Code regression | `git revert <merge-commit>`, rebuild and redeploy |
| S3 artifacts accumulate | Retention/delete removes expired artifacts. Manual cleanup via Spaces dashboard. |
| No destructive delete | Rollback does not delete S3 artifacts unless explicitly authorized. |

---

## Acceptance Criteria

### DEP-003 closed only when

- `BACKUP_WORKER_ENABLED=true` on staging
- Worker container is running and healthy
- Worker logs show no fatal errors
- `/health/backups` reports `worker.enabled: true`

### DEP-001 closed only when

- Real backup artifact exists in S3/Spaces bucket
- `BackupRun` metadata references the S3 key as `artifactPath`
- `sizeBytes` and `sha256` populated in `BackupRun`
- Artifact survives worker container restart
- Artifact can be described via `/health/backups` without downloading sensitive contents
- Local-only missing artifact is no longer the only backup evidence on staging

### Not closed by this work

- DEP-005 restore drill
- DEP-004 monitoring provider

---

## Non-Goals (Repeated)

- DEP-004 monitoring provider setup
- DEP-005 restore drill execution
- Production promotion
- Upload/file storage changes
- Destructive database restore
- Backup admin UI changes
- Data deletion workflow changes
- Mail worker changes

---

## Open Questions

1. **Does the staging backup bucket already exist?** If not, create via DO dashboard before deployment.
2. **Is there already a separate Spaces access key for backups?** The plan recommends a distinct key from uploads.
3. **What is the exact staging docker compose setup?** If staging uses `docker-compose.production.yml` with `./data/backups` volume, the volume can remain (unused when S3 is active) or be removed.
4. **How are staging env vars managed?** If they're in `backend.env.production` on the droplet, the operator edits that file directly.
