export const BRAND_NAME = 'ProjTrack';
export const DEFAULT_FAVICON_PATH = '/favicon.svg';
export const BRANDING_ASSET_ROUTE_PREFIX = '/branding-assets';
export const BRANDING_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

export type BrandingAssetKind = 'logo' | 'icon' | 'favicon';

export type BrandingAssetRecord = {
  storedName: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

export type BrandingMetadata = {
  brandName: string;
  logo?: BrandingAssetRecord | null;
  icon?: BrandingAssetRecord | null;
  favicon?: BrandingAssetRecord | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  faviconUrl?: string | null;
  updatedAt?: string | null;
};

export type BrandingResponse = {
  brandName: string;
  logoUrl: string | null;
  iconUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string | null;
};

export type BrandingUploadPayload = {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
};
