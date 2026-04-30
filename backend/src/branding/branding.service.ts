import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, extname, resolve } from 'path';
import {
  BRAND_NAME,
  BRANDING_ASSET_ROUTE_PREFIX,
  BRANDING_UPLOAD_MAX_BYTES,
  DEFAULT_FAVICON_PATH,
  type BrandingAssetKind,
  type BrandingAssetRecord,
  type BrandingMetadata,
  type BrandingResponse,
  type BrandingUploadPayload,
} from './branding.constants';

type AssetRule = {
  extensions: string[];
  mimeTypes: string[];
};

const BRANDING_ASSET_RULES: Record<BrandingAssetKind, AssetRule> = {
  logo: {
    extensions: ['.png', '.svg', '.webp', '.jpg', '.jpeg'],
    mimeTypes: ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'],
  },
  icon: {
    extensions: ['.png', '.svg', '.webp', '.jpg', '.jpeg'],
    mimeTypes: ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'],
  },
  favicon: {
    extensions: ['.png', '.ico'],
    mimeTypes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
  },
};

const SVG_UNSAFE_PATTERNS = [
  /<script\b/i,
  /\bon\w+\s*=/i,
  /javascript:/i,
  /<foreignObject\b/i,
  /<!ENTITY/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<link\b/i,
  /xml-stylesheet/i,
];

@Injectable()
export class BrandingService {
  private uploadsDir = resolve(__dirname, '../../uploads/branding');
  private dataDir = resolve(__dirname, '../../data/branding');
  private metadataPath = resolve(this.dataDir, 'branding.json');

  configureForTesting(paths: { uploadsDir?: string; dataDir?: string }) {
    this.uploadsDir = paths.uploadsDir ?? this.uploadsDir;
    this.dataDir = paths.dataDir ?? this.dataDir;
    this.metadataPath = resolve(this.dataDir, 'branding.json');
  }

  getPublicBranding() {
    return this.toResponse(this.readMetadata());
  }

  getAdminBranding() {
    return this.getPublicBranding();
  }

  saveBranding(input?: { brandName?: string | null }) {
    const current = this.readMetadata();
    const nextBrandName = String(input?.brandName ?? current.brandName ?? BRAND_NAME).trim() || BRAND_NAME;
    const nextMetadata: BrandingMetadata = {
      ...current,
      brandName: nextBrandName,
      updatedAt: new Date().toISOString(),
    };
    this.writeMetadata(nextMetadata);
    return this.toResponse(nextMetadata);
  }

  uploadAsset(kind: BrandingAssetKind, payload: BrandingUploadPayload) {
    const { contentType, extension, buffer, originalName } = this.parseUpload(kind, payload);
    const current = this.readMetadata();
    const previousAsset = current[kind];
    const storedName = `${kind}-${Date.now()}-${randomUUID()}${extension}`;
    this.ensureDirectories();

    writeFileSync(resolve(this.uploadsDir, storedName), buffer);

    const assetRecord: BrandingAssetRecord = {
      storedName,
      originalName,
      contentType,
      sizeBytes: buffer.byteLength,
    };
    const nextMetadata: BrandingMetadata = {
      ...current,
      [kind]: assetRecord,
      updatedAt: new Date().toISOString(),
    };
    this.writeMetadata(nextMetadata);

    if (previousAsset?.storedName) {
      this.removeStoredFile(previousAsset.storedName);
    }

    return this.toResponse(nextMetadata);
  }

  resetBranding() {
    const current = this.readMetadata();
    for (const asset of [current.logo, current.icon, current.favicon]) {
      if (asset?.storedName) {
        this.removeStoredFile(asset.storedName);
      }
    }
    if (existsSync(this.metadataPath)) {
      unlinkSync(this.metadataPath);
    }
    return this.getPublicBranding();
  }

  private defaultMetadata(): BrandingMetadata {
    return {
      brandName: BRAND_NAME,
      logo: null,
      icon: null,
      favicon: null,
      updatedAt: null,
    };
  }

  private ensureDirectories() {
    mkdirSync(this.uploadsDir, { recursive: true });
    mkdirSync(this.dataDir, { recursive: true });
  }

