import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { BackupS3StorageService } from './backup-s3-storage.service';

@Injectable()
export class BackupStorageService {
  private readonly provider = String(process.env.BACKUP_STORAGE_PROVIDER || 'local')
    .trim()
    .toLowerCase() || 'local';
  private readonly root = resolve(
    process.env.BACKUP_LOCAL_DIR || join(process.cwd(), 'data/system-tools/backups'),
  );

  constructor(@Optional() private readonly s3Storage?: BackupS3StorageService) {
    if (this.provider === 'local') {
      this.ensureRoot();
    }
  }

  getProvider() {
    return this.provider;
  }

  getRoot() {
    this.ensureRoot();
    return this.root;
  }

  supportsLocalArtifacts() {
    return this.provider === 'local';
  }

  resolveArtifact(fileName: string) {
    return this.resolveArtifactInRoot(fileName, this.root);
  }

  private isS3(): boolean {
    return this.provider === 's3' && this.s3Storage?.isAvailable() === true;
  }

  private resolveArtifactInRoot(fileName: string, root: string) {
    if (!this.supportsLocalArtifacts()) {
      throw new BadRequestException(
        `Backup storage provider "${this.provider}" is not supported by this deployment.`,
      );
    }
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

  private candidateRoots() {
    return Array.from(
      new Set(
        [
          this.root,
          resolve(process.cwd(), 'backend/data/system-tools/backups'),
          resolve(process.cwd(), 'data/system-tools/backups'),
          resolve(__dirname, '../../data/system-tools/backups'),
          resolve(__dirname, '../../../data/system-tools/backups'),
        ].map((path) => resolve(path)),
      ),
    );
  }

  private existingRoots() {
    return this.candidateRoots().filter((root) => root === this.root || existsSync(root));
  }

  private resolveExistingArtifact(fileName: string) {
    for (const root of this.existingRoots()) {
      const absolutePath = this.resolveArtifactInRoot(fileName, root);
      if (existsSync(absolutePath)) {
        return { absolutePath, root };
      }
    }
    return { absolutePath: this.resolveArtifact(fileName), root: this.root };
  }

  async describe(fileName?: string | null): Promise<{
    provider: string; storageRoot: string | null; absolutePath: string | null;
    available: boolean; sizeBytes: number | null; warning: string | null;
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
    this.ensureRoot();
    if (!this.supportsLocalArtifacts()) {
      return {
        provider: this.provider,
        storageRoot: this.root,
        absolutePath: null,
        available: false,
        sizeBytes: null,
        warning: `Backup storage provider "${this.provider}" is not supported by this deployment.`,
      };
    }
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
    const stat = statSync(absolutePath);
    return {
      provider: this.provider,
      storageRoot: located.root,
      absolutePath,
      available: true,
      sizeBytes: stat.size,
      warning: null,
    };
  }

  async writeJson(fileName: string, payload: unknown): Promise<{ absolutePath: string; sizeBytes: number; sha256: string }> {
    if (this.isS3()) {
      const result = await this.s3Storage!.writeJson(fileName, payload);
      return { absolutePath: result.key, sizeBytes: result.sizeBytes, sha256: result.sha256 };
    }
    this.ensureRoot();
    const absolutePath = this.resolveArtifact(fileName);
    const content = `${JSON.stringify(payload, null, 2)}\n`;
    writeFileSync(absolutePath, content, 'utf8');
    const sha256 = createHash('sha256').update(content).digest('hex');
    const stat = statSync(absolutePath);
    return { absolutePath, sizeBytes: stat.size, sha256 };
  }

  async readJson(fileName: string) {
    if (this.isS3()) {
      return await this.s3Storage!.readJson(fileName);
    }
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Backup artifact not found.');
    }
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  }

  async checksum(fileName: string): Promise<string> {
    if (this.isS3()) {
      return await this.s3Storage!.checksum(fileName);
    }
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Backup artifact not found.');
    }
    const content = readFileSync(absolutePath);
    return createHash('sha256').update(content).digest('hex');
  }

  async delete(fileName: string): Promise<{ deleted: boolean; missing: boolean; absolutePath: string }> {
    if (this.isS3()) {
      const result = await this.s3Storage!.delete(fileName);
      return { deleted: result.deleted, missing: result.missing, absolutePath: result.key };
    }
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
      return { deleted: true, missing: false, absolutePath };
    }
    return { deleted: false, missing: true, absolutePath };
  }

  async listJsonArtifacts(): Promise<Array<{ fileName: string; absolutePath: string; sizeBytes: number; modifiedAt: Date }>> {
    if (this.isS3()) {
      const artifacts = await this.s3Storage!.listJsonArtifacts();
      return artifacts.map(a => ({
        fileName: a.fileName,
        absolutePath: a.key,
        sizeBytes: a.sizeBytes,
        modifiedAt: a.modifiedAt,
      }));
    }
    this.ensureRoot();
    const seen = new Set<string>();
    return this.existingRoots().flatMap((root) =>
      readdirSync(root)
        .filter((fileName) => /^[a-zA-Z0-9_.-]+\.json$/i.test(fileName))
        .filter((fileName) => !/^backup-settings\.json$/i.test(fileName))
        .filter((fileName) => {
          if (seen.has(fileName)) return false;
          seen.add(fileName);
          return true;
        })
        .map((fileName) => {
          const absolutePath = this.resolveArtifactInRoot(fileName, root);
          const stat = statSync(absolutePath);
          return {
            fileName,
            absolutePath,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime,
          };
        }),
    );
  }

  readText(fileName: string) {
    this.ensureRoot();
    const absolutePath = this.resolveExistingArtifact(fileName).absolutePath;
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Backup artifact not found.');
    }
    return readFileSync(absolutePath, 'utf8');
  }

  private ensureRoot() {
    if (this.provider === 'local' && !existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }
}
