export const BRAND_NAME = "ProjTrack";
export const DEFAULT_FAVICON_PATH = "/favicon.svg";
export const DEFAULT_LOGO_PATH: string | null = null;
export const DEFAULT_ICON_PATH: string | null = null;
export const BRANDING_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

export type BrandingAssetKind = "logo" | "icon" | "favicon";

export type BrandingResponse = {
  brandName: string;
  logoUrl: string | null;
  iconUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string | null;
};

export const defaultBranding: BrandingResponse = {
  brandName: BRAND_NAME,
  logoUrl: DEFAULT_LOGO_PATH,
  iconUrl: DEFAULT_ICON_PATH,
  faviconUrl: DEFAULT_FAVICON_PATH,
  updatedAt: null,
};