  private readMetadata(): BrandingMetadata {
    this.ensureDirectories();
    if (!existsSync(this.metadataPath)) {
      return this.defaultMetadata();
    }

    try {
      const raw = JSON.parse(readFileSync(this.metadataPath, 'utf8')) as BrandingMetadata;
      return {
        brandName: String(raw?.brandName ?? BRAND_NAME).trim() || BRAND_NAME,
        logo: this.normalizeAssetRecord(raw?.logo),
        icon: this.normalizeAssetRecord(raw?.icon),
        favicon: this.normalizeAssetRecord(raw?.favicon),
        updatedAt: raw?.updatedAt ? String(raw.updatedAt) : null,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Branding metadata could not be read safely. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private writeMetadata(metadata: BrandingMetadata) {
    this.ensureDirectories();
    const response = this.toResponse(metadata);
    writeFileSync(
      this.metadataPath,
      JSON.stringify(
        {
          ...metadata,
          logoUrl: response.logoUrl,
          iconUrl: response.iconUrl,
          faviconUrl: response.faviconUrl,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  private normalizeAssetRecord(record: BrandingAssetRecord | null | undefined) {
    if (!record?.storedName) {
      return null;
    }
    return {
      storedName: basename(String(record.storedName)),
      originalName: String(record.originalName ?? basename(String(record.storedName))),
      contentType: String(record.contentType ?? 'application/octet-stream'),
      sizeBytes: Number(record.sizeBytes ?? 0),
    } satisfies BrandingAssetRecord;
  }

  private toResponse(metadata: BrandingMetadata): BrandingResponse {
    const logoUrl = this.publicUrlForAsset(metadata.logo?.storedName ?? null);
    const iconUrl = this.publicUrlForAsset(metadata.icon?.storedName ?? null);
    const faviconUrl =
      this.publicUrlForAsset(metadata.favicon?.storedName ?? null) ?? DEFAULT_FAVICON_PATH;

    return {
      brandName: String(metadata.brandName ?? BRAND_NAME).trim() || BRAND_NAME,
      logoUrl,
      iconUrl,
      faviconUrl,
      updatedAt: metadata.updatedAt ? String(metadata.updatedAt) : null,
    };
  }

  private publicUrlForAsset(storedName: string | null) {
    if (!storedName) return null;
    return `${BRANDING_ASSET_ROUTE_PREFIX}/${encodeURIComponent(basename(storedName))}`;
  }

  private removeStoredFile(storedName: string) {
    const safeName = basename(String(storedName));
    const absolutePath = resolve(this.uploadsDir, safeName);
    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true });
    }
  }

  private parseUpload(kind: BrandingAssetKind, payload: BrandingUploadPayload) {
    const originalName = basename(String(payload.fileName ?? '').trim());
    const mimeType = String(payload.mimeType ?? '').trim().toLowerCase();
    const contentBase64 = String(payload.contentBase64 ?? '').trim();
    const extension = extname(originalName).toLowerCase();
    const rules = BRANDING_ASSET_RULES[kind];

    if (!originalName || !extension || !contentBase64) {
      throw new BadRequestException('Branding upload must include a file name and base64 content.');
    }
    if (!rules.extensions.includes(extension)) {
      throw new BadRequestException(
        `Unsupported ${kind} file type. Allowed extensions: ${rules.extensions.join(', ')}.`,
      );
    }
    if (!rules.mimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported ${kind} MIME type. Allowed MIME types: ${rules.mimeTypes.join(', ')}.`,
      );
    }
    if (/(?:\.php|\.exe|\.bat|\.cmd|\.ps1|\.js|\.mjs|\.cjs|\.sh)$/i.test(originalName)) {
      throw new BadRequestException('Executable or script uploads are not allowed for branding assets.');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch {
      throw new BadRequestException('Branding upload content must be valid base64.');
    }

    if (!buffer.byteLength) {
      throw new BadRequestException('Branding upload content is empty.');
    }
    if (buffer.byteLength > BRANDING_UPLOAD_MAX_BYTES) {
      throw new BadRequestException('Branding files must be 2MB or smaller.');
    }

    if (extension === '.svg') {
      const svgText = buffer.toString('utf8');
      if (!svgText.trim().startsWith('<')) {
        throw new BadRequestException('SVG branding assets must contain valid SVG markup.');
      }
      for (const pattern of SVG_UNSAFE_PATTERNS) {
        if (pattern.test(svgText)) {
          throw new BadRequestException('Unsafe SVG content was rejected.');
        }
      }
    }

    if (extension === '.png' && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new BadRequestException('Uploaded PNG content is invalid.');
    }
    if ((extension === '.jpg' || extension === '.jpeg') && !(buffer[0] === 0xff && buffer[1] === 0xd8)) {
      throw new BadRequestException('Uploaded JPEG content is invalid.');
    }
    if (extension === '.webp' && buffer.subarray(0, 4).toString('ascii') !== 'RIFF') {
      throw new BadRequestException('Uploaded WEBP content is invalid.');
    }
    if (extension === '.ico' && buffer.byteLength < 4) {
      throw new BadRequestException('Uploaded ICO content is invalid.');
    }

    return {
      originalName,
      extension,
      contentType: mimeType,
      buffer,
    };
  }
}
